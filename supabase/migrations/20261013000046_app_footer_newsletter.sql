-- App footer newsletter opt-in (spec docs/superpowers/specs/2026-10-13-app-footer-design.md N1–N2).
-- Null = not subscribed. Written ONLY by set_newsletter_opt_in(): no column update grant, so a client can never
-- store an arbitrary consent instant. No mail is sent yet (EMAIL_PROVIDER=none, N5). `users` is already in the
-- user export (select *) and goes with the account on erasure, so both cover this column with no extra code.
alter table public.users add column newsletter_opt_in_at timestamptz;

comment on column public.users.newsletter_opt_in_at is
  'Newsletter consent instant (app-footer spec N1). Null = not subscribed. Written only by '
  'set_newsletter_opt_in(); true keeps the FIRST consent instant, false clears it.';

create function public.set_newsletter_opt_in(p_opt_in boolean) returns timestamptz
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'set_newsletter_opt_in: not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if p_opt_in is null then
    raise exception 'set_newsletter_opt_in: p_opt_in is required' using errcode = 'null_value_not_allowed';
  end if;

  if p_opt_in then
    update public.users
       set newsletter_opt_in_at = coalesce(newsletter_opt_in_at, pg_catalog.now())
     where id = v_uid
     returning newsletter_opt_in_at into v_at;
  else
    update public.users
       set newsletter_opt_in_at = null
     where id = v_uid
     returning newsletter_opt_in_at into v_at;
  end if;

  return v_at;
end;
$$;

revoke all on function public.set_newsletter_opt_in(boolean) from public, anon;
grant execute on function public.set_newsletter_opt_in(boolean) to authenticated;
