-- Add AI-enhanced fields to golf_courses table
ALTER TABLE golf_courses
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS difficulty_level text,
ADD COLUMN IF NOT EXISTS course_style text,
ADD COLUMN IF NOT EXISTS ai_rating numeric,
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_enriched boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS search_keywords text;

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_golf_courses_search_keywords ON golf_courses USING gin(to_tsvector('english', search_keywords));
CREATE INDEX IF NOT EXISTS idx_golf_courses_difficulty ON golf_courses(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_golf_courses_style ON golf_courses(course_style);