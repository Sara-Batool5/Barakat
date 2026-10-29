-- =====================================================================
-- BARAKAT row-level security. Run after 01_schema.sql. Safe to run more than once.
--
-- Who can see what:
--   restaurants  -> their own batches, items, checks, events, impact
--   volunteers   -> their own jobs, and the batches those jobs belong to
--   fridge hosts -> batches headed to their fridge
--   coordinators -> everything
--   anyone       -> the fridge map and the public safety rules
-- The agent itself runs on the server with the service key, which bypasses these rules.
-- =====================================================================

-- ---------- helper functions (security definer, so policies never loop on each other) ----------
create or replace function public.current_app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_restaurant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select restaurant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_volunteer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select volunteer_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_fridge_id() returns uuid
language sql stable security definer set search_path = public as $$
  select fridge_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_coordinator() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'coordinator', false)
$$;

create or replace function public.can_see_batch(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_coordinator()
    or exists (
      select 1 from public.batches b
      where b.id = bid
        and (
          b.restaurant_id = public.my_restaurant_id()
          or (b.fridge_id is not null and b.fridge_id = public.my_fridge_id())
          or exists (select 1 from public.jobs j where j.batch_id = b.id and j.volunteer_id = public.my_volunteer_id())
        )
    )
$$;

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
$$;

-- ---------- turn row-level security on ----------
alter table public.app_config       enable row level security;
alter table public.profiles         enable row level security;
alter table public.restaurants      enable row level security;
alter table public.fridges          enable row level security;
alter table public.volunteers       enable row level security;
alter table public.batches          enable row level security;
alter table public.batch_items      enable row level security;
alter table public.safety_checks    enable row level security;
alter table public.jobs             enable row level security;
alter table public.agent_events     enable row level security;
alter table public.fridge_stock_log enable row level security;
alter table public.impact_logs      enable row level security;

-- ---------- app_config: the rules are public on purpose (transparency) ----------
drop policy if exists "config_read_all" on public.app_config;
create policy "config_read_all" on public.app_config for select to anon, authenticated using (true);

-- ---------- profiles ----------
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_coordinator());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_app_role());

-- ---------- restaurants ----------
drop policy if exists "restaurants_read" on public.restaurants;
create policy "restaurants_read" on public.restaurants for select to authenticated
  using (public.can_see_restaurant(id));

drop policy if exists "restaurants_insert_own" on public.restaurants;
create policy "restaurants_insert_own" on public.restaurants for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "restaurants_update_own" on public.restaurants;
create policy "restaurants_update_own" on public.restaurants for update to authenticated
  using (owner_user_id = auth.uid() or public.is_coordinator());

-- ---------- fridges: the map is public ----------
drop policy if exists "fridges_read_all" on public.fridges;
create policy "fridges_read_all" on public.fridges for select to anon, authenticated using (true);

drop policy if exists "fridges_update_host_or_coordinator" on public.fridges;
create policy "fridges_update_host_or_coordinator" on public.fridges for update to authenticated
  using (id = public.my_fridge_id() or public.is_coordinator());

drop policy if exists "fridges_insert_coordinator" on public.fridges;
create policy "fridges_insert_coordinator" on public.fridges for insert to authenticated
  with check (public.is_coordinator());

-- ---------- volunteers ----------
drop policy if exists "volunteers_read" on public.volunteers;
create policy "volunteers_read" on public.volunteers for select to authenticated
  using (user_id = auth.uid() or id = public.my_volunteer_id() or public.is_coordinator());

drop policy if exists "volunteers_update_self" on public.volunteers;
create policy "volunteers_update_self" on public.volunteers for update to authenticated
  using (user_id = auth.uid() or id = public.my_volunteer_id() or public.is_coordinator());

-- ---------- batches and their children ----------
drop policy if exists "batches_read" on public.batches;
create policy "batches_read" on public.batches for select to authenticated
  using (public.can_see_batch(id));

drop policy if exists "batches_insert_own" on public.batches;
create policy "batches_insert_own" on public.batches for insert to authenticated
  with check (restaurant_id = public.my_restaurant_id() or public.is_coordinator());

drop policy if exists "batches_update_coordinator" on public.batches;
create policy "batches_update_coordinator" on public.batches for update to authenticated
  using (public.is_coordinator());

drop policy if exists "items_read" on public.batch_items;
create policy "items_read" on public.batch_items for select to authenticated
  using (public.can_see_batch(batch_id));

drop policy if exists "items_insert_own" on public.batch_items;
create policy "items_insert_own" on public.batch_items for insert to authenticated
  with check (public.can_see_batch(batch_id) and public.current_app_role() in ('restaurant', 'coordinator'));

drop policy if exists "checks_read" on public.safety_checks;
create policy "checks_read" on public.safety_checks for select to authenticated
  using (public.can_see_batch(batch_id));

drop policy if exists "events_read" on public.agent_events;
create policy "events_read" on public.agent_events for select to authenticated
  using (public.can_see_batch(batch_id));

-- ---------- jobs ----------
drop policy if exists "jobs_read" on public.jobs;
create policy "jobs_read" on public.jobs for select to authenticated
  using (volunteer_id = public.my_volunteer_id() or public.can_see_batch(batch_id));

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own" on public.jobs for update to authenticated
  using (volunteer_id = public.my_volunteer_id() or public.is_coordinator());

-- ---------- stock log and impact ----------
drop policy if exists "stock_read" on public.fridge_stock_log;
create policy "stock_read" on public.fridge_stock_log for select to authenticated
  using (fridge_id = public.my_fridge_id() or public.is_coordinator());

drop policy if exists "impact_read" on public.impact_logs;
create policy "impact_read" on public.impact_logs for select to authenticated
  using (restaurant_id = public.my_restaurant_id() or public.is_coordinator());

-- ---------- storage: private photo bucket ----------
drop policy if exists "surplus photos upload" on storage.objects;
create policy "surplus photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'surplus-photos');

drop policy if exists "surplus photos read" on storage.objects;
create policy "surplus photos read" on storage.objects for select to authenticated
  using (bucket_id = 'surplus-photos');
