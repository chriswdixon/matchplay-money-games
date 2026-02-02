import { useGeoBlocking } from "@/hooks/useGeoBlocking";
import { AlertTriangle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const GeoBlockingOverlay = () => {
  const { isBlocked, isLoading, state, stateCode, blockedStates } = useGeoBlocking();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying your location...</p>
        </div>
      </div>
    );
  }

  if (!isBlocked) {
    return null;
  }

  // State-based blocking
  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4 overflow-auto">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Service Unavailable in Your Region</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Detected Location: {state || 'Unknown'}</span>
            </div>
            <p className="text-muted-foreground">
              We apologize, but our skill-based competitive gaming platform is not currently 
              available in {state || 'your state'} due to local regulations regarding skill-based 
              competition with entry fees.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Why is this service restricted?</h3>
            <p className="text-sm text-muted-foreground">
              Different states have varying regulations regarding skill-based competitions 
              with entry fees and prizes. To ensure full compliance with all applicable laws, 
              we have restricted access in states where the regulatory landscape is unclear 
              or where additional licensing may be required.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Currently Restricted States</h3>
            <div className="flex flex-wrap gap-2">
              {blockedStates.map((blockedState) => (
                <span 
                  key={blockedState.state_code} 
                  className={`text-xs px-2 py-1 rounded-full ${
                    blockedState.state_code === stateCode 
                      ? 'bg-destructive/20 text-destructive font-medium' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {blockedState.state_name}
                </span>
              ))}
            </div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error or you have questions about availability 
              in your area, please contact our support team.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@matchplay.golf">Contact Support</a>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This restriction is based on your IP address location. We regularly review 
            and update our service availability as regulations evolve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
