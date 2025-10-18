import { openDB, IDBPDatabase } from 'idb';

export interface OfflineScore {
  id?: number;
  matchId: string;
  playerId: string;
  holeNumber: number;
  strokes: number;
  timestamp: number;
  synced: boolean;
}

const DB_NAME = 'matchplay-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function getOfflineDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('scores')) {
        const scoresStore = db.createObjectStore('scores', {
          keyPath: 'id',
          autoIncrement: true,
        });
        scoresStore.createIndex('by-match', 'matchId');
        scoresStore.createIndex('by-synced', 'synced');
        scoresStore.createIndex('by-match-hole', ['matchId', 'holeNumber']);
      }
    },
  });

  return dbInstance;
}

// Save a score offline
export async function saveScoreOffline(
  matchId: string,
  playerId: string,
  holeNumber: number,
  strokes: number
): Promise<void> {
  const db = await getOfflineDB();
  
  // Check if we already have an unsynced score for this hole
  const existingScores = await db.getAllFromIndex(
    'scores',
    'by-match-hole',
    [matchId, holeNumber]
  );
  
  const existingUnsyncedScore = existingScores.find(
    (s: OfflineScore) => s.playerId === playerId && !s.synced
  );

  if (existingUnsyncedScore && existingUnsyncedScore.id) {
    // Update existing unsynced score
    await db.put('scores', {
      ...existingUnsyncedScore,
      strokes,
      timestamp: Date.now(),
    });
  } else {
    // Add new score
    await db.add('scores', {
      matchId,
      playerId,
      holeNumber,
      strokes,
      timestamp: Date.now(),
      synced: false,
    });
  }

  console.log(`💾 Saved score offline: Hole ${holeNumber}, ${strokes} strokes`);
}

// Get all unsynced scores for a match
export async function getUnsyncedScores(matchId: string): Promise<OfflineScore[]> {
  const db = await getOfflineDB();
  const allMatchScores = await db.getAllFromIndex('scores', 'by-match', matchId);
  return (allMatchScores as OfflineScore[]).filter(s => !s.synced);
}

// Get all offline scores for a match (synced and unsynced)
export async function getAllOfflineScores(matchId: string): Promise<OfflineScore[]> {
  const db = await getOfflineDB();
  const scores = await db.getAllFromIndex('scores', 'by-match', matchId);
  return scores as OfflineScore[];
}

// Mark a score as synced
export async function markScoreSynced(id: number): Promise<void> {
  const db = await getOfflineDB();
  const score = await db.get('scores', id);
  if (score) {
    await db.put('scores', { ...score, synced: true });
  }
}

// Delete synced scores older than 7 days
export async function cleanupSyncedScores(): Promise<void> {
  const db = await getOfflineDB();
  const allScores = await db.getAll('scores');
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  for (const score of allScores as OfflineScore[]) {
    if (score.synced && score.timestamp < sevenDaysAgo && score.id) {
      await db.delete('scores', score.id);
    }
  }
}

// Get count of unsynced scores
export async function getUnsyncedScoreCount(): Promise<number> {
  const db = await getOfflineDB();
  const allScores = await db.getAll('scores');
  return (allScores as OfflineScore[]).filter(s => !s.synced).length;
}
