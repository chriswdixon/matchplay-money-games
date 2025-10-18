-- Allow authenticated users to create golf courses
DROP POLICY IF EXISTS "Admins can insert golf courses" ON public.golf_courses;

CREATE POLICY "Authenticated users can create golf courses"
ON public.golf_courses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);