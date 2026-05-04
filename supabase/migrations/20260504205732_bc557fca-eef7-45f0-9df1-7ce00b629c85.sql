
-- Support requests table
CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own support requests"
  ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update support requests"
  ON public.support_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_support_requests_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify all admins on new support request, and notify user on admin response
CREATE OR REPLACE FUNCTION public.notify_support_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_row RECORD;
  requester_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(display_name, first_name, 'A user') INTO requester_name
    FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

    FOR admin_row IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        admin_row.user_id,
        'support_request',
        'New support request',
        COALESCE(requester_name, 'A user') || ': ' || NEW.subject,
        jsonb_build_object('support_request_id', NEW.id, 'from_user_id', NEW.user_id)
      );
    END LOOP;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.admin_response IS DISTINCT FROM OLD.admin_response AND NEW.admin_response IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        NEW.user_id,
        'support_response',
        'Support team responded',
        'Re: ' || NEW.subject,
        jsonb_build_object('support_request_id', NEW.id)
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_support_request_insert
  AFTER INSERT ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_request();

CREATE TRIGGER trg_notify_support_request_update
  AFTER UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_request();
