-- Grant admin role to chris.dixon@match-play.co
INSERT INTO public.user_roles (user_id, role)
VALUES ('4843ec5d-f1b1-4e95-b534-9ecef7c9480f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;