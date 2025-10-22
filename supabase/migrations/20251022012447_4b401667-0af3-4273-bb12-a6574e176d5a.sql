-- Create temporary media storage bucket for social posts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-social-media',
  'temp-social-media',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ]
);

-- RLS policies for temporary media uploads
CREATE POLICY "Admins can upload temp media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'temp-social-media' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can view their temp media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'temp-social-media' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete their temp media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp-social-media' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Function to clean up old temp media (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_temp_media()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  deleted_count INTEGER := 0;
  old_file RECORD;
BEGIN
  -- Delete files older than 24 hours
  FOR old_file IN 
    SELECT bucket_id, name 
    FROM storage.objects 
    WHERE bucket_id = 'temp-social-media' 
    AND created_at < NOW() - INTERVAL '24 hours'
  LOOP
    DELETE FROM storage.objects 
    WHERE bucket_id = old_file.bucket_id AND name = old_file.name;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$;