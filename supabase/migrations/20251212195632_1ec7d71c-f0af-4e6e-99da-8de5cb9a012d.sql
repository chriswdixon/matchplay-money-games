-- Create consent records table for GDPR audit trail
CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL, -- 'cookie', 'marketing', 'terms', 'privacy'
  consented BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  version TEXT, -- policy version consented to
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for user lookups
CREATE INDEX idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);

-- Enable RLS
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own consent records
CREATE POLICY "Users can view their own consent records"
ON consent_records FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own consent records
CREATE POLICY "Users can insert their own consent records"
ON consent_records FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create account deletion requests table
CREATE TABLE public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID
);

-- Create index
CREATE INDEX idx_deletion_requests_user_id ON account_deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_status ON account_deletion_requests(status);

-- Enable RLS
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own deletion requests
CREATE POLICY "Users can view their own deletion requests"
ON account_deletion_requests FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own deletion requests
CREATE POLICY "Users can create their own deletion requests"
ON account_deletion_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can cancel their own pending requests
CREATE POLICY "Users can update their own pending deletion requests"
ON account_deletion_requests FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- Admins can view all requests
CREATE POLICY "Admins can view all deletion requests"
ON account_deletion_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update requests
CREATE POLICY "Admins can update deletion requests"
ON account_deletion_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));