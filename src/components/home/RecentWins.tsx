import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
    <section
      aria-labelledby="recent-wins-heading"
      className="rounded-3xl bg-foreground text-background p-4 md:p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-background/15">
        <h2 id="recent-wins-heading" className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5" aria-hidden="true" />
          Recent Wins
        </h2>
        <button
          type="button"
          onClick={() => navigate("/wins")}
          className="text-sm text-background/90 hover:text-background flex items-center gap-1"
          aria-label="View all wins"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          [1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl bg-background/10" />
          ))
        ) : posts.length === 0 ? (
          <div className="py-6 text-center text-sm text-background/70">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
            No wins yet. Be the first to top the leaderboard!
          </div>
        ) : (
          posts.slice(0, 3).map((post) => {
            const initial = post.display_name?.charAt(0).toUpperCase() ?? "?";
            return (
              <div
                key={post.id}
                className="flex items-center gap-3 bg-background/95 text-foreground rounded-2xl px-3 py-3"
              >
                <Avatar className="w-10 h-10 border border-border shrink-0">
                  <AvatarImage
                    src={post.profile_picture_url ?? undefined}
                    alt={`${post.display_name ?? "Player"} avatar`}
                  />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate text-sm">
                      {post.display_name || "Anonymous Golfer"}
                    </span>
                    {post.is_team_win && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" aria-hidden="true" />
                        Team {post.team_number ?? ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{post.course_name}</span>
                    <span aria-hidden="true" className="opacity-60">•</span>
                    <span className="truncate">{formatLabel(post.format, post.is_team_win)}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default RecentWins;
