-- =====================================================================
-- Run this last. It should show these row counts:
--   restaurants 24, fridges 34, volunteers 38, batches 175, batch_items 305, safety_checks 189,
--   jobs 186, agent_events 1663, fridge_stock_log 687, impact_logs 131
-- =====================================================================
select 'restaurants' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.restaurants
union all
select 'fridges' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.fridges
union all
select 'volunteers' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.volunteers
union all
select 'batches' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.batches
union all
select 'batch_items' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.batch_items
union all
select 'safety_checks' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.safety_checks
union all
select 'jobs' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.jobs
union all
select 'agent_events' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.agent_events
union all
select 'fridge_stock_log' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.fridge_stock_log
union all
select 'impact_logs' as table_name, count(*) as total_rows, count(*) filter (where is_sample) as sample_rows from public.impact_logs
order by table_name;

-- Batches by status (live ones: listed, matched, dispatched, picked_up, escalated)
select status, count(*) as batches from public.batches group by status order by batches desc;

-- Batches by safety tier
select tier, count(*) as batches from public.batches group by tier order by tier;

-- Platform totals (uses the placeholder impact factors)
select * from public.v_platform_totals;

-- Fridge network at a glance
select status, count(*) as fridges, sum(capacity_portions) as capacity, sum(current_stock) as stock
from public.fridges group by status order by status;
