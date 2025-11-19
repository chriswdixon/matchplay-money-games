-- Allow admins to update matches (for deletion/cancellation)
CREATE POLICY "Admins can update matches"
ON public.matches
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to update match participants
CREATE POLICY "Admins can update match participants"
ON public.match_participants
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to delete matches
CREATE POLICY "Admins can delete matches"
ON public.matches
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));