-- Table-level privileges for the Supabase roles. RLS (enabled on every table)
-- remains the row-level gate; these grants just let the roles touch the tables
-- at all. Tables created by migrations don't inherit the default project grants,
-- which caused "permission denied for table" (42501) on content queries.
--
-- authenticated: full DML — RLS confines it to the user's own rows / readable
-- content. service_role: everything (also bypasses RLS) for server/admin code.
-- anon is intentionally NOT granted: all content requires a signed-in user.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Apply the same to tables/sequences created by future migrations.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
