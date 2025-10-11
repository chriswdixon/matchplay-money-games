import { z } from 'zod';
import { sanitizeInput } from './validation';

// Validation schema for hole_pars JSONB field
export const holeParsSchema = z
  .record(
    z.string().regex(/^(1[0-8]|[1-9])$/, "Hole number must be between 1 and 18"),
    z.number().int().min(3, "Par must be at least 3").max(6, "Par must be at most 6")
  )
  .refine(
    (data) => {
      const keys = Object.keys(data);
      return keys.length === 18;
    },
    { message: "Must have exactly 18 holes" }
  )
  .refine(
    (data) => {
      const holeNumbers = Object.keys(data).map(Number).sort((a, b) => a - b);
      for (let i = 1; i <= 18; i++) {
        if (!holeNumbers.includes(i)) {
          return false;
        }
      }
      return true;
    },
    { message: "Must have holes numbered 1 through 18" }
  );

// Validation schema for player score data in final_scores
const playerScoreDataSchema = z.object({
  player_name: z.string().max(100).transform(sanitizeInput),
  gross_strokes: z.number().int().min(18, "Gross strokes too low").max(200, "Gross strokes too high"),
  handicap_index: z.number().min(-10, "Handicap too low").max(54, "Handicap too high"),
  course_handicap: z.number().int().min(-20, "Course handicap too low").max(60, "Course handicap too high"),
  net_strokes: z.number().int().min(-10, "Net strokes too low").max(220, "Net strokes too high")
});

// Validation schema for final_scores JSONB field
export const finalScoresSchema = z
  .record(
    z.string().uuid("Player ID must be a valid UUID"),
    playerScoreDataSchema
  )
  .refine(
    (data) => Object.keys(data).length >= 1 && Object.keys(data).length <= 8,
    { message: "Must have between 1 and 8 players" }
  );

// Validation schema for forfeited player entry
const forfeitedPlayerSchema = z.object({
  user_id: z.string().uuid("User ID must be a valid UUID"),
  reason: z.string().max(200).transform(sanitizeInput),
  timestamp: z.string().datetime("Invalid timestamp format"),
  refund_eligible: z.boolean().optional()
});

// Validation schema for forfeited_players JSONB array
export const forfeitedPlayersSchema = z
  .array(forfeitedPlayerSchema)
  .max(8, "Too many forfeited players");

// Helper function to validate hole pars
export function validateHolePars(holePars: unknown): { success: boolean; error?: string; data?: any } {
  try {
    const validated = holeParsSchema.parse(holePars);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Invalid hole pars format" };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

// Helper function to validate final scores
export function validateFinalScores(finalScores: unknown): { success: boolean; error?: string; data?: any } {
  try {
    const validated = finalScoresSchema.parse(finalScores);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Invalid final scores format" };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

// Helper function to validate forfeited players
export function validateForfeitedPlayers(forfeitedPlayers: unknown): { success: boolean; error?: string; data?: any } {
  try {
    const validated = forfeitedPlayersSchema.parse(forfeitedPlayers);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Invalid forfeited players format" };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

// Default valid hole pars for a standard course
export const DEFAULT_HOLE_PARS = {
  "1": 4, "2": 4, "3": 3, "4": 4, "5": 5,
  "6": 4, "7": 3, "8": 4, "9": 5,
  "10": 4, "11": 4, "12": 3, "13": 4, "14": 5,
  "15": 4, "16": 3, "17": 4, "18": 5
};
