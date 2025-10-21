-- Fix the social_links RLS policies to use auth.uid() correctly
DROP POLICY IF EXISTS "Admins can update social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can insert social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can delete social links" ON public.social_links;

-- Recreate policies with correct auth.uid() usage (not wrapped in SELECT)
CREATE POLICY "Admins can update social links"
ON public.social_links
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert social links"
ON public.social_links
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete social links"
ON public.social_links
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));