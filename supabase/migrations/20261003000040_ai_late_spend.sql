-- A provider call can outlive its reservation: the next ai_reserve releases an expired hold (ai_release_expired)
-- without spending anything, and the late ai_settle / ai_release then found no 'held' row and dropped the real
-- cost — the global USD budget under-counted by every slow call. Whole-branch review of part 1b, finding 1.
--
-- An expired release is now marked (expired_at). A settle or release that arrives after it still adds its cost
-- to that day's spend, exactly once (late_spent_at), and charges no learner: the hold the learner paid with is
-- gone. A normal release stays final — a second release of it changes nothing.

alter table ai_reservations
  add column expired_at timestamptz,
  add column late_spent_at timestamptz;

create or replace function ai_release_expired() returns void
language plpgsql security definer set search_path = public as $$
begin
  with expired as (
    update ai_reservations set status = 'released', closed_at = now(), expired_at = now()
    where status = 'held' and expires_at < now()
    returning period_day, reserved_usd
  ), per_day as (
    select period_day, sum(reserved_usd) as usd from expired group by period_day
  )
  update ai_budget_days b set reserved_usd = greatest(b.reserved_usd - per_day.usd, 0)
  from per_day where b.period_day = per_day.period_day;
end $$;

-- The cost of a call whose hold expired before it finished: spent once, on the hold's day.
create function ai_record_late_spend(p_reservation uuid, p_usd numeric) returns void
language plpgsql security definer set search_path = public as $$
declare v_day date;
begin
  if coalesce(p_usd, 0) <= 0 then return; end if;
  update ai_reservations set late_spent_at = now()
    where id = p_reservation and status = 'released' and expired_at is not null and late_spent_at is null
    returning period_day into v_day;
  if not found then return; end if;
  update ai_budget_days set spent_usd = spent_usd + p_usd where period_day = v_day;
end $$;

create or replace function ai_settle(p_reservation uuid, p_generation uuid, p_actual_credits int, p_actual_usd numeric)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_res ai_reservations%rowtype;
begin
  update ai_reservations set status = 'settled', closed_at = now()
    where id = p_reservation and status = 'held'
    returning * into v_res;
  if not found then
    perform ai_record_late_spend(p_reservation, p_actual_usd);
    return false;
  end if;
  update ai_budget_days
    set reserved_usd = greatest(reserved_usd - v_res.reserved_usd, 0), spent_usd = spent_usd + p_actual_usd
    where period_day = v_res.period_day;
  if v_res.billing_scope = 'learner' and v_res.requested_by_user_id is not null then
    insert into ai_usage_charges (user_id, entitlement_kind, fingerprint, credits, generation_id, reservation_id,
      period_day, period_month)
    values (v_res.requested_by_user_id, v_res.entitlement_kind, v_res.fingerprint,
      case when v_res.entitlement_kind in ('plus_section', 'korume_plus_turn') then greatest(p_actual_credits, 0) else 0 end,
      p_generation, v_res.id, v_res.period_day, v_res.period_month)
    on conflict do nothing;
  end if;
  return true;
end $$;

create or replace function ai_release(p_reservation uuid, p_spent_usd numeric default 0)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_res ai_reservations%rowtype;
begin
  update ai_reservations set status = 'released', closed_at = now()
    where id = p_reservation and status = 'held'
    returning * into v_res;
  if not found then
    perform ai_record_late_spend(p_reservation, p_spent_usd);
    return false;
  end if;
  update ai_budget_days
    set reserved_usd = greatest(reserved_usd - v_res.reserved_usd, 0), spent_usd = spent_usd + p_spent_usd
    where period_day = v_res.period_day;
  return true;
end $$;

revoke all on function ai_record_late_spend(uuid, numeric) from public, anon, authenticated;
revoke all on function ai_release_expired() from public, anon, authenticated;
revoke all on function ai_settle(uuid, uuid, int, numeric) from public, anon, authenticated;
revoke all on function ai_release(uuid, numeric) from public, anon, authenticated;
grant execute on function ai_record_late_spend(uuid, numeric) to service_role;
grant execute on function ai_release_expired() to service_role;
grant execute on function ai_settle(uuid, uuid, int, numeric) to service_role;
grant execute on function ai_release(uuid, numeric) to service_role;
