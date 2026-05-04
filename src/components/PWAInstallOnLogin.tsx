import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "tyche-pwa-install-prompted";

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true);

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream;

export function PWAInstallOnLogin() {
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  // Capture the install prompt event whenever the browser fires it.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Show the dialog after sign-in (once per device).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event !== "SIGNED_IN") return;
        if (isStandalone()) return;
        if (localStorage.getItem(STORAGE_KEY) === "1") return;

        const ios = isIOS();
        if (!deferredPrompt && !ios) return; // browser doesn't support install

        setShowIos(ios && !deferredPrompt);
        // Slight delay so it doesn't collide with redirect/loading UI.
        setTimeout(() => setOpen(true), 600);
      }
    );
    return () => subscription.unsubscribe();
  }, [deferredPrompt]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      setDeferredPrompt(null);
    }
    dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showIos ? (
              <Smartphone className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Download className="w-5 h-5" aria-hidden="true" />
            )}
            Install Tyche
          </DialogTitle>
          <DialogDescription>
            {showIos
              ? "Add Tyche to your iPhone Home Screen for the best experience."
              : "Install Tyche on your device for faster access and a full-screen experience."}
          </DialogDescription>
        </DialogHeader>

        {showIos ? (
          <ol className="list-decimal list-inside space-y-2 text-sm pt-2">
            <li>Tap the Share icon in Safari's toolbar.</li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> in the top-right corner.
            </li>
          </ol>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          {!showIos && (
            <Button onClick={install}>
              <Download className="w-4 h-4 mr-2" />
              Install app
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PWAInstallOnLogin;
