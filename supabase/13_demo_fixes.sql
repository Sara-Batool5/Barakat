-- =====================================================================
-- Step 8 fixes: smoother demo, sealed chilled packs, asking for a coordinator check, photos for volunteers and hosts.
-- Run once, after 01 to 12. Safe to run more than once.
--
-- 1. Rules: a new category "Sealed chilled packs" (no preparation time needed), and a 15 minute answer time for
--    signed-in volunteers (demo volunteers still answer within 6 minutes).
-- 2. batches.review_requested: a restaurant can ask a coordinator to check a batch before it is listed.
-- 3. submit_surplus_batch() accepts that choice (replaces the 9 parameter version).
-- 4. Real photos: volunteers with a job on a batch, and fridge hosts for batches headed to their fridge, can now see its photo.
-- 5. Fridge hosts can see the name of a restaurant that is sending food to their fridge.
-- 6. The demo volunteer is made available.
-- =====================================================================

-- 1. rules
update public.app_config
set value = jsonb_set(
      jsonb_set(
        jsonb_set(value, '{version}', '"2026.11-draft"'::jsonb, true),
        '{dispatch,human_offer_timeout_minutes}', '15'::jsonb, true),
      '{categories,packaged_chilled}',
      '{"tier":"amber","storage":"chilled","max_safe_hours":24,"label":{"en":"Sealed chilled packs","ar":"عبوات مبرّدة مغلقة"},"requires":["sealed_packaging_intact","expiry_date_visible","stored_temp_c"]}'::jsonb,
      true),
    updated_at = now()
where key = 'safety_rules';

-- 2. the flag
alter table public.batches add column if not exists review_requested boolean not null default false;

-- 3. the submit function
drop function if exists public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb, uuid);

create or replace function public.submit_surplus_batch(
  p_batch_id         uuid,
  p_prepared_at      timestamptz,
  p_storage          public.storage_type,
  p_temp             numeric,
  p_pickup_minutes   integer,
  p_notes            text,
  p_photo_path       text,
  p_items            jsonb,
  p_analysis_id      uuid default null,
  p_review_requested boolean default false
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

  if p_analysis_id is not null then
    select * into va from public.vision_analyses
    where id = p_analysis_id and user_id = me and used_in_batch is null;
    if found then
      conf := va.confidence;
    end if;
  end if;

  insert into public.batches (
    id, restaurant_id, status, submitted_at, prepared_at, stored_temp_c, storage,
    est_portions, confidence, photo_path, notes, pickup_from, pickup_until, review_requested, is_sample
  ) values (
    p_batch_id, rid, 'draft', now(), p_prepared_at, p_temp, p_storage,
    0, conf, p_photo_path, nullif(left(coalesce(p_notes, ''), 500), ''), now(),
    now() + make_interval(mins => p_pickup_minutes), coalesce(p_review_requested, false), false
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

revoke all on function public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb, uuid, boolean) from public;
grant execute on function public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb, uuid, boolean) to authenticated;

-- 5. fridge hosts can see who is sending food to their fridge
create or replace function public.can_see_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_coordinator()
    or rid = public.my_restaurant_id()
    or exists (select 1 from public.restaurants r where r.id = rid and r.owner_user_id = auth.uid())
    or exists (
      select 1 from public.batches b
      join public.jobs j on j.batch_id = b.id
      where b.restaurant_id = rid and j.volunteer_id = public.my_volunteer_id()
    )
    or exists (
      select 1 from public.batches b
      where b.restaurant_id = rid and b.fridge_id is not null and b.fridge_id = public.my_fridge_id()
    )
$$;

-- 4. photos: the restaurant, coordinators, and anyone who can see the batch the photo belongs to
drop policy if exists "surplus photos read" on storage.objects;
create policy "surplus photos read" on storage.objects for select to authenticated
  using (
    bucket_id = 'surplus-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_coordinator()
      or exists (select 1 from public.batches b where b.photo_path = name and public.can_see_batch(b.id))
    )
  );

-- 6. the demo volunteer should be free to receive offers
update public.volunteers set status = 'available' where id = public._i('volunteer', '34');
