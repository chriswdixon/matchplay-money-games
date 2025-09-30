-- Add tee selection fields to matches table
ALTER TABLE public.matches
ADD COLUMN tee_selection_mode text NOT NULL DEFAULT 'fixed',
ADD COLUMN default_tees text DEFAULT NULL,
ADD CONSTRAINT check_tee_selection_mode CHECK (tee_selection_mode IN ('fixed', 'individual'));

-- Add comment for clarity
COMMENT ON COLUMN public.matches.tee_selection_mode IS 'Determines if creator picks tees for everyone (fixed) or each participant picks their own (individual)';
COMMENT ON COLUMN public.matches.default_tees IS 'The tee color/name when tee_selection_mode is fixed (e.g., Blue, White, Championship)';

-- Add tee selection to match_participants for individual choices
ALTER TABLE public.match_participants
ADD COLUMN selected_tees text DEFAULT NULL;

COMMENT ON COLUMN public.match_participants.selected_tees IS 'The tee color/name selected by this participant when tee_selection_mode is individual';