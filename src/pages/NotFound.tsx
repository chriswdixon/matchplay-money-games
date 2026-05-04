import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-6xl font-bold tracking-tight text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">
          The page you're looking for can't be found.
        </p>
        <Button asChild className="rounded-full">
          <a href="/">Return Home</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
