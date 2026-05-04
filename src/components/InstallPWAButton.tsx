import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
};

const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

interface Props {
  className?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "icon";
}

export function InstallPWAButton({ className, variant = "outline", size = "icon" }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const canPrompt = !!deferredPrompt;
  const showIosFallback = !canPrompt && isIOS();

  // Hide entirely if neither path is available (e.g. desktop browser without install support)
  if (!canPrompt && !showIosFallback) return null;

  const handleClick = async () => {
    if (canPrompt && deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      setDeferredPrompt(null);
      return;
    }
    if (showIosFallback) {
      setIosSheetOpen(true);
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={handleClick}
              aria-label="Install Tyche app"
              className={className}
            >
              <Download className="h-4 w-4" />
              {size !== "icon" && <span className="ml-2">Install app</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Install Tyche app</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={iosSheetOpen} onOpenChange={setIosSheetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" aria-hidden="true" />
              Install Tyche on iPhone
            </DialogTitle>
            <DialogDescription>
              iOS doesn't show an automatic install prompt. Add Tyche to your Home Screen in 3 steps:
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal list-inside space-y-2 text-sm pt-2">
            <li>Tap the Share icon in Safari's toolbar.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong> in the top-right corner.</li>
          </ol>
          <p className="text-xs text-muted-foreground pt-2">
            Tyche will then launch like a native app, full-screen.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InstallPWAButton;
