import { z } from 'zod';

// Password validation schema with security requirements
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be less than 128 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")  
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
  .refine((password) => {
    // Check for common weak patterns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
      /dragon/i
    ];
    return !commonPatterns.some(pattern => pattern.test(password));
  }, "Password contains common weak patterns");

// Email validation schema
export const emailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email address")
  .min(5, "Email must be at least 5 characters")
  .max(254, "Email must be less than 254 characters")
  .toLowerCase();

// Display name validation schema
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters")
  .max(50, "Display name must be less than 50 characters")
  .regex(/^[a-zA-Z0-9\s_-]+$/, "Display name can only contain letters, numbers, spaces, underscores, and hyphens")
  .refine((name) => name.length > 0, "Display name cannot be empty");

// Sign up form validation schema
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
});

// Sign in form validation schema  
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Password reset schema
export const passwordResetSchema = z.object({
  email: emailSchema,
});

// Profile update validation schema
export const profileUpdateSchema = z.object({
  display_name: displayNameSchema.optional(),
  handicap: z.number().min(-10, "Handicap must be at least -10").max(54, "Handicap must be at most 54").optional(),
});

// Create match validation schema
export const createMatchSchema = z.object({
  course_name: z.string().trim().min(1, "Course name is required").max(200, "Course name must be less than 200 characters"),
  buy_in_amount: z.number().int().min(0, "Buy-in must be at least $0").max(50000, "Buy-in cannot exceed $500"),
  handicap_min: z.number().int().min(-10, "Minimum handicap must be at least -10").max(54, "Minimum handicap must be at most 54").optional().nullable(),
  handicap_max: z.number().int().min(-10, "Maximum handicap must be at least -10").max(54, "Maximum handicap must be at most 54").optional().nullable(),
  booking_url: z.string().trim().max(500, "Booking URL must be less than 500 characters").optional().or(z.literal('')).refine((url) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, "Invalid URL format"),
  format: z.enum(['Stroke Play', 'Match Play', 'Best Ball', 'Skins Game', 'Scramble'], {
    errorMap: () => ({ message: "Invalid match format" })
  }),
  max_participants: z.number().int().min(1, "Must have at least 1 participant").max(8, "Cannot exceed 8 participants"),
  location: z.string().trim().min(1, "Location is required").max(200, "Location must be less than 200 characters"),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional().nullable(),
}).refine(
  (data) => {
    if (data.handicap_min !== undefined && data.handicap_min !== null && 
        data.handicap_max !== undefined && data.handicap_max !== null) {
      return data.handicap_min <= data.handicap_max;
    }
    return true;
  },
  { message: "Minimum handicap must be less than or equal to maximum handicap", path: ["handicap_min"] }
);

// Input sanitization function
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    // Remove potential XSS vectors
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Limit length for safety
    .substring(0, 1000);
}

// Rate limiting helper for client-side
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(key);
    
    if (!attempt) {
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (now > attempt.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (attempt.count >= this.maxAttempts) {
      return false;
    }
    
    attempt.count++;
    return true;
  }
  
  getRemainingTime(key: string): number {
    const attempt = this.attempts.get(key);
    if (!attempt || Date.now() > attempt.resetTime) {
      return 0;
    }
    return attempt.resetTime - Date.now();
  }
}

// Validate session token format (basic client-side check)
export function validateSessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Basic JWT format check (header.payload.signature)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  // Check if parts are base64-like strings
  const base64Regex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => base64Regex.test(part) && part.length > 0);
}