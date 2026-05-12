import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignedAvatarImage } from "@/components/profile/SignedAvatarImage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, MapPin, Users } from "lucide-react";
import BottomTabBar from "@/components/home/BottomTabBar";
import { PageTitleCard } from "@/components/ui/page-title-card";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { useAuth } from "@/hooks/useAuth";
import { useWinsFeed } from "@/hooks/useWinsFeed";
import { formatDistanceToNow } from "date-fns";

const formatLabel = (format: string, isTeam: boolean) => {
  if (isTeam) return "Team Match";
  if (format === "match_play") return "Match Play";
  if (format === "stroke_play") return "Stroke Play";
  return format.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const WinsFeed = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasActiveMatch } = useActiveMatch();
  const { posts, loading } = useWinsFeed(100);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  return (
    <main className="app-page-bg pb-32 md:pb-12 md:pt-20">
      <section className="max-w-2xl mx-auto px-4 py-6 page-card-shell space-y-3 mt-4">
        {loading ? (
          <div className="space-y-3" aria-live="polite">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse flex gap-3">
                    <div className="w-12 h-12 bg-muted rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Trophy className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No wins to celebrate yet. Be the first to top the leaderboard!</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => {
            const initial =
              post.display_name?.charAt(0).toUpperCase() ?? "?";
            return (
              <Card key={post.id} className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-12 h-12 border border-border">
                      <SignedAvatarImage
                        src={post.profile_picture_url}
                        alt={`${post.display_name ?? "Player"} avatar`}
                      />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold truncate">
                          {post.display_name || "Anonymous Golfer"}
                        </span>
                        <Badge variant="secondary" className="gap-1">
                          <Trophy className="w-3 h-3" />
                          Win
                        </Badge>
                        {post.is_team_win && (
                          <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" />
                            Team {post.team_number ?? ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Won a{" "}
                        <span className="font-medium text-foreground">
                          {formatLabel(post.format, post.is_team_win)}
                        </span>{" "}
                        ({post.holes} holes)
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{post.course_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <BottomTabBar
        activeTab={"home" as any}
        onChange={(tab) => {
          if (tab === 'home') navigate('/');
          else if (tab === 'profile') navigate('/profile');
          else navigate(`/?tab=${tab}`);
        }}
        hasActiveMatch={hasActiveMatch}
      />
    </main>
  );
};

export default WinsFeed;
