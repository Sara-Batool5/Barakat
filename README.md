# BARAKAT: Step 2 (database and sample data)

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase. English and Arabic (right-to-left).

## What is new in this step
- `supabase/`: the database schema, security rules, and a large fictional dataset (24 venues, 34 fridges, 38 volunteers, 175 batches, about 1,700 agent events). Setup guide: `supabase/README.md`.
- `src/config/`: the safety rules and impact factors as versioned files (placeholder values).
- A data-driven dashboard after sign-in: live counts, a safe-window countdown, recent rescues, and the fridge network.
- It works with or without Supabase. With no keys set, it shows the bundled sample data and says so in a badge.
- `docs/DATA_MODEL.md`: tables, lifecycle and event types.

## Update the website (no local software)
1. In your GitHub repository, use **Add file > Upload files** and drag in the contents of this folder. Replace existing files when asked. Vercel redeploys on its own.
   - The `supabase` folder contains large files. GitHub accepts them; upload the `supabase` folder separately if the page feels slow.
2. Open the Vercel link, sign in, and check that the dashboard shows "Local sample data".

## Connect Supabase (optional now, needed from Step 3)
Follow `supabase/README.md`. Then add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel and redeploy. The badge changes to "Connected to Supabase".

## Checklist
- Dashboard shows 4 stat cards, a recent rescues table, and a fridge list
- The safe-window card counts down every second
- Language button switches to Arabic and the dashboard flips right-to-left
- Tier chips read Green/Amber/Red (Arabic: أخضر/برتقالي/أحمر)
- If the build fails, copy the red error lines from Vercel's build log and send them to me

## Notes
- All records are fictional. Venue and volunteer names are invented; locations are approximate area centres.
- Impact factors and safety thresholds are placeholders and must be cited or validated before the pitch.
- Never put the Supabase service role key in the website or in GitHub.
