import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAyrshareProfiles } from "@/hooks/useAyrshareProfiles";
import { Facebook, X, Instagram, Linkedin, Youtube, Music, Loader2, Send, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  const { connectedPlatforms, loading: loadingProfiles, refetch: refetchProfiles } = useAyrshareProfiles();
  const [postContent, setPostContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [posting, setPosting] = useState(false);
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

  const handlePost = async () => {
    if (!postContent.trim()) {
      toast({
        title: "Error",
        description: "Post content cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one platform",
        variant: "destructive",
      });
      return;
    }

    try {
      setPosting(true);
      const payload: any = {
        post: postContent,
        platforms: selectedPlatforms,
      };

      if (mediaUrl.trim()) {
        payload.mediaUrls = [mediaUrl];
      }

      const { data, error } = await supabase.functions.invoke("ayrshare-post", {
        body: payload,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post published successfully to selected platforms!",
      });

      // Clear form and refresh profiles
      setPostContent("");
      setMediaUrl("");
      setSelectedPlatforms([]);
      refetchProfiles();
    } catch (error: any) {
      console.error("Error posting to Ayrshare:", error);
      toast({
        title: "Error",
        description: "Failed to publish post",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
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
    <div className="space-y-6">
      {/* Social Media Links */}
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

      {/* Ayrshare Social Posting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Create Social Media Post
          </CardTitle>
          <CardDescription>
            Post content to your connected social media platforms via Ayrshare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connected Platforms Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Connected Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {loadingProfiles ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading connected platforms...</span>
                </div>
              ) : connectedPlatforms.length > 0 ? (
                connectedPlatforms.map((platform) => {
                  const platformLower = platform.toLowerCase();
                  const Icon = platformIcons[platformLower as keyof typeof platformIcons] || Send;
                  return (
                    <div
                      key={platform}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="capitalize">{platform}</span>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No platforms connected. Please connect your social accounts in Ayrshare dashboard.
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Post Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-content">Post Content</Label>
              <Textarea
                id="post-content"
                placeholder="What do you want to share?"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {postContent.length} / 5000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="media-url">Media URL (Optional)</Label>
              <Input
                id="media-url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Add an image or video URL to include in your post
              </p>
            </div>

            <div className="space-y-3">
              <Label>Select Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {connectedPlatforms.map((platform) => {
                  const platformLower = platform.toLowerCase();
                  const Icon = platformIcons[platformLower as keyof typeof platformIcons] || Send;
                  const isSelected = selectedPlatforms.includes(platformLower);
                  
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platformLower)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent"
                      }`}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium capitalize">{platform}</span>
                    </button>
                  );
                })}
              </div>
              {connectedPlatforms.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Connect platforms in Ayrshare to enable posting
                </p>
              )}
            </div>

            <Button
              onClick={handlePost}
              disabled={posting || !postContent.trim() || selectedPlatforms.length === 0}
              className="w-full"
              size="lg"
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Publish to {selectedPlatforms.length} Platform{selectedPlatforms.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
