import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Subtle full-page scroll indicator:
 *  - A thin progress bar pinned to the top reflects how far the user has scrolled.
 *  - A faint "more below" chevron in the bottom-right pulses while there's still
 *    content beneath the viewport, then fades out near the bottom.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    let frame = 0;
    const compute = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const y = window.scrollY || doc.scrollTop;
      const pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      setProgress(pct);
      setAtBottom(max > 0 && max - y < 8);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const showHint = progress > 0.02 && !atBottom;

  return (
    <>
      {/* Top progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 z-[60] pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="h-full bg-gradient-to-r from-primary via-primary-glow to-accent shadow-[0_0_8px_hsl(var(--primary)/0.6)] transition-[width] duration-150 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Continue-scrolling hint (appears once you're past the hero, hides at bottom) */}
      <div
        className={`fixed bottom-4 right-4 z-[55] pointer-events-none transition-opacity duration-300 ${
          showHint ? "opacity-80" : "opacity-0"
        }`}
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-full bg-foreground/70 text-background backdrop-blur-sm shadow-md">
          <ChevronDown className="w-4 h-4 animate-bounce-10" />
          <span className="text-[10px] font-medium leading-none">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    </>
  );
}

export default ScrollProgress;
