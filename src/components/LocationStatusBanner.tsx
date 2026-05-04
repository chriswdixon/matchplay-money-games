import { AlertCircle, MapPin, ShieldAlert, WifiOff, Lock, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { LocationError } from "@/hooks/useLocation";

interface LocationStatusBannerProps {
  error: LocationError | null;
  loading?: boolean;
  onRetry?: () => void;
  className?: string;
}

type Detail = {
  title: string;
  description: string;
  steps: string[];
  Icon: typeof AlertCircle;
  variant: "default" | "destructive";
  retryLabel?: string;
};

const isInsecureContext = (): boolean => {
  if (typeof window === "undefined") return false;
  // Geolocation requires HTTPS (or localhost). isSecureContext handles both.
  return window.isSecureContext === false;
};

const detectIOS = () =>
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream;

const detectAndroid = () =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

// True when the page is launched as an installed PWA (added to Home Screen)
// rather than inside the regular mobile browser. iOS and Android each store
// the location permission against the installed app, not the browser.
const isStandalonePWA = (): boolean => {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari exposes navigator.standalone for home-screen apps
  const iosStandalone = (window.navigator as any).standalone === true;
  return Boolean(displayMode || iosStandalone);
};

function getDetail(error: LocationError): Detail {
  const ios = detectIOS();
  const android = detectAndroid();
  const pwa = isStandalonePWA();

  // Insecure context overrides everything — no permission prompt is even possible.
  if (isInsecureContext()) {
    return {
      Icon: Lock,
      variant: "destructive",
      title: "Location requires a secure connection",
      description:
        "Your browser blocks location access on non-HTTPS pages.",
      steps: [
        "Open this site using https:// instead of http://",
        "If you're using a custom domain, ensure SSL is enabled.",
      ],
    };
  }

  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return {
        Icon: ShieldAlert,
        variant: "destructive",
        title: "Location access denied",
        description:
          "We can't read your location because permission was blocked for this site.",
        steps: ios
          ? pwa
            ? [
                "Open iOS Settings → Privacy & Security → Location Services (must be ON).",
                "Scroll down to Tyche and set Location to While Using the App.",
                "Return to Tyche and tap Try again.",
              ]
            : [
                "Open iOS Settings → Privacy & Security → Location Services (must be ON).",
                "Settings → Safari → Location → set to Ask or Allow.",
                "Return to this tab, fully reload the page, then try again.",
              ]
          : android
          ? pwa
            ? [
                "Open Android Settings → Apps → Tyche → Permissions → Location.",
                "Set to Allow only while using the app.",
                "Reopen Tyche and tap Try again.",
              ]
            : [
                "Tap the lock/info icon in the address bar.",
                "Set Location to Allow for this site.",
                "Reload the page and try again.",
              ]
          : [
              "Click the lock icon in your browser's address bar.",
              "Set Location permission to Allow.",
              "Reload the page and try again.",
            ],
        retryLabel: "Try again",
      };

    case 2: // POSITION_UNAVAILABLE
      return {
        Icon: WifiOff,
        variant: "default",
        title: "Location currently unavailable",
        description:
          "Your device couldn't determine where you are right now.",
        steps: [
          ios
            ? "Make sure Location Services is ON (Settings → Privacy & Security → Location Services)."
            : "Make sure your device's location/GPS is turned on.",
          "Move near a window or outdoors for a better GPS signal.",
          "Check that you're connected to Wi‑Fi or cellular data.",
          "Disable any VPN that might be blocking location lookup.",
        ],
        retryLabel: "Try again",
      };

    case 3: // TIMEOUT
      return {
        Icon: AlertCircle,
        variant: "default",
        title: "Location request timed out",
        description:
          "We waited but didn't receive a position from your device.",
        steps: [
          "Check your internet connection.",
          "Step outside or near a window for a stronger GPS signal.",
          "Close other apps that may be using GPS, then retry.",
        ],
        retryLabel: "Try again",
      };

    case 0:
    default:
      return {
        Icon: Info,
        variant: "default",
        title: "Location not supported",
        description:
          error.message ||
          "Your browser doesn't support location access.",
        steps: [
          "Try a modern browser like Safari, Chrome, or Firefox.",
          "Make sure your browser is up to date.",
        ],
      };
  }
}

export const LocationStatusBanner = ({
  error,
  loading,
  onRetry,
  className,
}: LocationStatusBannerProps) => {
  // Surface insecure-context warning even before a request is made.
  if (!error && isInsecureContext()) {
    return (
      <Alert variant="destructive" className={className} role="alert">
        <Lock className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Location requires HTTPS</AlertTitle>
        <AlertDescription>
          This page isn't served over a secure connection, so your browser
          will block location access. Please reload using https://.
        </AlertDescription>
      </Alert>
    );
  }

  if (!error) return null;

  const detail = getDetail(error);
  const { Icon } = detail;

  return (
    <Alert variant={detail.variant} className={className} role="alert" aria-live="polite">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{detail.title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{detail.description}</p>
        <ul className="list-disc pl-5 text-sm space-y-1">
          {detail.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        {onRetry && detail.retryLabel && (
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={loading}
            >
              <MapPin className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {loading ? "Locating…" : detail.retryLabel}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default LocationStatusBanner;
