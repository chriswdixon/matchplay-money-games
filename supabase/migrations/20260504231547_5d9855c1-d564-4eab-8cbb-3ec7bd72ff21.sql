REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated, PUBLIC;
REVOKE USAGE ON SCHEMA graphql        FROM anon, authenticated, PUBLIC;

REVOKE ALL ON ALL TABLES    IN SCHEMA graphql_public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphql_public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA graphql_public FROM anon, authenticated, PUBLIC;

REVOKE ALL ON ALL TABLES    IN SCHEMA graphql FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphql FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA graphql FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION graphql.resolve(query text, variables jsonb, "operationName" text, extensions jsonb)        FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION graphql._internal_resolve(query text, variables jsonb, "operationName" text, extensions jsonb) FROM anon, authenticated, PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA graphql_public REVOKE ALL ON TABLES    FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA graphql_public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA graphql_public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA graphql REVOKE ALL ON TABLES    FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA graphql REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA graphql REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;