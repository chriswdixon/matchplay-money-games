-- Create favorite_courses table
CREATE TABLE public.favorite_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_name TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.favorite_courses ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorite courses
CREATE POLICY "Users can view their own favorite courses"
ON public.favorite_courses
FOR SELECT
USING (auth.uid() = user_id);

-- Users can add their own favorite courses
CREATE POLICY "Users can add their own favorite courses"
ON public.favorite_courses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (SELECT COUNT(*) FROM public.favorite_courses WHERE user_id = auth.uid()) < 5
);

-- Users can delete their own favorite courses
CREATE POLICY "Users can delete their own favorite courses"
ON public.favorite_courses
FOR DELETE
USING (auth.uid() = user_id);

-- Create unique constraint to prevent duplicate favorites
CREATE UNIQUE INDEX idx_favorite_courses_user_course 
ON public.favorite_courses(user_id, course_name);

-- Add comment
COMMENT ON TABLE public.favorite_courses IS 'Stores user favorite golf courses (max 5 per user)';