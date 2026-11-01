# BARAKAT: Step 6 (safety gate, safe-window clock, photo-agent fix)

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase + Vercel functions (Gemini for photos). English and Arabic (right-to-left).

## What is new in this step
- **The safety gate** (`api/screen-batch.ts`). When a restaurant submits a batch, the server screens it against the rules in the database and decides:
  - **Listed** (green or amber): the safe-window clock starts and the pickup window is capped so a volunteer always has time.
  - **Not listed**: raw meat or fish, plate leftovers, unknown food, chilled food stored too warm, required details missing, or too little safe time left. The reasons are shown and nothing goes to volunteers.
  - **Sent to a coordinator**: the photo reading was not confident enough (below 75%). The clock still runs.
  Each decision is saved with its reasons and appears in the batch's activity timeline.
- **Safe-window clock.** A live countdown with a draining bar, in My batches and on the submit-result screen. Green above half the window, amber, then red.
- **Expiry.** A scheduled job closes batches whose safe window ends before they reach a fridge (`supabase/11_safety.sql`).
- **Run safety check** button in My batches for any batch that has not been screened yet.
- **Photo agent fixed (most likely cause).** Google has been retiring its Gemini 2.5 models (many developers saw "no longer available" errors from July 2026), and Step 5 used them. The function now tries the current Gemini 3 models, retries with simpler settings if one rejects a request, and, if everything fails, shows a "Technical details" line you can copy to me.
- The server gate and the form's live preview use the same rules; a test checks that they agree on 1,425 input combinations.

## Update the website (no local software)
1. Upload the contents of this folder to GitHub (**Add file > Upload files**), replacing existing files. If GitHub complains about too many files, upload in two batches (the `api`, `public` and `supabase` folders first).
2. In Supabase SQL Editor run `supabase/11_safety.sql`.
3. No new keys are needed: the safety gate uses `SUPABASE_SERVICE_ROLE_KEY` from Step 5. Redeploy on Vercel if it does not redeploy itself.
4. (Optional) To show off a lively demo later, run `select public.refresh_demo_data();` in the SQL Editor.

## Checklist
- Photo analysis: choose a food photo; it should now fill the form. If it still fails, open "Technical details", copy the text, and send it to me
- Submit an amber dish (cooked, chilled 3.5 degrees, prepared 1 hour ago): result screen says Listed, Amber, about 5 hours with a draining bar
- Submit a cooked dish at 8 degrees: the form blocks it in the preview; try chilled 5.1 in a raw-meat batch for the red path
- My batches: the new batch shows its status (Listed), a live clock, and an activity timeline with Photo received, Safety check, Safe window set
- A batch from before this step shows "Run safety check"; press it and it becomes Listed or Not listed
- Arabic: the result screen, clock and buttons switch to Arabic right-to-left
- If something fails, send me the message on screen, or the red lines from Vercel's build log

## Notes
- The safety rules and temperatures are placeholders until validated with Dubai Municipality. BARAKAT screens food; it does not certify it.
- Matching a fridge and a volunteer comes next (Step 7). Until then a listed batch waits with its clock running.
- All records are fictional sample data.
