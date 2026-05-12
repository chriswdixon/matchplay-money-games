import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import GolfBallLoader from "@/components/GolfBallLoader";
import AppHeader from "@/components/AppHeader";
import BottomTabBar from "@/components/home/BottomTabBar";
import { useActiveMatch } from "@/hooks/useActiveMatch";

import { toast } from "sonner";

const MatchScorecard = lazy(() =>
  import("@/components/MatchScorecard").then((m) => ({ default: m.MatchScorecard }))
);
const MatchResults = lazy(() =>
  import("@/components/MatchResults").then((m) => ({ default: m.MatchResults }))
);
const MatchChat = lazy(() => import("@/components/match/MatchChat"));

type MatchRow = { id: string; course_name: string | null; status: string };

const MatchDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/match/${id}`)}`, { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, course_name, status")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("Could not load match");
        setNotFound(true);
      } else if (!data) {
        setNotFound(true);
      } else {
        setMatch(data as MatchRow);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, authLoading, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <GolfBallLoader size={64} showBrand />
      </div>
    );
  }

  if (notFound || !match) {
    return (
      <div className="min-h-screen flex flex-col app-page-bg">
        <AppHeader />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Match not found</h1>
          <p className="text-muted-foreground mb-6">
            This match no longer exists or you don't have access to it.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
          >
            Back to home
          </button>
        </main>
      </div>
    );
  }

  const handleClose = () => navigate(-1);
  const showResults = match.status === "completed";

  return (
    <div className="min-h-screen flex flex-col app-page-bg">
      <AppHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6 my-[20px]">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <GolfBallLoader size={48} />
            </div>
          }
        >
          {showResults ? (
            <div className="page-card-shell">
              <MatchResults
                matchId={match.id}
                matchName={match.course_name || "Match"}
                onClose={handleClose}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="page-card-shell">
                <MatchScorecard
                  matchId={match.id}
                  matchName={match.course_name || "Match"}
                  onClose={handleClose}
                />
              </div>
              <div className="page-card-shell">
                <MatchChat matchId={match.id} />
              </div>
            </div>
          )}
        </Suspense>
      </main>
      <MatchDetailsBottomBar />
    </div>
  );
};

const MatchDetailsBottomBar = () => {
  const navigate = useNavigate();
  const { hasActiveMatch } = useActiveMatch();
  return (
    <BottomTabBar
      activeTab={hasActiveMatch ? "active-match" : "home"}
      hasActiveMatch={hasActiveMatch}
      onChange={(tab) => {
        if (tab === "active-match") return;
        if (tab === "home") navigate("/");
        else if (tab === "profile") navigate("/profile");
        else if (tab === "wallet") navigate("/wallet");
        else navigate(`/?tab=${tab}`);
      }}
    />
  );
};

export default MatchDetails;
