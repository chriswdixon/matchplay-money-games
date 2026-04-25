import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import defaultThumb from "@/assets/hero-golf-course.jpg?format=webp&quality=80";

interface CourseImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  containerClassName?: string;
}

/**
 * Graceful image with blur-up + skeleton + icon fallback if both sources fail.
 */
const CourseImage = ({
  src,
  alt,
  fallbackSrc = defaultThumb,
  className,
  containerClassName,
  ...rest
}: CourseImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [usingFallback, setUsingFallback] = useState(!src);

  const currentSrc = !src || usingFallback ? fallbackSrc : src;

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-muted", containerClassName)}>
      {!loaded && !errored && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted"
          aria-hidden="true"
        />
      )}
      {errored ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <ImageOff className="w-6 h-6 opacity-60" />
        </div>
      ) : (
        <img
          {...rest}
          src={currentSrc}
          alt={alt}
          loading={rest.loading || "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!usingFallback) {
              setUsingFallback(true);
            } else {
              setErrored(true);
              setLoaded(true);
            }
          }}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            className,
          )}
        />
      )}
    </div>
  );
};

export default CourseImage;
