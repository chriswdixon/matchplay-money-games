import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Music, Loader2 } from "lucide-react";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  is_active: boolean;
  display_order: number;
}

const platformIcons = {
  facebook: Facebook,
  x: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music,
};

const platformLabels = {
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
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('social_links')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setLinks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateLink = (id: string, field: keyof SocialLink, value: any) => {
    setLinks(links.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  const saveLinks = async () => {
    try {
      setSaving(true);

      for (const link of links) {
        const { error } = await supabase
          .from('social_links')
          .update({
            url: link.url,
            is_active: link.is_active,
          })
          .eq('id', link.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Social links updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Links</CardTitle>
        <CardDescription>
          Manage your social media links displayed in the footer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {links.map((link) => {
          const Icon = platformIcons[link.platform as keyof typeof platformIcons];
          return (
            <div key={link.id} className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">
                    {platformLabels[link.platform as keyof typeof platformLabels]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${link.id}`}>Active</Label>
                  <Switch
                    id={`active-${link.id}`}
                    checked={link.is_active}
                    onCheckedChange={(checked) => 
                      updateLink(link.id, 'is_active', checked)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`url-${link.id}`}>URL</Label>
                <Input
                  id={`url-${link.id}`}
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                  placeholder={`https://${link.platform}.com/yourprofile`}
                />
              </div>
            </div>
          );
        })}
        <Button onClick={saveLinks} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
