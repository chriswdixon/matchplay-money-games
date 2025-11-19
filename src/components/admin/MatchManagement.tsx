import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertCircle, Users, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Match {
  id: string;
  course_name: string;
  location: string;
  scheduled_time: string;
  status: string;
  format: string;
  buy_in_amount: number;
  max_participants: number;
  created_at: string;
  created_by: string;
}

interface MatchWithParticipants extends Match {
  participant_count: number;
  participants: Array<{
    user_id: string;
    display_name: string;
  }>;
}

export const MatchManagement = () => {
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: matches, isLoading, error } = useQuery({
    queryKey: ['admin-matches'],
    queryFn: async () => {
      console.log('Fetching admin matches...');
      
      // Fetch matches that are open or started (not completed or cancelled)
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['open', 'started'])
        .order('scheduled_time', { ascending: true });

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        throw matchesError;
      }
      
      console.log('Matches fetched:', matchesData?.length || 0);

      // Fetch participant counts and details for each match
      const matchesWithParticipants = await Promise.all(
        (matchesData || []).map(async (match) => {
          const { data: participants, error: participantsError } = await supabase
            .from('match_participants')
            .select('user_id')
            .eq('match_id', match.id)
            .eq('status', 'active');

          if (participantsError) {
            console.error('Error fetching participants:', participantsError);
            throw participantsError;
          }

          // Fetch profile data separately to avoid RLS issues
          const participantsWithProfiles = await Promise.all(
            (participants || []).map(async (p) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', p.user_id)
                .single();
              
              return {
                user_id: p.user_id,
                display_name: profile?.display_name || 'Unknown'
              };
            })
          );

          return {
            ...match,
            participant_count: participants?.length || 0,
            participants: participantsWithProfiles
          };
        })
      );
      
      console.log('Matches with participants:', matchesWithParticipants.length);

      return matchesWithParticipants as MatchWithParticipants[];
    }
  });

  const deleteMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      console.log('Starting match deletion for:', matchId);
      const match = matches?.find(m => m.id === matchId);
      if (!match) throw new Error('Match not found');

      console.log('Match details:', { 
        id: matchId, 
        course: match.course_name, 
        status: match.status,
        created_by: match.created_by 
      });

      // Cancel the match
      const { data: matchUpdate, error: matchError } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', matchId)
        .select();

      console.log('Match update result:', { data: matchUpdate, error: matchError });

      if (matchError) {
        console.error('Failed to update match:', matchError);
        throw new Error(`Failed to cancel match: ${matchError.message}`);
      }

      // Mark all participants as left
      const { data: participantsUpdate, error: participantsError } = await supabase
        .from('match_participants')
        .update({ status: 'left' })
        .eq('match_id', matchId)
        .select();

      console.log('Participants update result:', { data: participantsUpdate, error: participantsError });

      if (participantsError) {
        console.error('Failed to update participants:', participantsError);
        throw new Error(`Failed to update participants: ${participantsError.message}`);
      }

      // Process refunds if there's a buy-in
      if (match.buy_in_amount > 0) {
        const { data: participants } = await supabase
          .from('match_participants')
          .select('user_id')
          .eq('match_id', matchId);

        if (participants && participants.length > 0) {
          const cancellationFee = 200; // $2.00 in cents
          const refundAmount = Math.max(0, match.buy_in_amount - cancellationFee);

          for (const participant of participants) {
            // Get player account
            const { data: account } = await supabase
              .from('player_accounts')
              .select('id, balance')
              .eq('user_id', participant.user_id)
              .single();

            if (account) {
              // Credit refund
              await supabase
                .from('player_accounts')
                .update({ balance: account.balance + refundAmount })
                .eq('id', account.id);

              // Record refund transaction
              await supabase
                .from('account_transactions')
                .insert({
                  user_id: participant.user_id,
                  account_id: account.id,
                  amount: refundAmount,
                  transaction_type: 'match_cancellation',
                  match_id: matchId,
                  description: 'Match cancelled by admin - refund minus $2 cancellation fee'
                });

              // Record cancellation fee if applicable
              if (match.buy_in_amount > cancellationFee) {
                await supabase
                  .from('account_transactions')
                  .insert({
                    user_id: participant.user_id,
                    account_id: account.id,
                    amount: -cancellationFee,
                    transaction_type: 'match_cancellation',
                    match_id: matchId,
                    description: 'Match cancellation fee'
                  });
              }
            }
          }
        }
      }

      // Log admin action
      await supabase
        .from('admin_access_log')
        .insert({
          admin_user_id: (await supabase.auth.getUser()).data.user?.id,
          accessed_table: 'matches',
          action: 'DELETE_MATCH',
          metadata: {
            match_id: matchId,
            course_name: match.course_name,
            participant_count: match.participant_count
          }
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-matches'] });
      toast.success('Match deleted and players refunded');
      setDeleteMatchId(null);
    },
    onError: (error) => {
      console.error('Error deleting match:', error);
      toast.error('Failed to delete match');
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      open: { variant: "default", label: "Open" },
      started: { variant: "secondary", label: "Started" }
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active & Incomplete Matches</CardTitle>
          <CardDescription className="text-destructive">
            Error loading matches: {error instanceof Error ? error.message : 'Unknown error'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Active & Incomplete Matches</CardTitle>
          <CardDescription>
            Manage all open and started matches ({matches?.length || 0} found). Deleting a match will cancel it and refund players minus $2 cancellation fee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!matches || matches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active or incomplete matches found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <Card key={match.id} className="border-l-4 border-l-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{match.course_name}</h3>
                          {getStatusBadge(match.status)}
                          <Badge variant="outline">{match.format}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{match.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{format(new Date(match.scheduled_time), 'PPp')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{match.participant_count}/{match.max_participants} players</span>
                          </div>
                          {match.buy_in_amount > 0 && (
                            <div className="font-medium text-foreground">
                              Buy-in: ${(match.buy_in_amount / 100).toFixed(2)}
                            </div>
                          )}
                        </div>

                        {match.participants.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Participants:</p>
                            <div className="flex flex-wrap gap-1">
                              {match.participants.map((p) => (
                                <Badge key={p.user_id} variant="secondary" className="text-xs">
                                  {p.display_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteMatchId(match.id)}
                        disabled={deleteMatchMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteMatchId !== null} onOpenChange={() => setDeleteMatchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the match and refund all players (minus $2 cancellation fee per player).
              Players will see the refund in their transaction history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMatchId && deleteMatchMutation.mutate(deleteMatchId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
