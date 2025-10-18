import { supabase } from '@/integrations/supabase/client';
import { 
  getUnsyncedScores, 
  markScoreSynced, 
  cleanupSyncedScores,
  getUnsyncedScoreCount 
} from './offlineDb';
import { toast } from '@/hooks/use-toast';

export async function syncOfflineScores(matchId: string): Promise<boolean> {
  console.log('🔄 Starting score sync for match:', matchId);
  
  const unsyncedScores = await getUnsyncedScores(matchId);
  
  if (unsyncedScores.length === 0) {
    console.log('✅ No scores to sync');
    return true;
  }

  console.log(`📤 Syncing ${unsyncedScores.length} offline score(s)...`);
  
  let syncedCount = 0;
  let failedCount = 0;

  for (const score of unsyncedScores) {
    try {
      // Check if score already exists in database
      const { data: existingScore } = await supabase
        .from('match_scores')
        .select('id, strokes')
        .eq('match_id', score.matchId)
        .eq('player_id', score.playerId)
        .eq('hole_number', score.holeNumber)
        .maybeSingle();

      if (existingScore) {
        // Update existing score if different
        if (existingScore.strokes !== score.strokes) {
          const { error } = await supabase
            .from('match_scores')
            .update({ strokes: score.strokes })
            .eq('id', existingScore.id);

          if (error) throw error;
          console.log(`✅ Updated score for hole ${score.holeNumber}`);
        } else {
          console.log(`⏭️ Score for hole ${score.holeNumber} already up to date`);
        }
      } else {
        // Insert new score
        const { error } = await supabase
          .from('match_scores')
          .insert({
            match_id: score.matchId,
            player_id: score.playerId,
            hole_number: score.holeNumber,
            strokes: score.strokes,
          });

        if (error) throw error;
        console.log(`✅ Synced new score for hole ${score.holeNumber}`);
      }

      // Mark as synced
      if (score.id) {
        await markScoreSynced(score.id);
        syncedCount++;
      }
    } catch (error) {
      console.error(`❌ Failed to sync score for hole ${score.holeNumber}:`, error);
      failedCount++;
    }
  }

  // Clean up old synced scores
  await cleanupSyncedScores();

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
