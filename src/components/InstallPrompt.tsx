import { useState, useEffect } from "react";
import { X, Share, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

interface InstallPromptProps {
  forceShow?: boolean;
  onDismiss?: () => void;
}

export const InstallPrompt = ({ forceShow = false, onDismiss }: InstallPromptProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Force show overrides dismissal check
    if (forceShow && isMobile) {
      setIsVisible(true);
      return;
    }

    // Check if already dismissed (only when not forced)
    const dismissed = localStorage.getItem("installPromptDismissed");
    if (dismissed) {
      setIsVisible(false);
      return;
    }

    // Show prompt on mobile only
    if (isMobile) {
      setIsVisible(true);
    }
  }, [isMobile, forceShow]);

  const handleDismiss = () => {
    localStorage.setItem("installPromptDismissed", "true");
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <Card className="mb-6 p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            📱 Install MatchPlay
          </h3>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mb-2">
              Tap <Share className="w-3 h-3 inline mx-1" /> then scroll down and tap{" "}
              <span className="inline-flex items-center gap-1 font-medium">
                <Plus className="w-3 h-3" />
                Add to Home Screen
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-2">
              Tap <MoreVertical className="w-3 h-3 inline mx-1" /> menu, then tap{" "}
              <span className="font-medium">Install app</span> or{" "}
              <span className="font-medium">Add to Home Screen</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Quick access to your matches anytime!
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
