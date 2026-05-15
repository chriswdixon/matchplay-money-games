import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function NotificationsPanel() {
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          You don't have any notifications yet.
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {notifications.map((n) => {
            const unread = !n.read_at;
            return (
              <li key={n.id}>
                <div
                  className={cn(
                    'rounded-2xl border p-3 transition-colors',
                    unread ? 'bg-primary/5 border-primary/30' : 'bg-muted/40 border-border',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-1.5 w-2 h-2 rounded-full shrink-0',
                        unread ? 'bg-primary' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{n.title}</p>
                      {n.body && (
                        <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {n.match_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (unread) markRead(n.id);
                            navigate(`/match/${n.match_id}`);
                          }}
                        >
                          View
                        </Button>
                      )}
                      {unread && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Mark as read"
                          onClick={() => markRead(n.id)}
                        >
                          <Check className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
