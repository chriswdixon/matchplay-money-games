-- Fix SELECT policy for social_links to allow admins to view all links
DROP POLICY IF EXISTS "Anyone can view active social links" ON public.social_links;

-- Create new policy: Public can view active links, admins can view all
CREATE POLICY "Public can view active social links, admins view all"
ON public.social_links
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));