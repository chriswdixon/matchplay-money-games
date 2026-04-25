import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { usePlayerAccount } from "@/hooks/usePlayerAccount";
import { Skeleton } from "@/components/ui/skeleton";

const HomeProfileCard = () => {
  const { profile, loading: profileLoading } = useProfile();
  const { account, loading: accountLoading } = usePlayerAccount();

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name && `${profile.last_name[0]}.`]
      .filter(Boolean)
      .join(" ") ||
    "Player";

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const balanceDollars = account ? parseFloat(account.balance.toString()) / 100 : 0;
  const formattedBalance = balanceDollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  const rating = profile?.average_rating
    ? Number(profile.average_rating).toFixed(1)
    : "—";
  const handicap =
    profile?.handicap !== null && profile?.handicap !== undefined
      ? Number(profile.handicap).toFixed(0)
      : "—";

  return (
    <div className="flex items-center gap-4 px-1">
      <Avatar className="h-14 w-14 shrink-0 border-2 border-background shadow-card">
        <AvatarImage src={profile?.profile_picture_url || undefined} alt={displayName} />
        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {profileLoading ? (
          <>
            <Skeleton className="h-5 w-28 mb-1" />
            <Skeleton className="h-3 w-40" />
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-foreground truncate leading-tight">
              {displayName}
            </h2>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="w-3 h-3 fill-foreground text-foreground" aria-hidden="true" />
              <span className="font-medium text-foreground">{rating}</span>
              <span aria-hidden="true">|</span>
              <span>HC:{handicap}</span>
            </div>
          </>
        )}
      </div>

      <div className="text-right shrink-0">
        {accountLoading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <span className="text-xl font-bold text-foreground tabular-nums">
            {formattedBalance}
          </span>
        )}
      </div>
    </div>
  );
};

export default HomeProfileCard;
