-- =====================================================================
-- Step 11: sourced factors, demo mode controls, and tighter function permissions.
-- Run once, after 01 to 13. Safe to run more than once.
--
-- 1. The impact factors and the safety rules now record their sources (see src/config).
-- 2. demo_mode: a switch (app_config key 'demo_mode') that shows the coordinator's demo controls.
--    Before a real launch run:  update public.app_config set value = '{"enabled": false}' where key = 'demo_mode';
-- 3. reset_demo_tests(): removes the batches created while testing and puts fridge stock, reservations,
--    ESG points and volunteer availability back to the sample baseline. Only works while demo mode is on.
-- 4. Hardening: the housekeeping and demo functions can only be run by the server (service role), not by
--    signed-in users through the public API.
-- =====================================================================

-- 1. sourced factors and rules
update public.app_config set value = '{"version": "2026.11-sourced", "status": "Meal weight and CO2e factor are taken from the sources listed below. ESG points per meal is a BARAKAT scoring rule, not an external standard. CO2e is a global-average estimate.", "kg_per_meal": 0.54, "co2e_kg_per_kg_food": 2.5, "esg_points_per_meal": 5, "sources": [{"id": "meal-weight", "label": "Meal weight: 1.2 pounds of food per meal (about 0.54 kg), the convention used by Feeding America and ReFED", "url": "https://docs.refed.org/methodologies/impact_calculator/meals_recovered.html"}, {"id": "fao-footprint", "label": "CO2e per kg: derived from FAO (2013), Food wastage footprint: about 3.3 Gt CO2e a year for about 1.3 Gt of edible food wasted, roughly 2.5 kg CO2e per kg (global average, excluding land-use change)", "url": "https://www.unccd.int/resources/unccd-library/food-wastage-key-facts-and-figures"}], "notes": "Meals are counted as rescued portions. The CO2e figure is a global average for food that is produced and not eaten; the real saving depends on the food. ESG points reward rescued meals and are not a regulated measure. Always show the factor version beside any figure."}'::jsonb, updated_at = now() where key = 'impact_factors';

update public.app_config
set value = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(value,
      '{version}', '"2026.11-sourced"'::jsonb, true),
      '{status}', '"The 5 C cold-storage limit follows Dubai Municipality requirements (see sources). The time limits (max_safe_hours) and the 24 hour window are BARAKAT''s own conservative defaults, not Dubai Municipality figures, and should be confirmed with the authority before real use."'::jsonb, true),
      '{sources}', '[{"id": "dm-circular", "label": "Dubai Municipality, external circulars on health and safety (food delivery: hot food at 60 C or above, cold food at 5 C or below)", "url": "https://stgportalnew.dm.gov.ae/wp-content/uploads/2020/09/22_External_Circulars_Health_Safety.pdf"}, {"id": "dm-food-code", "label": "Dubai Municipality Food Code 2.0 (draft version 4, 2020)", "url": "https://stgportalnew.dm.gov.ae/wp-content/uploads/2020/11/Food-Code-2.0-Draft-Version-4.pdf"}, {"id": "gulfnews-charity-fridges", "label": "Gulf News: Dubai outlines safety standards for public drinking water coolers and charity fridges (refrigeration at 5 C or below)", "url": "https://gulfnews.com/uae/dubai-outlines-safety-standards-for-public-drinking-water-coolers-and-charity-fridges-1.500610325"}]'::jsonb, true),
      '{temperature_c,source}', '"Dubai Municipality: charity fridges and food delivery requirements, cold food at 5 C or below"'::jsonb, true),
      '{disclaimer}', '"BARAKAT screens food; it does not certify it."'::jsonb, true),
    updated_at = now()
where key = 'safety_rules';

-- 2. demo mode switch (on by default for the competition)
insert into public.app_config (key, value) values ('demo_mode', '{"enabled": true}'::jsonb)
on conflict (key) do nothing;

-- 3. clear test data
create or replace function public.reset_demo_tests() returns text
language plpgsql security definer set search_path = public as $$
declare
  enabled   boolean := coalesce((select (value ->> 'enabled')::boolean from public.app_config where key = 'demo_mode'), false);
  n_batches integer;
begin
  if not enabled then
    raise exception 'Demo mode is switched off.';
  end if;

  select count(*) into n_batches from public.batches where is_sample = false;

  delete from public.batches where is_sample = false;              -- items, jobs, events, checks and impact go with them
  delete from public.fridge_stock_log where is_sample = false;
  delete from public.vision_analyses;

  update public.fridges f
  set reserved_portions = 0,
      current_stock = coalesce((
        select greatest(0, least(f.capacity_portions, sum(l.delta_portions)))::integer
        from public.fridge_stock_log l where l.fridge_id = f.id
      ), 0)
  where f.is_sample;

  update public.restaurants r
  set esg_points = coalesce((select sum(i.esg_points)::integer from public.impact_logs i where i.restaurant_id = r.id), 0)
  where r.is_sample;

  update public.volunteers v
  set status = case
        when exists (select 1 from public.jobs j where j.volunteer_id = v.id and j.status in ('offered', 'accepted', 'picked_up'))
          then 'busy'::public.volunteer_status
        else 'available'::public.volunteer_status end
  where v.is_sample and v.status <> 'offline';

  -- volunteers played by a demo account must be free to receive offers
  update public.volunteers set status = 'available' where is_sample and user_id is not null;

  return 'Removed ' || n_batches::text || ' test batches and reset fridge stock, reservations, points and volunteers.';
end $$;

-- 4. hardening: only the server may run these
revoke all on function public.reset_demo_tests() from public, anon, authenticated;
grant execute on function public.reset_demo_tests() to service_role;
revoke all on function public.refresh_demo_data() from public, anon, authenticated;
grant execute on function public.refresh_demo_data() to service_role;
revoke all on function public.expire_stale_batches() from public, anon, authenticated;
grant execute on function public.expire_stale_batches() to service_role;
revoke execute on function public.submit_surplus_batch(uuid, timestamptz, public.storage_type, numeric, integer, text, text, jsonb, uuid, boolean) from anon;
