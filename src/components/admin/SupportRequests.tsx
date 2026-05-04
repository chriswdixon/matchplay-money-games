import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { LifeBuoy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface SupportRequest {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
  profile?: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
}

export function SupportRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load support requests');
      setLoading(false);
      return;
    }
    const userIds = Array.from(new Set((data || []).map((r) => r.user_id)));
    let profileMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', userIds);
      (profs || []).forEach((p) => { profileMap[p.user_id] = p; });
    }
    setRequests((data || []).map((r) => ({ ...r, profile: profileMap[r.user_id] })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (id: string, resolve: boolean) => {
    const text = (responses[id] || '').trim();
    if (!text) {
      toast.error('Please write a response first');
      return;
    }
    setSavingId(id);
    const { error } = await supabase
      .from('support_requests')
      .update({
        admin_response: text,
        status: resolve ? 'resolved' : 'open',
        resolved_at: resolve ? new Date().toISOString() : null,
        resolved_by: resolve ? user?.id : null,
      })
      .eq('id', id);
    setSavingId(null);
    if (error) {
      toast.error('Failed to save response');
      return;
    }
    toast.success(resolve ? 'Response sent and request resolved' : 'Response sent');
    setResponses((r) => ({ ...r, [id]: '' }));
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <LifeBuoy className="w-5 h-5" aria-hidden="true" />
        <CardTitle>Support Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No support requests yet.</p>
        ) : (
          <ul className="space-y-3" role="list">
            {requests.map((r) => {
              const name = r.profile?.display_name
                || [r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(' ')
                || 'Unknown user';
              return (
                <li key={r.id} className="rounded-2xl border p-3 bg-card">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{r.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        From {name} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={r.status === 'resolved' ? 'secondary' : 'default'}>
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{r.message}</p>

                  {r.admin_response && (
                    <div className="mt-3 rounded-xl bg-muted/60 p-2 text-sm whitespace-pre-wrap">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Admin response</p>
                      {r.admin_response}
                    </div>
                  )}

                  {r.status !== 'resolved' && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={responses[r.id] || ''}
                        onChange={(e) => setResponses((s) => ({ ...s, [r.id]: e.target.value }))}
                        placeholder="Write a response to the user..."
                        rows={3}
                        maxLength={2000}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => respond(r.id, false)}
                          disabled={savingId === r.id}
                        >
                          Send reply
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => respond(r.id, true)}
                          disabled={savingId === r.id}
                        >
                          Reply & resolve
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default SupportRequests;
