import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface DeletionRequest {
  id: string;
  user_id: string;
  reason: string | null;
  status: string;
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export const DeletionRequestReviews = () => {
  const queryClient = useQueryClient();
  const [processingNotes, setProcessingNotes] = useState<Record<string, string>>({});

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin-deletion-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data as DeletionRequest[];
    }
  });

  const { data: userProfiles } = useQuery({
    queryKey: ['admin-user-profiles-for-deletion'],
    queryFn: async () => {
      if (!requests?.length) return {};
      
      const userIds = requests.map(r => r.user_id);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', userIds);
      
      if (error) throw error;
      
      return (data || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {} as Record<string, typeof data[0]>);
    },
    enabled: !!requests?.length
  });

  const processRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('account_deletion_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: user.id
        })
        .eq('id', requestId);

      if (error) throw error;

      // If approved, we would trigger the actual deletion process here
      // This could be an edge function that handles the GDPR deletion
      if (action === 'approve') {
        // Log the action for audit purposes
        await supabase.from('admin_access_log').insert({
          admin_user_id: user.id,
          action: 'deletion_request_approved',
          accessed_table: 'account_deletion_requests',
          accessed_user_id: requests?.find(r => r.id === requestId)?.user_id,
          metadata: { request_id: requestId }
        });
      }
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests'] });
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to process request: ${error.message}`);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="gap-1">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUserDisplay = (userId: string) => {
    const profile = userProfiles?.[userId];
    if (!profile) return userId.slice(0, 8) + '...';
    return profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || userId.slice(0, 8);
  };

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const processedRequests = requests?.filter(r => r.status !== 'pending') || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Account Deletion Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Account Deletion Requests
        </CardTitle>
        <CardDescription>
          Review and process GDPR account deletion requests
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pending Requests */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Pending Requests ({pendingRequests.length})
          </h3>
          
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending deletion requests</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{getUserDisplay(request.user_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        Requested: {format(new Date(request.requested_at), 'PPp')}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  {request.reason && (
                    <div className="bg-muted/50 rounded p-3">
                      <p className="text-sm font-medium mb-1">Reason:</p>
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => processRequestMutation.mutate({ requestId: request.id, action: 'approve' })}
                      disabled={processRequestMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve Deletion
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => processRequestMutation.mutate({ requestId: request.id, action: 'reject' })}
                      disabled={processRequestMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Processed Requests */}
        {processedRequests.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Processed Requests</h3>
            <div className="space-y-2">
              {processedRequests.slice(0, 10).map((request) => (
                <div key={request.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <p className="font-medium">{getUserDisplay(request.user_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.processed_at ? format(new Date(request.processed_at), 'PPp') : 'N/A'}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
