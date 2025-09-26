import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Security utility functions
export function generateSecureRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomArray[i] % chars.length);
  }
  
  return result;
}

// Check if password has been compromised (basic client-side checks)
export async function checkPasswordSecurity(password: string): Promise<{
  isSecure: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  // Check length
  if (password.length < 12) {
    warnings.push('Consider using a longer password (12+ characters)');
  }
  
  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    warnings.push('Avoid repeating characters');
  }
  
  if (/^[a-zA-Z]+$/.test(password)) {
    warnings.push('Include numbers and special characters');
  }
  
  if (/^[0-9]+$/.test(password)) {
    warnings.push('Include letters and special characters');
  }
  
  // Check for keyboard patterns
  const keyboardPatterns = ['qwerty', 'asdf', '1234', 'abcd'];
  if (keyboardPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    warnings.push('Avoid keyboard patterns');
  }
  
  return {
    isSecure: warnings.length === 0,
    warnings
  };
}

// Session security helpers
export function isValidSessionAge(sessionCreated: string, maxAgeHours: number = 24): boolean {
  const created = new Date(sessionCreated);
  const now = new Date();
  const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= maxAgeHours;
}

// Sanitize URL parameters to prevent XSS through redirects
export function sanitizeRedirectUrl(url: string, allowedDomains: string[] = []): string {
  try {
    const parsed = new URL(url, window.location.origin);
    
    // Only allow same origin or explicitly allowed domains
    if (parsed.origin !== window.location.origin && 
        !allowedDomains.includes(parsed.hostname)) {
      return '/';
    }
    
    return parsed.pathname + parsed.search;
  } catch {
    return '/';
  }
}
