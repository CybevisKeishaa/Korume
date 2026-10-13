-- supabase/tests/app-footer.sql — spec T3 (SQL half). Run by scripts/verify-app-footer-gate.ps1.
\set ON_ERROR_STOP on

delete from auth.users where email like 'footergate-%@example.invalid';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'footergate-a@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'footergate-b@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

select id as uid_a from public.users where email = 'footergate-a@example.invalid' \gset
select id as uid_b from public.users where email = 'footergate-b@example.invalid' \gset

-- Shape: definer, empty search_path, no anon EXECUTE, no column UPDATE for authenticated.
do $$
declare v_def boolean; v_cfg text[];
begin
  select prosecdef, proconfig into v_def, v_cfg from pg_proc where proname = 'set_newsletter_opt_in';
  if not v_def then raise exception 'FAIL shape: not security definer'; end if;
  if v_cfg is distinct from array['search_path=""'] then raise exception 'FAIL shape: proconfig %', v_cfg; end if;
  if has_function_privilege('anon', 'public.set_newsletter_opt_in(boolean)', 'execute') then
    raise exception 'FAIL shape: anon can execute';
  end if;
  if has_column_privilege('authenticated', 'public.users', 'newsletter_opt_in_at', 'update') then
    raise exception 'FAIL shape: authenticated has a column update grant';
  end if;
  raise notice 'PASS shape';
end $$;

-- A subscribes twice, in two TRANSACTIONS (now() is constant inside one, so a single transaction could not
-- tell "kept the first instant" from "overwrote with now()"): the first instant is kept.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
select public.set_newsletter_opt_in(true) as first_at \gset
commit;

select pg_sleep(0.05);

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
select public.set_newsletter_opt_in(true) as second_at \gset
commit;

select (:'first_at' <> '' and :'first_at'::timestamptz = :'second_at'::timestamptz) as same_instant \gset
\if :same_instant
  \echo 'PASS idempotent: first consent instant kept'
\else
  \echo 'FAIL idempotent: consent instant changed on the second opt-in'
  select 1/0;
\endif

-- B opts in and out; A is untouched.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
begin
  if public.set_newsletter_opt_in(true) is null then raise exception 'FAIL B: opt-in returned null'; end if;
  if public.set_newsletter_opt_in(false) is not null then raise exception 'FAIL B: opt-out kept a value'; end if;
  raise notice 'PASS B opts in and out';
end $$;
commit;

select newsletter_opt_in_at is not null as a_still_in from public.users where id = :'uid_a' \gset
\if :a_still_in
  \echo 'PASS isolation: B never touched A'
\else
  \echo 'FAIL isolation: A lost its consent'
  select 1/0;
\endif

-- No auth.uid(): raises.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  perform public.set_newsletter_opt_in(true);
  raise exception 'FAIL unauthenticated: call succeeded';
exception when insufficient_privilege then
  raise notice 'PASS unauthenticated call raises';
end $$;
commit;

-- anon cannot call it at all.
begin;
set local role anon;
do $$
begin
  perform public.set_newsletter_opt_in(true);
  raise exception 'FAIL anon: call succeeded';
exception when insufficient_privilege then
  raise notice 'PASS anon has no EXECUTE';
end $$;
commit;

-- T4 data rights. Export: lib/data/user-export.ts reads `users` with select("*") (USER_EXPORT_TABLES), so a
-- column on public.users is exported; pin that it IS on public.users. Erasure: the account's users row (and so
-- the consent) is gone when the auth user is deleted.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'users' and column_name = 'newsletter_opt_in_at') then
    raise exception 'FAIL T4: newsletter_opt_in_at is not on public.users';
  end if;
  raise notice 'PASS T4: consent column lives on the exported users table';
end $$;

delete from auth.users where id = :'uid_a';
select count(*) = 0 as a_erased from public.users where id = :'uid_a' \gset
\if :a_erased
  \echo 'PASS T4: erasing the account removes its consent'
\else
  \echo 'FAIL T4: users row survived account deletion'
  select 1/0;
\endif

delete from auth.users where email like 'footergate-%@example.invalid';
