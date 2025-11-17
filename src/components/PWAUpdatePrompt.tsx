import { useEffect } from 'react';
import { Workbox } from 'workbox-window';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export function PWAUpdatePrompt() {
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      const wb = new Workbox('/sw.js');

      wb.addEventListener('waiting', () => {
        toast({
          title: "Update Available",
          description: "A new version is available. Refresh to update.",
          action: (
            <Button
              size="sm"
              onClick={() => {
                wb.messageSkipWaiting();
                window.location.reload();
              }}
            >
              Refresh
            </Button>
          ),
          duration: Infinity, // Keep the toast visible until user acts
        });
      });

      wb.register();
    }
  }, []);

  return null;
}
