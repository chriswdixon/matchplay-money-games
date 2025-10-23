-- Restrict golf_courses INSERT to admin users only
DROP POLICY IF EXISTS "Authenticated users can create golf courses" ON golf_courses;

CREATE POLICY "Admins can create golf courses"
ON golf_courses FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add audit logging trigger for golf_courses modifications
CREATE OR REPLACE FUNCTION log_golf_course_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO profile_audit_log (user_id, action, new_data)
    VALUES (
      auth.uid(),
      'GOLF_COURSE_CREATED',
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO profile_audit_log (user_id, action, old_data, new_data)
    VALUES (
      auth.uid(),
      'GOLF_COURSE_UPDATED',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO profile_audit_log (user_id, action, old_data)
    VALUES (
      auth.uid(),
      'GOLF_COURSE_DELETED',
      to_jsonb(OLD)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER golf_course_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON golf_courses
FOR EACH ROW
EXECUTE FUNCTION log_golf_course_changes();