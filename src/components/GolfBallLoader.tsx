import tycheLogo from "@/assets/tyche-logo-green.svg";

interface GolfBallLoaderProps {
  label?: string;
  size?: number;
  className?: string;
  showBrand?: boolean;
}

const GolfBallLoader = ({
  label = "Loading...",
  size = 56,
  className = "",
  showBrand = false,
}: GolfBallLoaderProps) => {
  // Hex-packed dimple grid – realistic golf ball pattern
  const dimples: Array<[number, number, number]> = [];
  const spacing = 7;
  const rows = 9;
  const cols = 9;
  const cx = 32;
  const cy = 32;
  const ballR = 26;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * spacing + (r % 2 ? spacing / 2 : 0);
      const y = (r - (rows - 1) / 2) * (spacing * 0.866);
      const d = Math.hypot(x, y);
      if (d > ballR - 5) continue;
      const t = 1 - d / ballR;
      const radius = 1.1 + t * 0.9;
      dimples.push([cx + x, cy + y, radius]);
    }
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {showBrand && (
        <>
          <img
            src={tycheLogo}
            alt="Tyche"
            className="h-12 w-auto mb-1"
            style={{ maxWidth: "180px" }}
          />
          <p
            className="text-success text-lg tracking-wide mb-1"
            style={{
              fontFamily: "'Inter Tight', Inter, system-ui, sans-serif",
              fontWeight: 800,
            }}
          >
            Match. Play. WIN.
          </p>
        </>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className="animate-spin"
        style={{ animationDuration: "1.4s" }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="ball-shade" cx="38%" cy="34%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f3f4f6" />
            <stop offset="100%" stopColor="#d1d5db" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={ballR} fill="url(#ball-shade)" stroke="hsl(var(--success))" strokeWidth="2.5" />
        {dimples.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#9ca3af" opacity="0.45" />
        ))}
        <ellipse cx="24" cy="22" rx="6" ry="3.5" fill="#ffffff" opacity="0.55" />
        <path
          d="M32 4 a28 28 0 0 1 24 14"
          fill="none"
          stroke="hsl(var(--success))"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <span className="text-sm font-medium text-muted-foreground animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};

export default GolfBallLoader;
