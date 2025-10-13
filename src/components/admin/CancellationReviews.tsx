import { useState } from "react";
import { useCancellationReviews } from "@/hooks/useCancellationReviews";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const REASON_LABELS: Record<string, string> = {
  'lightning': 'Lightning/Severe Weather',
  'rain': 'Heavy Rain',
  'temperature': 'Extreme Temperature',
  'course-closure': 'Course Closure',
  'wildlife': 'Wildlife Hazard',
  'equipment': 'Equipment Failure',
  'injury': 'Personal Injury',
  'emergency': 'Emergency',
  'other': 'Other'
};

export function CancellationReviews() {
  const { reviews, loading, resolveReview } = useCancellationReviews();
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [decision, setDecision] = useState<'approve_stated' | 'approve_disputed' | 'deny'>('approve_stated');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentReview = reviews.find(r => r.id === selectedReview);

  const handleResolve = async () => {
    if (!selectedReview) return;

    setSubmitting(true);
    const success = await resolveReview(selectedReview, decision, adminNotes);
    
    if (success) {
      setSelectedReview(null);
      setDecision('approve_stated');
      setAdminNotes('');
    }
    
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Match Cancellation Reviews</CardTitle>
          <CardDescription>No pending reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All match cancellations have been processed. New reviews will appear here when players dispute cancellation reasons.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Match Cancellation Reviews</h2>
          <p className="text-muted-foreground">
            Review disputed match cancellations and approve refunds
          </p>
        </div>

        {reviews.map((review) => (
          <Card key={review.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {review.match?.course_name || 'Match'}
                  </CardTitle>
                  <CardDescription>
                    Scheduled: {review.match?.scheduled_time 
                      ? format(new Date(review.match.scheduled_time), 'PPp')
                      : 'Unknown'}
                  </CardDescription>
                </div>
                <Badge variant="destructive">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Disputed
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <div>
                  <p className="text-sm font-medium">Cancelling Player:</p>
                  <p className="text-sm text-muted-foreground">
                    {review.cancelling_player?.display_name || 'Unknown'}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium">Stated Reason:</p>
                  <p className="text-sm text-muted-foreground">
                    {REASON_LABELS[review.stated_reason] || review.stated_reason}
                  </p>
                </div>

                {review.disputed && review.dispute_reasons && (
                  <div>
                    <p className="text-sm font-medium mb-2">Disputed By:</p>
                    <div className="space-y-2">
                      {Array.isArray(review.dispute_reasons) && review.dispute_reasons.map((dispute: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 bg-muted rounded">
                          <p className="font-medium">Player's Alternate Reason:</p>
                          <p className="text-muted-foreground">{dispute.alternate_reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium">Buy-in Amount:</p>
                  <p className="text-sm text-muted-foreground">
                    ${((review.match?.buy_in_amount || 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => setSelectedReview(review.id)}
                className="w-full"
              >
                Review & Resolve
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Cancellation Review</DialogTitle>
            <DialogDescription>
              Choose how to handle this disputed cancellation
            </DialogDescription>
          </DialogHeader>

          {currentReview && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Match: {currentReview.match?.course_name}</p>
                <p className="text-sm">Player: {currentReview.cancelling_player?.display_name}</p>
                <p className="text-sm">Stated Reason: {REASON_LABELS[currentReview.stated_reason]}</p>
              </div>

              <div className="space-y-3">
                <Label>Decision</Label>
                <RadioGroup value={decision} onValueChange={(val: any) => setDecision(val)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="approve_stated" id="approve_stated" />
                    <Label htmlFor="approve_stated" className="font-normal cursor-pointer">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Approve Stated Reason (Issue refund minus $2 fee)
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="approve_disputed" id="approve_disputed" />
                    <Label htmlFor="approve_disputed" className="font-normal cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-warning" />
                        Side with Disputers (No refund)
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="deny" id="deny" />
                    <Label htmlFor="deny" className="font-normal cursor-pointer">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive" />
                        Deny All Claims (No refund)
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about this decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedReview(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={submitting}
            >
              {submitting ? "Processing..." : "Confirm Resolution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
