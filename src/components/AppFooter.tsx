import { Button } from "@/components/ui/button";
import { Mail, Facebook, X, Instagram, Linkedin, Youtube, Music } from "lucide-react";
import { useAyrshareProfiles } from "@/hooks/useAyrshareProfiles";
import { Link } from "react-router-dom";

const platformIcons = {
  facebook: Facebook,
  x: X,
  twitter: X,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music,
};

const defaultUrls: Record<string, string> = {
  facebook: "https://facebook.com/matchplay",
  x: "https://x.com/matchplay",
  twitter: "https://twitter.com/matchplay",
  instagram: "https://instagram.com/matchplay",
  linkedin: "https://linkedin.com/company/matchplay",
  youtube: "https://youtube.com/@matchplay",
  tiktok: "https://tiktok.com/@matchplay",
};

const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  const { connectedPlatforms, loading } = useAyrshareProfiles();
  
  // Load platform URLs from localStorage, fallback to defaults
  const platformUrls: Record<string, string> = JSON.parse(
    localStorage.getItem("platformUrls") || JSON.stringify(defaultUrls)
  );

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-8">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Copyright */}
          <div className="text-sm text-muted-foreground">
            © {currentYear} MatchPlay. All rights reserved.
          </div>

          {/* Legal Links */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/terms">Terms of Service</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="mailto:support@match-play.co" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Support
              </a>
            </Button>
          </div>

          {/* Social Links - Connected via Ayrshare */}
          <div className="flex items-center gap-2">
            {!loading && connectedPlatforms.map((platform) => {
              const platformLower = platform.toLowerCase();
              const Icon = platformIcons[platformLower as keyof typeof platformIcons];
              const url = platformUrls[platformLower];
              
              if (!Icon || !url) return null;
              
              return (
                <Button key={platform} variant="ghost" size="icon" asChild>
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    aria-label={platform}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
