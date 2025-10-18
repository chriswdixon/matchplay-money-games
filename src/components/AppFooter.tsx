import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Facebook, X, Instagram, Linkedin, Youtube, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SocialLink {
  platform: string;
  url: string;
  is_active: boolean;
}

const platformIcons = {
  facebook: Facebook,
  x: X,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music,
};

const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const fetchSocialLinks = async () => {
    const { data } = await supabase
      .from('social_links')
      .select('platform, url, is_active')
      .eq('is_active', true)
      .order('display_order');
    
    if (data) {
      setSocialLinks(data);
    }
  };

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
              <a href="mailto:support@match-play.co" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Support
              </a>
            </Button>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2">
            {socialLinks.map((link) => {
              const Icon = platformIcons[link.platform as keyof typeof platformIcons];
              return (
                <Button key={link.platform} variant="ghost" size="icon" asChild>
                  <a 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    aria-label={link.platform}
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
