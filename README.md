# BARAKAT: Step 8 (coordinator review queue and live agent activity)

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase + Vercel functions (Gemini for photos). English and Arabic (right-to-left).
This zip contains Steps 7 and 8 together.

## What is new in Step 8
- **Review queue** (coordinator accounts). Every batch the agent was not sure about, with the photo (the real one if uploaded), items, tier, the reason it needs a human ("photo reading only 62% confident", "no volunteer accepted"), and the safe-window clock.
  - **Approve**: the batch goes back to listed and the agent starts a fresh round (new fridge match, new offers, even to volunteers who declined before).
  - **Decline**: pick a reason (photo too unclear, looks unsafe, details missing, other) and an optional note. The restaurant sees the reason.
  - **Show agent reasoning**: the safety checks (who decided, passed or not, confidence, reasons) and the full timeline.
  - Every decision is saved as a coordinator safety check and a timeline entry.
- **Agent activity** (coordinator accounts). A live view of what the agent is deciding:
  - four numbers: agent decisions in the last 24 hours, share of recent batches handled without a human, median time to match a fridge, batches waiting for a coordinator
  - a pipeline: waiting for the agent, looking for a fridge, waiting for a volunteer, in transit, needs a coordinator
  - a live feed of every event (updates the moment the agent writes one, with a 15 second refresh as backup), with a switch to hide sample data
- The coordinator home page links to both.

## What came with Step 7 (in this same zip)
Fridge matching, volunteer dispatch, the volunteer Jobs page, delivery with impact recording, demo volunteers that move on their own, and real photos on the coordinator dashboard. See `docs/DATA_MODEL.md`.

## Update the website (no local software)
1. Upload the contents of this folder to GitHub (**Add file > Upload files**), replacing existing files. If GitHub complains about too many files, upload in two batches (`api`, `public`, `supabase` first).
2. In Supabase SQL Editor run `supabase/12_dispatch.sql` (Step 7; skip if already done). Step 8 needs no new SQL.
3. No new keys. Redeploy on Vercel if it does not redeploy itself.
4. Before testing, run `select public.refresh_demo_data();` in the SQL Editor so the sample batches look live.

## Test Steps 7 and 8 together
Use two windows: one normal, one private (so you can be two people at once).
1. **Restaurant demo** (window 1): New surplus, submit an amber dish (photo, cooked, chilled 3.5 degrees, prepared 1 hour ago). Result: Listed, fridge matched, offer sent.
2. **Volunteer demo** (window 2): Jobs. Accept, "I have picked it up", "I have delivered it". Back in window 1, My batches ends as Completed.
3. **Coordinator demo** (window 3, or after signing out): Review queue shows the sample batch from Zaytoun Mezze Bar waiting for a decision. Open "Show agent reasoning". Press Approve.
4. **Agent activity** (coordinator): watch the feed show the approval, the fridge match and the offer. The offer goes to the Volunteer demo, who can accept it in window 2.
5. Submit another batch, and this time press Decline in Jobs (or ignore it for 6 minutes): the next offer goes to a demo volunteer, who accepts and delivers by themselves in a few minutes while someone has the app open.
6. In Review queue, try Decline on another escalated batch and check that the restaurant sees the reason in My batches.
- A blurry or odd photo in New surplus often gets a low confidence and lands in the review queue by itself.

## Checklist
- Coordinator sidebar: Dashboard, Review queue, Agent activity, Live map, Impact
- Approve and Decline both work and the list refreshes
- Agent activity numbers and the pipeline move as you test
- Arabic: Review queue and Agent activity switch to Arabic right-to-left
- If something fails, send me the message on screen. "Run supabase/12_dispatch.sql" means that file is missing.

## Notes
- The agent's background housekeeping runs while someone has the app open. A production version would use a scheduler.
- "Handled without a human" and "time to match" include sample data unless you switch it off.
- Safety thresholds and impact factors are placeholders. BARAKAT screens food; it does not certify it.
- All records are fictional sample data.
