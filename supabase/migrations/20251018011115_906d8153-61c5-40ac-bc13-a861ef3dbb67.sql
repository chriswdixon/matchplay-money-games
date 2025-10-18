-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can insert social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can update social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can delete social links" ON public.social_links;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active social links"
ON public.social_links
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can insert social links"
ON public.social_links
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update social links"
ON public.social_links
FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete social links"
ON public.social_links
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Insert default social links if they don't exist
INSERT INTO public.social_links (platform, url, display_order) VALUES
  ('facebook', 'https://facebook.com', 1),
  ('x', 'https://twitter.com', 2),
  ('instagram', 'https://instagram.com', 3),
  ('linkedin', 'https://linkedin.com', 4),
  ('youtube', 'https://youtube.com', 5),
  ('tiktok', 'https://tiktok.com', 6)
ON CONFLICT (platform) DO NOTHING;