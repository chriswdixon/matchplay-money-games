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

export function ActiveMatchProvider({ children }: { children: ReactNode }) {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeMatchName, setActiveMatchName] = useState<string | null>(null);
  const { matches } = useMatches();
  const { user } = useAuth();

  // Auto-detect active match from matches
  useEffect(() => {
    if (!user) {
      setActiveMatchId(null);
      setActiveMatchName(null);
      return;
    }

    const startedMatch = matches.find(match => 
      match.status === 'started' && match.user_joined
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
  }, [matches, user]);

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
