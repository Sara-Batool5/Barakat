-- =====================================================================
-- Step 5: storage for the photo-reading agent, and the updated submit function.
-- Run once, after 01 to 09. Safe to run more than once. Do not run 09 again afterwards.
--
-- 1. vision_analyses: what the AI saw in each photo. Only the server (service key) can write to it.
-- 2. submit_surplus_batch() gets an optional analysis id. When given, the batch records the AI's confidence
--    and a "vision_read" entry appears in its activity timeline.
-- =====================================================================

create table if not exists public.vision_analyses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  model         text not null,
  confidence    numeric(3, 2),
  result        jsonb not null,
  used_in_batch uuid references public.batches (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_vision_user on public.vision_analyses (user_id, created_at desc);

alter table public.vision_analyses enable row level security;

drop policy if exists "analyses_read_own" on public.vision_analyses;
create policy "analyses_read_own" on public.vision_analyses for select to authenticated
  using (user_id = auth.uid() or public.is_coordinator());
-- No insert, update or delete policy on purpose: only the server, with the service key, writes here.

-- Replace the Step 4 version (8 parameters) with the new one (9 parameters).
drop function if exists public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb);

create or replace function public.submit_surplus_batch(
  p_batch_id       uuid,
  p_prepared_at    timestamptz,
  p_storage        public.storage_type,
  p_temp           numeric,
  p_pickup_minutes integer,
  p_notes          text,
  p_photo_path     text,
  p_items          jsonb,
  p_analysis_id    uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me        uuid := auth.uid();
  rid       uuid := public.my_restaurant_id();
  rules     jsonb;
  item      jsonb;
  cat       text;
  n         integer;
  total     integer := 0;
  item_alg  text[];
  all_alg   text[] := '{}';
  va        public.vision_analyses%rowtype;
  conf      numeric(3, 2) := null;
begin
  if me is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;
  if rid is null or public.current_app_role() is distinct from 'restaurant' then
    raise exception 'Only a restaurant account with a venue can submit surplus.' using errcode = '42501';
  end if;

  n := coalesce(jsonb_array_length(p_items), 0);
  if n < 1 or n > 8 then
    raise exception 'Between 1 and 8 items are required.';
  end if;
  if p_pickup_minutes is null or p_pickup_minutes < 30 or p_pickup_minutes > 720 then
    raise exception 'The pickup window must be between 30 and 720 minutes.';
  end if;
  if p_temp is not null and (p_temp < -30 or p_temp > 80) then
    raise exception 'The temperature is out of range.';
  end if;
  if p_prepared_at is not null and (p_prepared_at > now() + interval '5 minutes' or p_prepared_at < now() - interval '3 days') then
    raise exception 'The preparation time is out of range.';
  end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> me::text then
    raise exception 'The photo must be stored in your own folder.';
  end if;

  select value into rules from public.app_config where key = 'safety_rules';
  if rules is null then
    raise exception 'The safety rules are missing. Run the seed files first.';
  end if;

  -- The AI's reading must belong to this user and must not already be used by another batch.
  if p_analysis_id is not null then
    select * into va from public.vision_analyses
    where id = p_analysis_id and user_id = me and used_in_batch is null;
    if found then
      conf := va.confidence;
    end if;
  end if;

  insert into public.batches (
    id, restaurant_id, status, submitted_at, prepared_at, stored_temp_c, storage,
    est_portions, confidence, photo_path, notes, pickup_from, pickup_until, is_sample
  ) values (
    p_batch_id, rid, 'draft', now(), p_prepared_at, p_temp, p_storage,
    0, conf, p_photo_path, nullif(left(coalesce(p_notes, ''), 500), ''), now(),
    now() + make_interval(mins => p_pickup_minutes), false
  );

  for item in select * from jsonb_array_elements(p_items) loop
    cat := item ->> 'category';
    if (rules -> 'categories' -> cat) is null then
      raise exception 'Unknown food category: %', coalesce(cat, '(none)');
    end if;
    if coalesce((item ->> 'portions')::integer, 0) < 1 or (item ->> 'portions')::integer > 500 then
      raise exception 'Portions must be between 1 and 500.';
    end if;
    if length(coalesce(trim(item ->> 'name'), '')) < 1 then
      raise exception 'Each item needs a name.';
    end if;

    select coalesce(array_agg(x), '{}') into item_alg
    from jsonb_array_elements_text(coalesce(item -> 'allergens', '[]'::jsonb)) as x;

    insert into public.batch_items (batch_id, name, category, portions, storage, allergens, is_sample)
    values (
      p_batch_id, left(trim(item ->> 'name'), 120), cat, (item ->> 'portions')::integer,
      (rules -> 'categories' -> cat ->> 'storage')::public.storage_type, item_alg, false
    );

    total := total + (item ->> 'portions')::integer;
    all_alg := all_alg || item_alg;
  end loop;

  update public.batches
  set est_portions = total,
      allergens = (select coalesce(array_agg(distinct a), '{}') from unnest(all_alg) as a)
  where id = p_batch_id;

  insert into public.agent_events (batch_id, event_type, actor, tone, title, detail, payload, created_at, is_sample)
  values (
    p_batch_id, 'photo_received', 'restaurant', 'neutral', 'Surplus submitted',
    total::text || ' portions submitted by the restaurant', jsonb_build_object('portions', total), now(), false
  );

  if va.id is not null then
    update public.vision_analyses set used_in_batch = p_batch_id where id = va.id;
    insert into public.agent_events (batch_id, event_type, actor, tone, title, detail, payload, created_at, is_sample)
    values (
      p_batch_id, 'vision_read', 'agent',
      case when coalesce(conf, 0) >= 0.75 then 'green' else 'amber' end,
      'Items identified',
      'The photo was read by ' || va.model || ' with ' || round(coalesce(conf, 0) * 100)::text || '% confidence, then confirmed by the restaurant',
      jsonb_build_object('analysis_id', va.id, 'model', va.model, 'confidence', conf, 'photo_quality', va.result ->> 'photoQuality'),
      clock_timestamp(), false
    );
  end if;

  return p_batch_id;
end $$;

revoke all on function public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb, uuid) from public;
grant execute on function public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb, uuid) to authenticated;
