# BARAKAT deployment checklist

Do these in order. When you finish, open **System check** in the coordinator account: every line should be green.

## 1. Accounts (all free)
- GitHub (the code), Vercel Hobby (the website), Supabase Free (database, sign-in, photo storage), Google AI Studio (the photo-reading key).

## 2. Keys to add in Vercel (Project > Settings > Environment Variables)
Add each one, then **redeploy** (Deployments > the latest one > Redeploy). A key change does nothing until you redeploy.

| Name | What it is | Where to find it | Secret? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project address | Supabase > Project Settings > API > Project URL | No (the website needs it) |
| `VITE_SUPABASE_ANON_KEY` | The public key | Supabase > Project Settings > API > publishable / anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | The agent's powerful key | Supabase > Project Settings > API > service_role key | **Yes. Never start its name with VITE_, never put it in GitHub** |
| `GEMINI_API_KEY` | Photo reading | Google AI Studio > Get API key | **Yes** |
| `CRON_SECRET` | Password for the scheduler | Make it up: 30 or more random letters and numbers | **Yes** |

## 3. SQL files, in this order (Supabase > SQL Editor > paste the whole file > Run)
1. `01_schema.sql`, `02_policies.sql`, `03_demo_read_policies.sql`
2. `seed_part1of5.sql` to `seed_part5of5.sql` (one at a time, in order)
3. `05_auth_policies.sql`, `06_demo_accounts_create.sql`, `07_demo_accounts_link.sql`
4. `09_intake.sql`, `10_vision.sql`, `11_safety.sql`
5. `12_dispatch.sql`, `13_demo_fixes.sql`, `14_demo_mode.sql`
6. `15_scheduler.sql` (**edit it first**, see the next section)

Optional checks: `90_verify.sql` (data), `91_verify_auth.sql` (accounts).

## 4. The scheduler (so the agent works when nobody has the site open)
1. In Vercel add `CRON_SECRET` (see the table) and redeploy.
2. Open `supabase/15_scheduler.sql`. Replace `YOUR-SITE.vercel.app` with your website address (no https://, no slash) and `YOUR-SECRET` with the same text as `CRON_SECRET`. Keep the quotes.
3. Run it in the SQL Editor.
4. Wait two to four minutes, open **System check** and press **Run the check**. The Scheduler line should say "Last run 1 minutes ago".
- To stop it: `select cron.unschedule('barakat-tick');`. To start it again, run the file again.
- Why it matters: Vercel's free plan can only run a scheduled job once a day, so the schedule runs from Supabase instead. It also keeps the free Supabase project from going idle.

## 5. Supabase settings to check once
- Authentication > Providers > Email is on. For the demo accounts nothing else is needed.
- Authentication > URL Configuration: set the Site URL to your website address.
- Storage: a private bucket named `surplus-photos` exists (`09_intake.sql` creates it).

## 6. Before the competition day
- [ ] System check is all green.
- [ ] Run the 10-minute smoke test in `docs/TEST_PLAN.md`.
- [ ] Coordinator home: **Refresh demo data**, then **Clear my test batches** so the demo starts clean.
- [ ] Open the site on your phone and on the venue's network if you can.
- [ ] Check your Gemini key still works (submit one real photo). Keep the demo dish shortcuts as plan B.
- [ ] Open the project in Supabase and Vercel once in the week before (free Supabase projects pause after a week with no activity; the scheduler also prevents this).
- [ ] Take screenshots and a screen recording as a backup (see `docs/LIMITS_AND_RECOVERY.md`).

## 7. Before a real launch (not needed for the competition)
- [ ] Switch demo mode off: `update public.app_config set value = '{"enabled": false}' where key = 'demo_mode';`
- [ ] Remove demo accounts: `08_remove_demo_accounts.sql`. Remove public sample access: `04_drop_demo_read_policies.sql`.
- [ ] Vercel's Hobby plan is for personal, non-commercial use. A commercial launch needs the Pro plan.
- [ ] Supabase Free has no automatic backups and pauses after a week idle. A real service needs the Pro plan, or at least the scheduler plus regular exports.
- [ ] Confirm the safety time limits with Dubai Municipality (only the 5 C cold limit is sourced; see `docs/SOURCES_AND_CLAIMS.md`).
- [ ] Add a privacy notice (food photos are sent to Google's Gemini service for reading) and get advice on UAE data rules.
- [ ] Use your own domain and turn on Vercel's usage alerts.

## 8. Security notes
- Only the server holds the service key and the Gemini key. The website only has the public key.
- Row-level security decides who can read and change each table. The housekeeping and demo database functions can only be run by the server (`14_demo_mode.sql`).
- Photo reading is limited to 30 analyses per user per window, so one account cannot use up your Gemini quota.
- The website sends basic security headers (`vercel.json`). It does not use a strict content policy, because the map and fonts load from other sites.
- Known gaps: no rate limit on the other server calls, no automatic backups on the free plan, and the demo accounts share one password. Fine for a competition, not for a launch.
