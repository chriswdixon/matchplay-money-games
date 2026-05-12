// Match Play scoring helpers.
// In match play, each hole is its own contest: lower strokes wins the hole,
// equal strokes halves it. The match leader is whoever is "up" by the most
// holes. The match is "clinched" (closed out) when the lead is greater than
// the number of holes remaining (e.g., 4&3 = up 4 with 3 to play).

export type HoleResult = "win" | "loss" | "half" | null;

export interface MatchPlayState {
  // hole index 0-based -> result from p1's perspective
  holeResults: HoleResult[];
  holesPlayed: number;
  holesRemaining: number;
  // Positive = p1 leads, negative = p2 leads, 0 = all square
  diff: number;
  leader: "p1" | "p2" | "tie";
  // Short status, p1's perspective: "2 UP", "1 DOWN", "AS"
  p1StatusText: string;
  p2StatusText: string;
  isClinched: boolean;
  // e.g. "4&3", "1 UP" (final)
  finalText?: string;
}

const fmtUpDown = (diff: number): string => {
  if (diff === 0) return "AS";
  if (diff > 0) return `${diff} UP`;
  return `${Math.abs(diff)} DOWN`;
};

export function computeMatchPlayState(
  p1Scores: Record<number, number>,
  p2Scores: Record<number, number>,
  totalHoles: number,
): MatchPlayState {
  const holeResults: HoleResult[] = [];
  let diff = 0;
  let holesPlayed = 0;

  for (let h = 1; h <= totalHoles; h++) {
    const a = p1Scores[h];
    const b = p2Scores[h];
    if (!a || !b) {
      holeResults.push(null);
      continue;
    }
    holesPlayed++;
    if (a < b) {
      holeResults.push("win");
      diff += 1;
    } else if (a > b) {
      holeResults.push("loss");
      diff -= 1;
    } else {
      holeResults.push("half");
    }
  }

  const holesRemaining = totalHoles - holesPlayed;
  const leader: MatchPlayState["leader"] =
    diff > 0 ? "p1" : diff < 0 ? "p2" : "tie";

  const isClinched = Math.abs(diff) > holesRemaining && holesPlayed > 0;
  let finalText: string | undefined;
  if (isClinched) {
    const lead = Math.abs(diff);
    finalText = holesRemaining > 0 ? `${lead}&${holesRemaining}` : `${lead} UP`;
  } else if (holesRemaining === 0 && holesPlayed > 0) {
    finalText = diff === 0 ? "AS (Push)" : fmtUpDown(Math.abs(diff));
  }

  return {
    holeResults,
    holesPlayed,
    holesRemaining,
    diff,
    leader,
    p1StatusText: fmtUpDown(diff),
    p2StatusText: fmtUpDown(-diff),
    isClinched,
    finalText,
  };
}
