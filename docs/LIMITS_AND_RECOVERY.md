# Free-plan limits and what to do when something breaks

Limits checked on 18 November 2026. They change: confirm on each provider's page before relying on them.

## Limits that matter for BARAKAT
| Service | Limit | What it means for us |
|---|---|---|
| Supabase Free | Project **pauses after 1 week of inactivity**; 500 MB database; 1 GB file storage; 5 GB bandwidth; 50,000 monthly users; 2 active projects; **no automatic backups** | The scheduler (Step 12) keeps it active. Keep photos small (the app compresses them). Back up by keeping the SQL files and the zips. |
| Vercel Hobby | **Scheduled jobs run only once a day**; about 1 million function calls a month and a few CPU-hours; personal, non-commercial use only | The scheduler runs from Supabase every 2 minutes instead. Stop it between demos if you want to save usage. A commercial launch needs Pro. |
| Gemini API free tier | Per-minute and per-day request limits that depend on the model and change often (roughly 10 to 30 a minute and 500 to 1,500 a day for the Flash family); limits are per project and reset at midnight Pacific time. Free-tier prompts may be used by Google to improve its products | Photo reading may refuse during a busy demo. Use the demo dish shortcuts as plan B. Only food photos are sent. Check your limits in AI Studio. |

Sources: Supabase pricing page (supabase.com/docs/pricing); Vercel docs on cron jobs and the Hobby plan (vercel.com/docs/schedules/cron-jobs/usage-and-pricing, vercel.com/docs/plans/hobby); Google AI for Developers rate limits (ai.google.dev/gemini-api/docs/rate-limits).

## If something breaks
| What you see | Likely cause | Do this |
|---|---|---|
| Blank page or "Something went wrong" | A crash in the website | Copy the error line shown, send it to the developer. Reload. |
| Sign-in fails for everyone | Supabase project paused | Supabase dashboard > restore the project; wait two minutes. |
| "Could not read this photo" | Gemini limit reached or key missing | Wait a minute and retry; use a demo dish; check `GEMINI_API_KEY` in System check. |
| Offers do not move on by themselves | Scheduler not running | System check > Scheduler; re-run `15_scheduler.sql`. |
| Sample rescues look old on the map | Demo data needs refreshing | Coordinator > Refresh demo data. |
| Messy data after rehearsals | Test batches left behind | Coordinator > Clear my test batches. |
| A page says to run a SQL file | A setup step was skipped | Run the named file in the SQL Editor. |
| Everything is down on the day | Internet or provider outage | Plan B below. |

## Plan B for demo day
1. Record a 3-minute screen video of the full flow beforehand and keep it on your phone and a USB stick.
2. Keep screenshots of each role's main page (Step 13 lists which).
3. Keep the pitch deck as a file that works offline.
4. If the live site fails, say so calmly, show the video, and offer to run it live afterwards.

## Backups on the free plan
- The code is safe on GitHub, and every step zip is a full copy.
- The sample data can be recreated from the seed files (`supabase/seed_part*.sql`).
- Real data (accounts, batches) is not backed up automatically. If you start collecting real data, upgrade to Supabase Pro or export tables regularly (Table Editor > Export as CSV).
