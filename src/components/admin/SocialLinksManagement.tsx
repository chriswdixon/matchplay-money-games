import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Facebook, X, Instagram, Linkedin, Youtube, Music, Loader2 } from "lucide-react";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  is_active: boolean;
  display_order: number;
}

const platformIcons = {
  facebook: Facebook,
  x: X,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music,
};

const platformNames = {
  facebook: "Facebook",
  x: "X (Twitter)",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export const SocialLinksManagement = () => {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const fetchSocialLinks = async () => {
    try {
      const { data, error } = await supabase
        .from("social_links")
        .select("*")
        .order("display_order");

      if (error) throw error;
      setLinks(data || []);
    } catch (error: any) {
      console.error("Error fetching social links:", error);
      toast({
        title: "Error",
        description: "Failed to load social links",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const link of links) {
        const { error } = await supabase
          .from("social_links")
          .update({
            url: link.url,
            is_active: link.is_active,
          })
          .eq("id", link.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Social links updated successfully",
      });
    } catch (error: any) {
      console.error("Error saving social links:", error);
      toast({
        title: "Error",
        description: "Failed to save social links",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateLink = (id: string, field: keyof SocialLink, value: any) => {
    setLinks(links.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Links</CardTitle>
        <CardDescription>
          Manage social media links displayed in the footer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {links.map((link) => {
          const Icon = platformIcons[link.platform as keyof typeof platformIcons];
          const platformName = platformNames[link.platform as keyof typeof platformNames];

          return (
            <div key={link.id} className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <h3 className="font-semibold">{platformName}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`${link.platform}-active`} className="text-sm">
                    Active
                  </Label>
                  <Switch
                    id={`${link.platform}-active`}
                    checked={link.is_active}
                    onCheckedChange={(checked) => 
                      updateLink(link.id, "is_active", checked)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${link.platform}-url`}>URL</Label>
                <Input
                  id={`${link.platform}-url`}
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(link.id, "url", e.target.value)}
                  placeholder={`https://${link.platform}.com/yourpage`}
                />
              </div>
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
