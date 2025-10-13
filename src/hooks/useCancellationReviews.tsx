import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface CancellationReview {
  id: string;
  match_id: string;
  cancelling_player_id: string;
  stated_reason: string;
  disputed: boolean;
  dispute_reasons: any;
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
  cancelling_player?: {
    display_name: string;
  };
}

export function useCancellationReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<CancellationReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchReviews = async () => {
      const { data: reviewsData, error } = await supabase
        .from('match_cancellation_reviews' as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching cancellation reviews:', error);
        toast({
          title: "Error",
          description: "Failed to load cancellation reviews",
          variant: "destructive"
        });
        return;
      }

      // Fetch related data
      const enrichedReviews = await Promise.all(
        (reviewsData || []).map(async (review: any) => {
          const { data: matchData } = await supabase
            .from('matches')
            .select('course_name, scheduled_time, buy_in_amount')
            .eq('id', review.match_id)
            .single();

          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', review.cancelling_player_id)
            .single();

          return {
            ...review,
            match: matchData,
            cancelling_player: profileData
          } as CancellationReview;
        })
      );

      setReviews(enrichedReviews);
      setLoading(false);
    };

    fetchReviews();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('cancellation_reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_cancellation_reviews'
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
    decision: 'approve_stated' | 'approve_disputed' | 'deny',
    adminNotes?: string
  ) => {
    const { data, error } = await supabase.rpc('admin_resolve_cancellation_review' as any, {
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
      description: result?.refund_processed 
        ? `Review resolved. Refund of $${((result.refund_amount || 0) / 100).toFixed(2)} processed.`
        : "Review resolved. No refund issued.",
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
