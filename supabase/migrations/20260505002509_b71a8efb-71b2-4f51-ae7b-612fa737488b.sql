-- Join requests for matches (esp. PIN-protected)
CREATE TABLE public.match_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid,
  UNIQUE (match_id, requester_id)
);

ALTER TABLE public.match_join_requests ENABLE ROW LEVEL SECURITY;

-- Requester can insert their own
CREATE POLICY "Requesters can create their own join requests"
ON public.match_join_requests
FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid());

-- Requester can view their own
CREATE POLICY "Requesters can view their own join requests"
ON public.match_join_requests
FOR SELECT
TO authenticated
USING (requester_id = auth.uid());

-- Match creator can view requests for their matches
CREATE POLICY "Match creators can view requests for their matches"
ON public.match_join_requests
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.matches m
  WHERE m.id = match_join_requests.match_id AND m.created_by = auth.uid()
));

-- Match creator can update status
CREATE POLICY "Match creators can update requests for their matches"
ON public.match_join_requests
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.matches m
  WHERE m.id = match_join_requests.match_id AND m.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.matches m
  WHERE m.id = match_join_requests.match_id AND m.created_by = auth.uid()
));

-- Admins
CREATE POLICY "Admins can view all join requests"
ON public.match_join_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_match_join_requests_updated_at
BEFORE UPDATE ON public.match_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Notify match creator on new request
CREATE OR REPLACE FUNCTION public.notify_match_creator_on_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_course text;
  v_requester_name text;
BEGIN
  SELECT created_by, course_name INTO v_creator, v_course
  FROM public.matches WHERE id = NEW.match_id;

  SELECT COALESCE(display_name, first_name, 'A player') INTO v_requester_name
  FROM public.profiles WHERE user_id = NEW.requester_id;

  IF v_creator IS NOT NULL AND v_creator <> NEW.requester_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, metadata)
    VALUES (
      v_creator,
      'join_request',
      'New join request',
      v_requester_name || ' wants to join your match at ' || COALESCE(v_course, 'your course'),
      NEW.match_id,
      jsonb_build_object('requester_id', NEW.requester_id, 'request_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_match_creator_on_join_request
AFTER INSERT ON public.match_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_match_creator_on_join_request();

CREATE INDEX idx_match_join_requests_match ON public.match_join_requests(match_id);
CREATE INDEX idx_match_join_requests_requester ON public.match_join_requests(requester_id);