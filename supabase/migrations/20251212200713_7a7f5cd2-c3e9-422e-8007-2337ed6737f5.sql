-- Create blocked_states table for dynamic geo-blocking management
CREATE TABLE public.blocked_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_code text NOT NULL UNIQUE,
  state_name text NOT NULL,
  reason text,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  blocked_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_states ENABLE ROW LEVEL SECURITY;

-- Anyone can view active blocked states (needed for geo-blocking check)
CREATE POLICY "Anyone can view active blocked states"
ON public.blocked_states
FOR SELECT
USING (is_active = true);

-- Admins can view all blocked states
CREATE POLICY "Admins can view all blocked states"
ON public.blocked_states
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert blocked states
CREATE POLICY "Admins can insert blocked states"
ON public.blocked_states
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update blocked states
CREATE POLICY "Admins can update blocked states"
ON public.blocked_states
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete blocked states
CREATE POLICY "Admins can delete blocked states"
ON public.blocked_states
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_blocked_states_updated_at
  BEFORE UPDATE ON public.blocked_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial blocked states based on legal review requirements
INSERT INTO public.blocked_states (state_code, state_name, reason) VALUES
  ('AZ', 'Arizona', 'Strict gambling laws'),
  ('AR', 'Arkansas', 'Restrictive regulations'),
  ('CT', 'Connecticut', 'Unclear skill-gaming regulations'),
  ('DE', 'Delaware', 'State-controlled gaming'),
  ('HI', 'Hawaii', 'No legal gambling'),
  ('ID', 'Idaho', 'Restrictive regulations'),
  ('IA', 'Iowa', 'Strict regulations'),
  ('LA', 'Louisiana', 'Complex gaming laws'),
  ('MT', 'Montana', 'Restrictive regulations'),
  ('NV', 'Nevada', 'Requires licensing'),
  ('SD', 'South Dakota', 'Limited gaming'),
  ('TN', 'Tennessee', 'Restrictive regulations'),
  ('UT', 'Utah', 'No gambling allowed'),
  ('WA', 'Washington', 'Strict regulations');