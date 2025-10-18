-- Enable trigram extension for fuzzy name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create golf courses table
CREATE TABLE IF NOT EXISTS public.golf_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  country text,
  latitude numeric,
  longitude numeric,
  phone text,
  website text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.golf_courses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read golf courses
CREATE POLICY "Authenticated users can view golf courses"
ON public.golf_courses
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify golf courses
CREATE POLICY "Admins can insert golf courses"
ON public.golf_courses
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update golf courses"
ON public.golf_courses
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete golf courses"
ON public.golf_courses
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_golf_courses_location ON public.golf_courses(latitude, longitude);
CREATE INDEX idx_golf_courses_name ON public.golf_courses USING gin(name gin_trgm_ops);