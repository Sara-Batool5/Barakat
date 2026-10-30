-- =====================================================================
-- Step 4: restaurant surplus submission.
-- Run once, after 01 to 07. Safe to run more than once.
--
-- What it does
--   1. Adds submit_surplus_batch(): the ONLY way a restaurant creates a batch. It checks who is asking,
--      forces status = 'draft', validates the items against the safety rules in app_config, and writes the batch,
--      its items and the first timeline event in one step.
--   2. Removes the direct insert rights on batches and batch_items (so nobody can fake a status or tier).
--   3. Limits the private photo bucket: each person can only use their own folder (named after their user id).
-- =====================================================================

-- The photo bucket (already created in 01; this is a safety net).
insert into storage.buckets (id, name, public)
values ('surplus-photos', 'surplus-photos', false)
on conflict (id) do nothing;

create or replace function public.submit_surplus_batch(
  p_batch_id      uuid,
  p_prepared_at   timestamptz,
  p_storage       public.storage_type,
  p_temp          numeric,
  p_pickup_minutes integer,
  p_notes         text,
  p_photo_path    text,
  p_items         jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me           uuid := auth.uid();
  rid          uuid := public.my_restaurant_id();
  rules        jsonb;
  item         jsonb;
  cat          text;
  n            integer;
  total        integer := 0;
  item_alg     text[];
  all_alg      text[] := '{}';
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

  insert into public.batches (
    id, restaurant_id, status, submitted_at, prepared_at, stored_temp_c, storage,
    est_portions, photo_path, notes, pickup_from, pickup_until, is_sample
  ) values (
    p_batch_id, rid, 'draft', now(), p_prepared_at, p_temp, p_storage,
    0, p_photo_path, nullif(left(coalesce(p_notes, ''), 500), ''), now(),
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

  insert into public.agent_events (batch_id, event_type, actor, tone, title, detail, payload, is_sample)
  values (
    p_batch_id, 'photo_received', 'restaurant', 'neutral', 'Surplus submitted',
    total::text || ' portions submitted by the restaurant', jsonb_build_object('portions', total), false
  );

  return p_batch_id;
end $$;

revoke all on function public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb) from public;
grant execute on function public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb) to authenticated;

-- Nobody creates batches or items directly any more; they go through the function above.
drop policy if exists "batches_insert_own" on public.batches;
drop policy if exists "items_insert_own" on public.batch_items;

-- Private photos: each person uses a folder named after their own user id; coordinators can read all.
drop policy if exists "surplus photos upload" on storage.objects;
create policy "surplus photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'surplus-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "surplus photos read" on storage.objects;
create policy "surplus photos read" on storage.objects for select to authenticated
  using (bucket_id = 'surplus-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coordinator()));

drop policy if exists "surplus photos delete own" on storage.objects;
create policy "surplus photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'surplus-photos' and (storage.foldername(name))[1] = auth.uid()::text);
