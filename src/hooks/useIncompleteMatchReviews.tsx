import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface IncompleteMatchReview {
  id: string;
  match_id: string;
  flagged_at: string;
  match_started_at: string;
  incomplete_players: any[];
  completed_players: any[];
  status: string;
  admin_decision?: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  match?: {
    course_name: string;
    scheduled_time: string;
    buy_in_amount: number;
  };
}

export function useIncompleteMatchReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<IncompleteMatchReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchReviews = async () => {
      const { data: reviewsData, error } = await supabase
        .from('incomplete_match_reviews' as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching incomplete match reviews:', error);
        toast({
          title: "Error",
          description: "Failed to load incomplete match reviews",
          variant: "destructive"
        });
        return;
      }

      // Fetch related match data
      const enrichedReviews = await Promise.all(
        (reviewsData || []).map(async (review: any) => {
          const { data: matchData } = await supabase
            .from('matches')
            .select('course_name, scheduled_time, buy_in_amount')
            .eq('id', review.match_id)
            .single();

          return {
            ...review,
            match: matchData
          } as IncompleteMatchReview;
        })
      );

      setReviews(enrichedReviews);
      setLoading(false);
    };

    fetchReviews();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('incomplete_match_reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incomplete_match_reviews'
        },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const resolveReview = async (
    reviewId: string,
    decision: 'forfeit_incomplete' | 'cancel_match',
    adminNotes?: string
  ) => {
    const { data, error } = await supabase.rpc('admin_resolve_incomplete_match' as any, {
      p_review_id: reviewId,
      p_decision: decision,
      p_admin_notes: adminNotes || null
    });

    if (error) {
      console.error('Error resolving review:', error);
      toast({
        title: "Error",
        description: "Failed to resolve review. Please try again.",
        variant: "destructive"
      });
      return false;
    }

    const result = data as any;
    
    toast({
      title: "Review Resolved",
      description: decision === 'forfeit_incomplete' 
        ? "Incomplete players have forfeited their buy-ins."
        : "Match has been cancelled.",
    });

    setReviews(prev => prev.filter(r => r.id !== reviewId));
    return true;
  };

  return {
    reviews,
    loading,
    resolveReview
  };
}
