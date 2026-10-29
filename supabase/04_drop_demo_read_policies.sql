-- Removes the demo read access. Run this before real launch.

drop policy if exists "demo_read_restaurants" on public.restaurants;
drop policy if exists "demo_read_fridges" on public.fridges;
drop policy if exists "demo_read_volunteers" on public.volunteers;
drop policy if exists "demo_read_batches" on public.batches;
drop policy if exists "demo_read_batch_items" on public.batch_items;
drop policy if exists "demo_read_safety_checks" on public.safety_checks;
drop policy if exists "demo_read_jobs" on public.jobs;
drop policy if exists "demo_read_agent_events" on public.agent_events;
drop policy if exists "demo_read_fridge_stock_log" on public.fridge_stock_log;
drop policy if exists "demo_read_impact_logs" on public.impact_logs;
