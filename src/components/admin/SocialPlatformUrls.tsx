import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAyrshareProfiles } from "@/hooks/useAyrshareProfiles";
import { Facebook, X, Instagram, Linkedin, Youtube, Music, Loader2, Save, Link as LinkIcon } from "lucide-react";

const platformIcons = {
  facebook: Facebook,
  x: X,
  twitter: X,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music,
};

const platformNames: Record<string, string> = {
  facebook: "Facebook",
  x: "X (Twitter)",
  twitter: "Twitter",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
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

export const SocialPlatformUrls = () => {
  const { connectedPlatforms, loading: loadingProfiles } = useAyrshareProfiles();
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>(
    JSON.parse(localStorage.getItem("platformUrls") || JSON.stringify(defaultUrls))
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    try {
      setSaving(true);
      localStorage.setItem("platformUrls", JSON.stringify(platformUrls));
      
      toast({
        title: "Success",
        description: "Platform URLs saved successfully",
      });
    } catch (error: any) {
      console.error("Error saving platform URLs:", error);
      toast({
        title: "Error",
        description: "Failed to save platform URLs",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateUrl = (platform: string, url: string) => {
    setPlatformUrls((prev) => ({
      ...prev,
      [platform]: url,
    }));
  };

  if (loadingProfiles) {
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
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Social Platform URLs
        </CardTitle>
        <CardDescription>
          Configure the URLs for your connected social platforms that will appear in the website footer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {connectedPlatforms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No platforms connected. Connect platforms in Ayrshare first.
          </p>
        ) : (
          <>
            {connectedPlatforms.map((platform) => {
              const platformLower = platform.toLowerCase();
              const Icon = platformIcons[platformLower as keyof typeof platformIcons];
              const platformName = platformNames[platformLower] || platform;

              if (!Icon) return null;

              return (
                <div key={platform} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <h3 className="font-semibold">{platformName}</h3>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${platformLower}-url`}>URL</Label>
                    <Input
                      id={`${platformLower}-url`}
                      type="url"
                      value={platformUrls[platformLower] || ""}
                      onChange={(e) => updateUrl(platformLower, e.target.value)}
                      placeholder={`https://${platformLower}.com/yourpage`}
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
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save URLs
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
