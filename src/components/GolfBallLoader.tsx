interface GolfBallLoaderProps {
  label?: string;
  size?: number;
  className?: string;
}

const GolfBallLoader = ({ label = "Loading...", size = 48, className = "" }: GolfBallLoaderProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className="animate-spin"
        style={{ animationDuration: "1.6s" }}
        aria-hidden="true"
      >
        {/* Ball */}
        <circle cx="32" cy="32" r="26" fill="#ffffff" stroke="hsl(var(--success))" strokeWidth="3" />
        {/* Dimples */}
        {[
          [22, 22], [32, 20], [42, 22],
          [18, 32], [32, 32], [46, 32],
          [22, 42], [32, 44], [42, 42],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.8" fill="hsl(var(--success))" opacity="0.35" />
        ))}
        {/* Spinning arc accent */}
        <path
          d="M32 6 a26 26 0 0 1 22 13"
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
