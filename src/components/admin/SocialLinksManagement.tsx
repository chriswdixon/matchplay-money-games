import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAyrshareProfiles } from "@/hooks/useAyrshareProfiles";
import { SocialPlatformUrls } from "./SocialPlatformUrls";
import { Facebook, X, Instagram, Linkedin, Youtube, Music, Loader2, Send, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

const platformIcons = {
  facebook: Facebook,
  x: X,
  twitter: X,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music,
};

export const SocialLinksManagement = () => {
  const { connectedPlatforms, loading: loadingProfiles, refetch: refetchProfiles } = useAyrshareProfiles();
  const [postContent, setPostContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const { toast } = useToast();

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

  return (
    <Tabs defaultValue="platforms" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="platforms">Platforms</TabsTrigger>
        <TabsTrigger value="urls">URLs</TabsTrigger>
        <TabsTrigger value="post">Create Post</TabsTrigger>
      </TabsList>

      {/* Ayrshare Integration Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Social media is managed through Ayrshare. Connect your social accounts in the{" "}
          <a 
            href="https://app.ayrshare.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium underline inline-flex items-center gap-1"
          >
            Ayrshare Dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
          {" "}to enable posting and display social icons on your website.
        </AlertDescription>
      </Alert>

      {/* Connected Platforms Tab */}
      <TabsContent value="platforms">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Connected Social Platforms
            </CardTitle>
            <CardDescription>
              These platforms are connected via Ayrshare and will appear in your website footer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {loadingProfiles ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading connected platforms...</span>
                </div>
              ) : connectedPlatforms.length > 0 ? (
                connectedPlatforms.map((platform) => {
                  const platformLower = platform.toLowerCase();
                  const Icon = platformIcons[platformLower as keyof typeof platformIcons] || Send;
                  return (
                    <div
                      key={platform}
                      className="flex items-center gap-2 px-4 py-3 bg-primary/10 text-primary rounded-lg border border-primary/20"
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium capitalize">{platform}</span>
                      <CheckCircle2 className="h-4 w-4 ml-1" />
                    </div>
                  );
                })
              ) : (
                <div className="w-full py-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No platforms connected. Connect your social accounts in Ayrshare to get started.
                  </p>
                  <Button variant="outline" asChild>
                    <a 
                      href="https://app.ayrshare.com/dashboard/social-accounts" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      Connect Platforms
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Platform URLs Tab */}
      <TabsContent value="urls">
        <SocialPlatformUrls />
      </TabsContent>

      {/* Create Post Tab */}
      <TabsContent value="post">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Create Social Media Post
            </CardTitle>
            <CardDescription>
              Publish content to all your connected social platforms at once
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
      </TabsContent>
    </Tabs>
  );
};
