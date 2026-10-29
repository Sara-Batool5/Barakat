-- =====================================================================
-- DANGER: deletes every BARAKAT table, type and function in this project's public schema.
-- Use only to start over. Then run 01_schema.sql again, and the rest in order.
-- It does not delete your sign-in users (auth.users).
-- =====================================================================
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists public.v_fridge_overview;
drop view if exists public.v_restaurant_impact_monthly;
drop view if exists public.v_platform_totals;
drop table if exists public.impact_logs cascade;
drop table if exists public.fridge_stock_log cascade;
drop table if exists public.agent_events cascade;
drop table if exists public.jobs cascade;
drop table if exists public.safety_checks cascade;
drop table if exists public.batch_items cascade;
drop table if exists public.batches cascade;
drop table if exists public.profiles cascade;
drop table if exists public.volunteers cascade;
drop table if exists public.fridges cascade;
drop table if exists public.restaurants cascade;
drop table if exists public.app_config cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.can_see_batch(uuid);
drop function if exists public.can_see_restaurant(uuid);
drop function if exists public.is_coordinator();
drop function if exists public.my_fridge_id();
drop function if exists public.my_volunteer_id();
drop function if exists public.my_restaurant_id();
drop function if exists public.current_app_role();
drop function if exists public.set_updated_at() cascade;
drop function if exists public.haversine_km(double precision, double precision, double precision, double precision);
drop function if exists public._t(integer);
drop function if exists public._i(text, text);
drop type if exists public.user_role, public.venue_type, public.food_tier, public.batch_status, public.job_status,
  public.fridge_status, public.transport_type, public.volunteer_status, public.storage_type cascade;
