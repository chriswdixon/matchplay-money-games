import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingSyncCount, purgeOrphanedOfflineScores } from '@/lib/scoreSync';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let lastPurge = 0;

    const updatePendingCount = async () => {
      const count = await getPendingSyncCount();
      // If we appear stuck with pending scores while online, periodically
      // purge offline scores tied to matches that no longer exist.
      if (isOnline && count > 0 && Date.now() - lastPurge > 15000) {
        lastPurge = Date.now();
        const purged = await purgeOrphanedOfflineScores();
        if (purged > 0) {
          setPendingCount(await getPendingSyncCount());
          return;
        }
      }
      setPendingCount(count);
    };

    updatePendingCount();

    // Update every 2 seconds
    const interval = setInterval(updatePendingCount, 2000);

    return () => clearInterval(interval);
  }, [isOnline]);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2">
      {!isOnline ? (
        <Badge 
          variant="destructive" 
          className="gap-2 px-3 py-2 shadow-lg"
        >
          <WifiOff className="h-4 w-4" />
          <span className="font-semibold">Offline Mode</span>
        </Badge>
      ) : pendingCount > 0 ? (
        <Badge 
          variant="default"
          className={cn(
            "gap-2 px-3 py-2 shadow-lg",
            "bg-warning text-warning-foreground animate-pulse"
          )}
        >
          <Upload className="h-4 w-4" />
          <span className="font-semibold">Syncing {pendingCount} score{pendingCount !== 1 ? 's' : ''}...</span>
        </Badge>
      ) : (
        <Badge 
          variant="success"
          className="gap-2 px-3 py-2 shadow-lg"
        >
          <Wifi className="h-4 w-4" />
          <span className="font-semibold">Connected</span>
        </Badge>
      )}
    </div>
  );
}
