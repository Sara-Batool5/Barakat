-- =====================================================================
-- Step 12: the scheduler. It wakes the agent every 2 minutes, so offers lapse, retries happen and batches
-- expire even when nobody has the website open. It also keeps the free Supabase project from going idle.
--
-- BEFORE YOU RUN THIS, change the two words in capitals below (keep the quotes):
--   YOUR-SITE.vercel.app  ->  your website address, without https:// and without a slash at the end
--   YOUR-SECRET           ->  the same long random text you saved in Vercel as CRON_SECRET
--
-- Then run it. After two to four minutes, open "System check" in the coordinator account:
-- the Scheduler line turns green.
--
-- To stop the scheduler (for example between demos to save free-plan usage):
--   select cron.unschedule('barakat-tick');
-- To start it again, run this file again.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'barakat-tick') then
    perform cron.unschedule('barakat-tick');
  end if;
end $$;

select cron.schedule(
  'barakat-tick',
  '*/2 * * * *',
  $job$
  select net.http_post(
    url := 'https://YOUR-SITE.vercel.app/api/dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-SECRET'),
    body := '{"action": "cron_tick"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);
