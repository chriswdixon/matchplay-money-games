import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWinsFeed } from "@/hooks/useWinsFeed";
import { formatDistanceToNow } from "date-fns";

const formatLabel = (format: string, isTeam: boolean) => {
  if (isTeam) return "Team Match";
  if (format === "match_play") return "Match Play";
  if (format === "stroke_play") return "Stroke Play";
  return format.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const RecentWins = () => {
  const navigate = useNavigate();
  const { posts, loading } = useWinsFeed(3);

  return (
    <section aria-labelledby="recent-wins-heading" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 id="recent-wins-heading" className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
          Recent Wins
        </h2>
        <button
          type="button"
          onClick={() => navigate("/wins")}
          className="text-sm text-primary hover:underline flex items-center gap-1"
          aria-label="View all wins"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="animate-pulse flex gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
            No wins yet. Be the first to top the leaderboard!
          </CardContent>
        </Card>
      ) : (
        posts.slice(0, 3).map((post) => {
          const initial = post.display_name?.charAt(0).toUpperCase() ?? "?";
          return (
            <Card key={post.id} className="shadow-card">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 border border-border">
                    <AvatarImage
                      src={post.profile_picture_url ?? undefined}
                      alt={`${post.display_name ?? "Player"} avatar`}
                    />
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate text-sm">
                        {post.display_name || "Anonymous Golfer"}
                      </span>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Trophy className="w-3 h-3" />
                        Win
                      </Badge>
                      {post.is_team_win && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Users className="w-3 h-3" />
                          Team {post.team_number ?? ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatLabel(post.format, post.is_team_win)} • {post.holes} holes
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" aria-hidden="true" />
                      <span className="truncate">{post.course_name}</span>
                      <span className="ml-auto shrink-0">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
};

export default RecentWins;
