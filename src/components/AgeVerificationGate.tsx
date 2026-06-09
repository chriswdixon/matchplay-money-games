import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePrivateProfile } from "@/hooks/usePrivateProfile";
import { calculateAge } from "@/lib/validation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import GolfBallLoader from "@/components/GolfBallLoader";

// Routes that must stay reachable even before age verification so users can
// read policies, finish auth flows, or complete the email verification link.
// NOTE: keep this list minimal — anything here can be reached WITHOUT passing
// the age gate, so it must never expose authenticated app functionality.
const ALLOWED_PATHS = [
  "/auth",
  "/verify",
  "/verify-age",
  "/terms",
  "/privacy",
  "/faq",
];

/**
 * AgeVerificationGate WRAPS the entire application. For an authenticated user
 * who has not confirmed they are 18+, the protected app tree is NOT rendered at
 * all — only the gate UI is. This makes the gate impossible to bypass by
 * removing an overlay element, tabbing behind it, or racing a loading flash:
 * the underlying routes simply do not exist in the DOM until verification
 * succeeds.
 */
export function AgeVerificationGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const {
    privateData,
    loading: privateLoading,
    updatePrivateData,
  } = usePrivateProfile();

  const [attested, setAttested] = useState(false);
  const [dob, setDob] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveDob = privateData?.date_of_birth || dob || "";
  const age = useMemo(
    () => (effectiveDob ? calculateAge(effectiveDob) : null),
    [effectiveDob],
  );

  const onAllowedPath = ALLOWED_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  );

  // Logged-out visitors and essential public routes get the app as normal.
  if (!user || authLoading || onAllowedPath) return <>{children}</>;

  // While resolving the verification state, block the app behind a loader.
  // Rendering the children here would briefly expose protected content, which
  // is exactly the kind of bypass we must prevent.
  if (profileLoading || privateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <GolfBallLoader size={64} showBrand />
      </div>
    );
  }

  // Verified users get full access.
  if (profile?.age_verified) return <>{children}</>;

  // Otherwise: render ONLY the gate. The app tree is never mounted.
  const handleConfirm = async () => {
    setError(null);

    if (!effectiveDob) {
      setError("Please enter your date of birth to continue.");
      return;
    }
    if (age === null || age < 18) {
      setError(
        "You must be at least 18 years old to use Tyche. Access is restricted.",
      );
      return;
    }
    if (!attested) {
      setError("Please confirm that you are at least 18 years old.");
      return;
    }

    setSubmitting(true);
    try {
      // Persist a newly entered date of birth if we didn't have one.
      if (!privateData?.date_of_birth && dob) {
        await updatePrivateData({ date_of_birth: dob });
      }
      const { error: updateError } = await updateProfile({
        age_verified: true,
        age_verified_at: new Date().toISOString(),
      });
      if (updateError) {
        setError("Could not save your verification. Please try again.");
      }
    } catch {
      setError("Could not save your verification. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isUnderage = age !== null && age < 18;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-auto bg-background p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isUnderage ? "bg-destructive/10" : "bg-primary/10"
            }`}
          >
            {isUnderage ? (
              <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
            )}
          </div>
          <CardTitle id="age-gate-title" className="text-2xl">
            {isUnderage ? "Access Restricted" : "Verify Your Age"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {isUnderage ? (
            <p className="text-center text-sm text-muted-foreground">
              You must be at least 18 years old to use Tyche, which hosts
              skill-based competitions with entry fees and prizes. If you believe
              this is an error, please contact support.
            </p>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">
                Tyche hosts skill-based competitions with entry fees and prizes.
                You must confirm you are <strong>18 years of age or older</strong>{" "}
                before you can continue.
              </p>

              {!privateData?.date_of_birth && (
                <div className="space-y-2">
                  <Label htmlFor="age-gate-dob">Date of Birth</Label>
                  <Input
                    id="age-gate-dob"
                    type="date"
                    value={dob}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <Checkbox
                  id="age-gate-attest"
                  checked={attested}
                  onCheckedChange={(v) => setAttested(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="age-gate-attest"
                  className="text-sm font-normal leading-snug text-foreground"
                >
                  I confirm that I am at least 18 years old and the information I
                  provided is accurate.
                </Label>
              </div>
            </>
          )}

          {error && (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="space-y-2">
            {!isUnderage && (
              <Button
                className="w-full bg-gradient-primary"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Confirming…
                  </>
                ) : (
                  "Confirm & Continue"
                )}
              </Button>
            )}
            {isUnderage && (
              <Button variant="outline" asChild className="w-full">
                <a href="mailto:support@match-play.co">Contact Support</a>
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AgeVerificationGate;
