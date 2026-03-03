
-- Create a secure view excluding payment_intent_id
CREATE VIEW public.double_down_participants_public
WITH (security_invoker = on) AS
SELECT 
  id,
  match_id,
  user_id,
  opted_in,
  responded,
  additional_buyin,
  payment_processed,
  created_at,
  updated_at
FROM public.double_down_participants;

-- Drop the existing overly permissive SELECT policy
DROP POLICY "Users can view double down participation" ON public.double_down_participants;

-- Create restricted SELECT policy: only owner or admin can see full row (including payment_intent_id)
CREATE POLICY "Users can view own double down data"
ON public.double_down_participants
FOR SELECT
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
);
