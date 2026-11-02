-- =====================================================================
-- Step 7: fridge matching and volunteer dispatch.
-- Run once, after 01 to 11. Safe to run more than once.
--
-- 1. fridges.reserved_portions: room the agent has promised to a batch that is on its way.
-- 2. jobs.expires_at: when an offer lapses if nobody answers.
-- 3. At most one open offer or trip per batch (stops two processes offering the same food twice).
-- 4. Volunteers can no longer edit jobs directly; every step goes through the server so the rules are enforced.
-- 5. Expiry now also releases fridge reservations and frees volunteers.
-- 6. The demo volunteer is made available so the demo flow reaches them.
-- =====================================================================

alter table public.fridges add column if not exists reserved_portions integer not null default 0;
do $$ begin
  alter table public.fridges add constraint fridge_reserved_nonneg check (reserved_portions >= 0);
exception when duplicate_object then null; end $$;

alter table public.jobs add column if not exists expires_at timestamptz;

create unique index if not exists uniq_open_job_per_batch
  on public.jobs (batch_id) where status in ('offered', 'accepted', 'picked_up');

drop policy if exists "jobs_update_own" on public.jobs;

create or replace function public.expire_stale_batches() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  -- 1. give back the room promised in fridges
  update public.fridges f
  set reserved_portions = greatest(0, f.reserved_portions - r.p)
  from (
    select fridge_id, sum(est_portions) as p
    from public.batches
    where status in ('matched', 'dispatched', 'picked_up') and fridge_id is not null
      and safe_until is not null and safe_until < now() and is_sample = false
    group by fridge_id
  ) r
  where f.id = r.fridge_id;

  -- 2. free volunteers who were holding a job on a batch that is about to expire
  update public.volunteers v
  set status = 'available'
  where v.status = 'busy'
    and v.id in (
      select j.volunteer_id
      from public.jobs j join public.batches b on b.id = j.batch_id
      where j.status in ('offered', 'accepted', 'picked_up')
        and b.status in ('listed', 'matched', 'dispatched', 'picked_up', 'escalated')
        and b.safe_until is not null and b.safe_until < now() and b.is_sample = false
    );

  -- 3. expire the batches, cancel their open jobs, write the timeline entry
  with expired as (
    update public.batches
    set status = 'expired',
        reject_reason = coalesce(reject_reason, 'The safe window closed before the food reached a fridge.')
    where status in ('listed', 'matched', 'dispatched', 'picked_up', 'escalated')
      and safe_until is not null and safe_until < now() and is_sample = false
    returning id
  ), ev as (
    insert into public.agent_events (batch_id, event_type, actor, tone, title, detail, payload, is_sample)
    select id, 'expired', 'system', 'red', 'Batch expired',
           'The safe window closed before the food reached a fridge.', '{}'::jsonb, false
    from expired
    returning 1
  ), jb as (
    update public.jobs set status = 'cancelled'
    where batch_id in (select id from expired) and status in ('offered', 'accepted', 'picked_up')
    returning 1
  )
  select count(*) into n from expired;
  return coalesce(n, 0);
end $$;

revoke all on function public.expire_stale_batches() from public;

-- The demo volunteer should be free to receive offers.
update public.volunteers set status = 'available' where id = public._i('volunteer', '34');
