-- In-match chat messages
CREATE TABLE public.match_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_chat_body_length CHECK (char_length(body) BETWEEN 1 AND 1000)
);

CREATE INDEX idx_match_chat_messages_match_created
  ON public.match_chat_messages (match_id, created_at);

ALTER TABLE public.match_chat_messages ENABLE ROW LEVEL SECURITY;

-- Read: any active participant, the match creator, or an admin
CREATE POLICY "Participants can view match chat"
ON public.match_chat_messages
FOR SELECT
TO authenticated
USING (
  is_user_in_match(match_id, auth.uid())
  OR is_user_match_creator(match_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Insert: must be the sender AND an active participant of the match
CREATE POLICY "Participants can post match chat"
ON public.match_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_user_in_match(match_id, auth.uid())
);

-- Update: only the sender can edit their own message
CREATE POLICY "Senders can edit own messages"
ON public.match_chat_messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Delete: senders can delete own; admins can delete any
CREATE POLICY "Senders or admins can delete messages"
ON public.match_chat_messages
FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Maintain updated_at
CREATE TRIGGER update_match_chat_messages_updated_at
BEFORE UPDATE ON public.match_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.match_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_chat_messages;