-- Enable leaked password protection for better security
ALTER DATABASE postgres SET "app.settings.auth_password_validators" TO 'length,strength,pwned';

-- Enable password strength requirements
UPDATE auth.config 
SET password_min_length = 8;

-- Note: The pwned passwords protection will be enabled at the project level
-- This helps prevent users from setting passwords that have been compromised in data breaches