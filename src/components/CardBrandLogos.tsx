interface CardBrandLogosProps {
  className?: string;
  /** Visual size of each card tile in pixels. Defaults to a compact 38x24. */
  size?: "sm" | "md";
}

/**
 * Accessible, self-contained card brand logos (Visa, Mastercard, American
 * Express, Discover) rendered as inline SVG so they need no network fetch and
 * scale crisply. Used in pricing / payment reassurance areas.
 */
export function CardBrandLogos({ className, size = "md" }: CardBrandLogosProps) {
  const dims = size === "sm" ? { w: 32, h: 20 } : { w: 40, h: 26 };

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-2 ${className ?? ""}`}
      aria-label="Accepted card brands: Visa, Mastercard, American Express, Discover"
    >
      <li>
        <Tile label="Visa" w={dims.w} h={dims.h}>
          <rect width="40" height="26" rx="4" fill="#1A1F71" />
          <text
            x="20"
            y="17.5"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="11"
            fontStyle="italic"
            fontWeight="700"
            letterSpacing="0.5"
            fill="#FFFFFF"
          >
            VISA
          </text>
        </Tile>
      </li>
      <li>
        <Tile label="Mastercard" w={dims.w} h={dims.h}>
          <rect width="40" height="26" rx="4" fill="#252525" />
          <circle cx="17" cy="13" r="7" fill="#EB001B" />
          <circle cx="24" cy="13" r="7" fill="#F79E1B" />
          <path
            d="M20.5 7.6a7 7 0 0 0 0 10.8 7 7 0 0 0 0-10.8Z"
            fill="#FF5F00"
          />
        </Tile>
      </li>
      <li>
        <Tile label="American Express" w={dims.w} h={dims.h}>
          <rect width="40" height="26" rx="4" fill="#1F72CD" />
          <text
            x="20"
            y="16"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="6.5"
            fontWeight="700"
            letterSpacing="0.3"
            fill="#FFFFFF"
          >
            AMEX
          </text>
        </Tile>
      </li>
      <li>
        <Tile label="Discover" w={dims.w} h={dims.h}>
          <rect width="40" height="26" rx="4" fill="#FFFFFF" stroke="#E0E0E0" />
          <text
            x="6"
            y="16.5"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="6"
            fontWeight="700"
            fill="#1A1A1A"
          >
            DISC
          </text>
          <circle cx="31" cy="13" r="6.5" fill="#F47216" />
        </Tile>
      </li>
    </ul>
  );
}

function Tile({
  label,
  w,
  h,
  children,
}: {
  label: string;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 40 26"
      role="img"
      aria-label={label}
      className="rounded-[4px] shadow-sm"
    >
      <title>{label}</title>
      {children}
    </svg>
  );
}

export default CardBrandLogos;
