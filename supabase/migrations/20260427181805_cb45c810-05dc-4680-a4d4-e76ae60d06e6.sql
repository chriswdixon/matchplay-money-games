-- Revoke GraphQL schema access from client-facing roles.
-- The app uses PostgREST (public schema) exclusively; the pg_graphql endpoint
-- is unused and was exposing table/view names to signed-in users (lint 0027).

REVOKE USAGE ON SCHEMA graphql_public FROM authenticated, anon, PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA graphql_public FROM authenticated, anon, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphql_public FROM authenticated, anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA graphql_public FROM authenticated, anon, PUBLIC;

-- Also revoke direct access to the internal graphql schema
REVOKE USAGE ON SCHEMA graphql FROM authenticated, anon, PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA graphql FROM authenticated, anon, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphql FROM authenticated, anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA graphql FROM authenticated, anon, PUBLIC;