import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMatches } from './useMatches';
import { useAuth } from './useAuth';

interface ActiveMatchContextType {
  activeMatchId: string | null;
  activeMatchName: string | null;
  hasActiveMatch: boolean;
  setActiveMatch: (matchId: string | null, matchName: string | null) => void;
  clearActiveMatch: () => void;
}

const ActiveMatchContext = createContext<ActiveMatchContextType | undefined>(undefined);

function ActiveMatchAutoDetector({
  userId,
  activeMatchId,
  setActiveMatchId,
  setActiveMatchName,
}: {
  userId: string;
  activeMatchId: string | null;
  setActiveMatchId: (id: string | null) => void;
  setActiveMatchName: (name: string | null) => void;
}) {
  // Only mounted when a user exists, so we avoid fetching matches for logged-out visitors.
  const { matches } = useMatches();

  // Auto-detect active match from matches
  useEffect(() => {
    const startedMatch = matches.find(
      (match) => match.status === 'started' && match.user_joined
    );

    if (startedMatch && !activeMatchId) {
      setActiveMatchId(startedMatch.id);
      setActiveMatchName(startedMatch.course_name);
    } else if (!startedMatch) {
      // No started match found, clear active match
      // This handles cases where match is completed, cancelled, or user left
      setActiveMatchId(null);
      setActiveMatchName(null);
    }
  }, [matches, activeMatchId, setActiveMatchId, setActiveMatchName]);

  return null;
}

export function ActiveMatchProvider({ children }: { children: ReactNode }) {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeMatchName, setActiveMatchName] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setActiveMatchId(null);
      setActiveMatchName(null);
    }
  }, [user]);

  const setActiveMatch = (matchId: string | null, matchName: string | null) => {
    setActiveMatchId(matchId);
    setActiveMatchName(matchName);
  };

  const clearActiveMatch = () => {
    setActiveMatchId(null);
    setActiveMatchName(null);
  };

  return (
    <ActiveMatchContext.Provider
      value={{
        activeMatchId,
        activeMatchName,
        hasActiveMatch: !!activeMatchId,
        setActiveMatch,
        clearActiveMatch,
      }}
    >
      {user ? (
        <ActiveMatchAutoDetector
          userId={user.id}
          activeMatchId={activeMatchId}
          setActiveMatchId={setActiveMatchId}
          setActiveMatchName={setActiveMatchName}
        />
      ) : null}
      {children}
    </ActiveMatchContext.Provider>
  );
}

export function useActiveMatch() {
  const context = useContext(ActiveMatchContext);
  if (context === undefined) {
    throw new Error('useActiveMatch must be used within an ActiveMatchProvider');
  }
  return context;
}
