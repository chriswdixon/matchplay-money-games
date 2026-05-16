import { supabase } from '@/integrations/supabase/client';
import { 
  getUnsyncedScores, 
  markScoreSynced, 
  cleanupSyncedScores,
  getUnsyncedScoreCount,
  getUnsyncedMatchIds,
  deleteOfflineScoresForMatch,
} from './offlineDb';
import { toast } from '@/hooks/use-toast';

/**
 * Remove offline scores tied to matches that:
 *  - no longer exist (deleted), OR
 *  - are cancelled / completed, OR
 *  - the current user is not an active participant of.
 *
 * This prevents the "Sync Warning: N scores failed to sync" loop after a user
 * leaves a match, the match is cancelled, or scores were entered before the
 * user was actually added as a participant (RLS will reject those forever).
 */
export async function purgeOrphanedOfflineScores(): Promise<number> {
  try {
    const matchIds = await getUnsyncedMatchIds();
    if (matchIds.length === 0) return 0;

    const { data: { user } } = await supabase.auth.getUser();

    const { data: matchRows, error: matchErr } = await supabase
      .from('matches')
      .select('id, status')
      .in('id', matchIds);

    if (matchErr) {
      console.warn('purgeOrphanedOfflineScores: matches lookup failed', matchErr);
      return 0;
    }

    const matchStatusById = new Map<string, string>();
    for (const m of matchRows ?? []) matchStatusById.set(m.id, m.status);

    let activeMatchIds = new Set<string>();
    if (user) {
      const { data: participantRows, error: partErr } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('match_id', matchIds);
      if (partErr) {
        console.warn('purgeOrphanedOfflineScores: participants lookup failed', partErr);
      } else {
        activeMatchIds = new Set((participantRows ?? []).map((r: { match_id: string }) => r.match_id));
      }
    }

    let purged = 0;
    for (const id of matchIds) {
      const status = matchStatusById.get(id);
      const matchMissing = status === undefined;
      const matchTerminal = status === 'cancelled' || status === 'completed';
      const userNotInMatch = !!user && !activeMatchIds.has(id);

      if (matchMissing || matchTerminal || userNotInMatch) {
        const removed = await deleteOfflineScoresForMatch(id);
        purged += removed;
        console.log(
          `🗑️ Purged ${removed} offline score(s) for match ${id} (missing=${matchMissing}, status=${status ?? 'n/a'}, userNotInMatch=${userNotInMatch})`
        );
      }
    }
    return purged;
  } catch (e) {
    console.warn('purgeOrphanedOfflineScores error', e);
    return 0;
  }
}


export async function syncOfflineScores(matchId: string): Promise<boolean> {
  console.log('🔄 Starting score sync for match:', matchId);

  const unsyncedScores = await getUnsyncedScores(matchId);

  if (unsyncedScores.length === 0) {
    console.log('✅ No scores to sync');
    return true;
  }

  // Guardrail: if the current user isn't an active participant in this match,
  // these scores will be rejected by RLS forever. Purge them silently instead
  // of toasting "Sync Warning" on every reconnect.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('⏭️ Sync skipped — no authenticated user');
    return true;
  }

  const { data: participantRow } = await supabase
    .from('match_participants')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const { data: matchRow } = await supabase
    .from('matches')
    .select('status')
    .eq('id', matchId)
    .maybeSingle();

  const matchTerminal =
    !matchRow || matchRow.status === 'cancelled' || matchRow.status === 'completed';

  if (!participantRow || matchTerminal) {
    const removed = await deleteOfflineScoresForMatch(matchId);
    console.log(
      `🗑️ Purged ${removed} offline score(s) for match ${matchId} ` +
      `(participant=${!!participantRow}, matchStatus=${matchRow?.status ?? 'missing'})`
    );
    return true;
  }

  console.log(`📤 Syncing ${unsyncedScores.length} offline score(s) in bulk...`);

  let syncedCount = 0;
  let failedCount = 0;

  // Per (player, hole) keep only the latest entry so the bulk upsert doesn't
  // collide with itself in Postgres ("affect row a second time").
  const latestByKey = new Map<string, typeof unsyncedScores[number]>();
  for (const s of unsyncedScores) {
    const key = `${s.playerId}:${s.holeNumber}`;
    const prev = latestByKey.get(key);
    if (!prev || s.timestamp > prev.timestamp) latestByKey.set(key, s);
  }
  const deduped = Array.from(latestByKey.values());

  const payload = deduped.map((s) => ({
    match_id: s.matchId,
    player_id: s.playerId,
    hole_number: s.holeNumber,
    strokes: s.strokes,
  }));

  try {
    const { error } = await supabase
      .from('match_scores')
      .upsert(payload, { onConflict: 'match_id,player_id,hole_number' });

    if (error) throw error;

    // Mark every original unsynced row (including older duplicates) as synced
    // in parallel — IDB writes are local and fast.
    await Promise.all(
      unsyncedScores.map((s) => (s.id != null ? markScoreSynced(s.id) : Promise.resolve())),
    );
    syncedCount = deduped.length;
    console.log(`✅ Bulk-synced ${syncedCount} score(s)`);
  } catch (error) {
    console.error('❌ Bulk sync failed:', error);
    failedCount = deduped.length;
  }

  // Clean up old synced scores (fire-and-forget — don't block UI)
  cleanupSyncedScores().catch(() => {});

  if (syncedCount > 0) {
    toast({
      title: 'Scores Synced',
      description: `Successfully synced ${syncedCount} score${syncedCount !== 1 ? 's' : ''} to the server.`,
    });
  }

  if (failedCount > 0) {
    toast({
      title: 'Sync Warning',
      description: `${failedCount} score${failedCount !== 1 ? 's' : ''} failed to sync. Will retry when connection is stable.`,
      variant: 'destructive',
    });
  }

  return failedCount === 0;
}

export async function getPendingSyncCount(): Promise<number> {
  return await getUnsyncedScoreCount();
}
