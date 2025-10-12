// Error handling utility for safe error messaging

/**
 * Maps database errors to safe, user-friendly messages
 * Prevents leaking internal database structure and schema information
 */
export const mapDatabaseError = (error: any): string => {
  // In development, we can be more verbose (but still safe)
  if (import.meta.env.DEV) {
    console.error('[Database Error]:', error);
  }
  
  // Map specific error codes to user-friendly messages
  if (error?.code === '23505') {
    return 'This record already exists. Please try a different value.';
  }
  
  if (error?.code === '23503') {
    return 'Invalid reference. Please check your input.';
  }
  
  if (error?.code === '23514') {
    return 'Invalid data provided. Please check all fields.';
  }
  
  if (error?.message?.toLowerCase().includes('rls')) {
    return 'Permission denied. You do not have access to perform this action.';
  }
  
  if (error?.message?.toLowerCase().includes('violates check')) {
    return 'Invalid data provided. Please check your input values.';
  }
  
  if (error?.message?.toLowerCase().includes('foreign key')) {
    return 'Invalid reference. The related record may not exist.';
  }
  
  if (error?.message?.toLowerCase().includes('duplicate key')) {
    return 'This record already exists.';
  }
  
  if (error?.message?.toLowerCase().includes('not null')) {
    return 'Required field is missing. Please fill in all required fields.';
  }
  
  // Generic fallback message
  return 'An error occurred. Please try again or contact support if the problem persists.';
};

/**
 * Generates a random error ID for tracking purposes
 */
export const generateErrorId = (): string => {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

/**
 * Logs an error with an ID for support purposes
 */
export const logErrorWithId = (error: any): string => {
  const errorId = generateErrorId();
  
  // In production, this would send to a logging service
  if (import.meta.env.DEV) {
    console.error(`[${errorId}]`, error);
  }
  
  return errorId;
};

/**
 * Gets a safe error message with optional error ID
 */
export const getSafeErrorMessage = (error: any, includeErrorId: boolean = false): string => {
  const message = mapDatabaseError(error);
  
  if (includeErrorId) {
    const errorId = logErrorWithId(error);
    return `${message} (Error ID: ${errorId})`;
  }
  
  return message;
};
