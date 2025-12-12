import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Download, 
  Trash2, 
  Shield, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  FileJson
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const GDPRSettings = () => {
  const { user } = useAuth();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletionRequested, setDeletionRequested] = useState(false);

  const handleExportData = async () => {
    if (!user) {
      toast.error("Please log in to export your data");
      return;
    }

    setExportLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('export-user-data', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Create and download the JSON file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { 
        type: 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matchplay-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Record consent for data export
      await supabase.from('consent_records').insert({
        user_id: user.id,
        consent_type: 'data_export',
        consented: true,
        user_agent: navigator.userAgent,
        version: '1.0',
      });

      toast.success("Data export downloaded successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!user) {
      toast.error("Please log in to request account deletion");
      return;
    }

    setDeleteLoading(true);
    try {
      // Check for existing pending request
      const { data: existingRequest } = await supabase
        .from('account_deletion_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequest) {
        toast.error("You already have a pending deletion request");
        setDeleteLoading(false);
        return;
      }

      // Create deletion request
      const { error } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id: user.id,
          reason: deleteReason || null,
        });

      if (error) throw error;

      // Record consent
      await supabase.from('consent_records').insert({
        user_id: user.id,
        consent_type: 'deletion_request',
        consented: true,
        user_agent: navigator.userAgent,
        version: '1.0',
      });

      setDeletionRequested(true);
      toast.success("Account deletion request submitted. We'll process it within 30 days.");
    } catch (error) {
      console.error("Deletion request error:", error);
      toast.error("Failed to submit deletion request. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Rights Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Your Data Rights
          </CardTitle>
          <CardDescription>
            Under GDPR and CCPA, you have the right to access, export, and delete your personal data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Right to Access</h4>
              <p className="text-sm text-muted-foreground">
                View all personal data we hold about you.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Right to Portability</h4>
              <p className="text-sm text-muted-foreground">
                Export your data in a machine-readable format.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Right to Erasure</h4>
              <p className="text-sm text-muted-foreground">
                Request deletion of your personal data.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Right to Rectification</h4>
              <p className="text-sm text-muted-foreground">
                Correct inaccurate data via your profile settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a complete copy of your personal data in JSON format.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Download className="h-4 w-4" />
            <AlertDescription>
              Your export will include: profile information, match history, scores, 
              transactions, ratings, and consent records.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleExportData} 
            disabled={exportLoading}
            className="w-full sm:w-auto"
          >
            {exportLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing Export...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download My Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Your Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deletionRequested ? (
            <Alert className="bg-primary/10 border-primary">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription>
                Your deletion request has been submitted. We'll process it within 30 days 
                and send confirmation to your email address.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This action is irreversible. All your data 
                  including match history, scores, and account balance will be permanently deleted.
                  Any pending payouts will be processed before deletion.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="delete-reason">Reason for leaving (optional)</Label>
                  <Textarea
                    id="delete-reason"
                    placeholder="Help us improve by sharing why you're leaving..."
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled={deleteLoading}
                      className="w-full sm:w-auto"
                    >
                      {deleteLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Request Account Deletion
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          This will permanently delete your MatchPlay account and all associated data including:
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Your profile and personal information</li>
                          <li>Match history and scores</li>
                          <li>Transaction records</li>
                          <li>Any remaining account balance (processed before deletion)</li>
                        </ul>
                        <p className="font-medium">
                          This action cannot be undone.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteRequest}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, Delete My Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Privacy Links */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <a 
              href="/privacy" 
              className="text-primary hover:underline"
            >
              Privacy Policy
            </a>
            <a 
              href="/terms" 
              className="text-primary hover:underline"
            >
              Terms of Service
            </a>
            <a 
              href="mailto:privacy@match-play.co" 
              className="text-primary hover:underline"
            >
              Contact Privacy Team
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
