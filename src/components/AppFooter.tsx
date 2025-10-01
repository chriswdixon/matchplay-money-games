import { Button } from "@/components/ui/button";
import { Mail, Facebook, X, Instagram, Linkedin } from "lucide-react";

const AppFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-8">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Copyright */}
          <div className="text-sm text-muted-foreground">
            © {currentYear} MatchPlay. All rights reserved.
          </div>

          {/* Support */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="mailto:support@matchplay.com" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Support
              </a>
            </Button>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X">
                <X className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <Linkedin className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
