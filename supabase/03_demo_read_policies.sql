-- =====================================================================
-- OPTIONAL: lets the app read the SAMPLE data before real sign-in exists (Step 3).
-- It only exposes rows marked is_sample = true, so real data stays protected.
-- Remove it before real launch by running 04_drop_demo_read_policies.sql.
-- =====================================================================

drop policy if exists "demo_read_restaurants" on public.restaurants;
create policy "demo_read_restaurants" on public.restaurants for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_fridges" on public.fridges;
create policy "demo_read_fridges" on public.fridges for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_volunteers" on public.volunteers;
create policy "demo_read_volunteers" on public.volunteers for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_batches" on public.batches;
create policy "demo_read_batches" on public.batches for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_batch_items" on public.batch_items;
create policy "demo_read_batch_items" on public.batch_items for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_safety_checks" on public.safety_checks;
create policy "demo_read_safety_checks" on public.safety_checks for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_jobs" on public.jobs;
create policy "demo_read_jobs" on public.jobs for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_agent_events" on public.agent_events;
create policy "demo_read_agent_events" on public.agent_events for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_fridge_stock_log" on public.fridge_stock_log;
create policy "demo_read_fridge_stock_log" on public.fridge_stock_log for select to anon, authenticated using (is_sample = true);

drop policy if exists "demo_read_impact_logs" on public.impact_logs;
create policy "demo_read_impact_logs" on public.impact_logs for select to anon, authenticated using (is_sample = true);
