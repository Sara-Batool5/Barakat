-- =====================================================================
-- Step 6: safe-window expiry and a "refresh the demo" helper.
-- Run once, after 01 to 10. Safe to run more than once.
--
-- 1. expire_stale_batches(): any real batch whose safe window has closed, and which has not reached a fridge,
--    becomes "expired", its open volunteer jobs are cancelled, and a timeline entry is written.
--    Sample data is left alone so the demo keeps its live examples.
-- 2. A scheduled job runs it every minute (pg_cron, free on Supabase).
-- 3. refresh_demo_data(): moves all sample timestamps forward so the sample batches look live again.
--    Run   select public.refresh_demo_data();   before a presentation.
-- =====================================================================

create or replace function public.expire_stale_batches() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with expired as (
    update public.batches
    set status = 'expired',
        reject_reason = coalesce(reject_reason, 'The safe window closed before the food reached a fridge.')
    where status in ('listed', 'matched', 'dispatched', 'picked_up', 'escalated')
      and safe_until is not null
      and safe_until < now()
      and is_sample = false
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

-- Run it every minute. If pg_cron is not available, enable it under Database > Extensions and run this file again.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('barakat-expire-batches', '* * * * *', 'select public.expire_stale_batches()');
exception when others then
  raise notice 'pg_cron could not be set up (%). Enable the pg_cron extension under Database > Extensions, then run this file again.', sqlerrm;
end $$;

create or replace function public.refresh_demo_data() returns text
language plpgsql security definer set search_path = public as $$
declare
  anchor timestamptz;
  shift  interval;
begin
  select max(submitted_at) into anchor from public.batches where is_sample;
  if anchor is null then
    return 'No sample data found. Run the seed files first.';
  end if;
  shift := (now() - interval '4 minutes') - anchor;
  if shift < interval '1 minute' then
    return 'The sample data is already fresh.';
  end if;

  update public.batches
  set submitted_at = submitted_at + shift, prepared_at = prepared_at + shift, pickup_from = pickup_from + shift,
      pickup_until = pickup_until + shift, safe_until = safe_until + shift
  where is_sample;
  update public.jobs
  set offered_at = offered_at + shift, responded_at = responded_at + shift,
      picked_up_at = picked_up_at + shift, delivered_at = delivered_at + shift
  where is_sample;
  update public.agent_events set created_at = created_at + shift where is_sample;
  update public.safety_checks set created_at = created_at + shift where is_sample;
  update public.fridge_stock_log set created_at = created_at + shift where is_sample;
  update public.impact_logs set created_at = created_at + shift where is_sample;
  update public.volunteers set joined_at = joined_at + shift where is_sample;

  return 'Sample data moved forward by ' || shift::text || '.';
end $$;

revoke all on function public.refresh_demo_data() from public;
