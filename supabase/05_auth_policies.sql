-- =====================================================================
-- Step 3: extra security rules so people can create their own profile and records.
-- Run once, after 01 and 02. Safe to run more than once.
-- =====================================================================

-- A new volunteer can create their own volunteer record.
drop policy if exists "volunteers_insert_own" on public.volunteers;
create policy "volunteers_insert_own" on public.volunteers for insert to authenticated
  with check (user_id = auth.uid());

-- Safety net: if the sign-up trigger did not create a profile, the app can create it.
-- Self-service roles only. Nobody can make themselves a coordinator.
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role in ('restaurant', 'volunteer', 'fridge_host'));
