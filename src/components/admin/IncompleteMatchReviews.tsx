import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Clock, Users, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { useIncompleteMatchReviews } from "@/hooks/useIncompleteMatchReviews";
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

export function IncompleteMatchReviews() {
  const { reviews, loading, resolveReview } = useIncompleteMatchReviews();
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [decision, setDecision] = useState<'forfeit_incomplete' | 'cancel_match' | null>(null);

  const handleResolve = async () => {
    if (!selectedReview || !decision) return;

    const success = await resolveReview(selectedReview, decision, adminNotes);
    if (success) {
      setSelectedReview(null);
      setAdminNotes("");
      setDecision(null);
    }
  };

  const openDialog = (reviewId: string, decisionType: 'forfeit_incomplete' | 'cancel_match') => {
    setSelectedReview(reviewId);
    setDecision(decisionType);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Incomplete Match Reviews</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Incomplete Match Reviews
          </CardTitle>
          <CardDescription>
            Matches that exceeded the 24-hour completion deadline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No incomplete matches pending review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => {
                const hoursOverdue = Math.floor(
                  (new Date().getTime() - new Date(review.match_started_at).getTime()) / (1000 * 60 * 60)
                );

                return (
                  <Card key={review.id} className="border-2 border-destructive/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {review.match?.course_name || 'Unknown Course'}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {hoursOverdue}h overdue
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              ${((review.match?.buy_in_amount || 0) / 100).toFixed(2)} buy-in
                            </span>
                          </CardDescription>
                        </div>
                        <Badge variant="destructive">Pending Review</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Incomplete Players */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-destructive" />
                          Incomplete Players ({review.incomplete_players.length})
                        </h4>
                        <div className="bg-destructive/10 rounded-lg p-3 space-y-2">
                          {review.incomplete_players.map((player: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="font-medium">{player.display_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {player.holes_completed}/18 holes
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Completed Players */}
                      {review.completed_players.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-success" />
                            Completed Players ({review.completed_players.length})
                          </h4>
                          <div className="bg-success/10 rounded-lg p-3 space-y-2">
                            {review.completed_players.map((player: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="font-medium">{player.display_name}</span>
                                <Badge variant="outline" className="text-xs">
                                  18/18 holes
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admin Actions */}
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          onClick={() => openDialog(review.id, 'forfeit_incomplete')}
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Forfeit Incomplete
                        </Button>
                        <Button
                          onClick={() => openDialog(review.id, 'cancel_match')}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Cancel Match
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === 'forfeit_incomplete' ? 'Forfeit Incomplete Players' : 'Cancel Match'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                {decision === 'forfeit_incomplete'
                  ? 'This will mark incomplete players as forfeited. They will lose their buy-ins and be ineligible for winnings.'
                  : 'This will cancel the entire match and mark all participants as left.'}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Admin Notes (Optional)
                </label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about this decision..."
                  rows={3}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolve} className="bg-destructive text-destructive-foreground">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
