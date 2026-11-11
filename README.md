# BARAKAT: Steps 9 and 10 (live map, my fridge, impact and ESG report), version 0.10.0

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase + Leaflet (free OpenStreetMap map) + Vercel functions (Gemini for photos). English and Arabic (right-to-left).
This zip contains everything from Step 1 to Step 10.

## Step 9: live map and the fridge host's page
- **Live map** (volunteer, fridge host and coordinator accounts). Free OpenStreetMap map of Dubai:
  - **Fridges** coloured by how full they are (green plenty of room, amber filling up, red almost full, grey paused or offline). Room already promised to deliveries on the way counts. Click one for stock, incoming deliveries and opening hours.
  - **Food to rescue**: restaurants with live batches, with what is waiting and how much safe time is left.
  - **Volunteers on the move**: a van marker travels along its route (pickup, then fridge) while you watch. Positions are estimated from job timestamps, not GPS (demo volunteers move at about 6 times real speed).
  - **Routes** (dashed lines), layer switches, a "Live rescues" list (click to fly to a venue) and a legend. It refreshes every 10 seconds and the moment the agent writes something.
  - Each person sees what their permissions allow: coordinators see everything, volunteers see their own jobs, hosts see what is headed to their fridge (plus the sample network).
- **Jobs page**: every job now has "Navigate" links that open Google Maps directions to the pickup and to the fridge (no key needed).
- **My fridge** (fridge host account): a stock bar (in the fridge, promised, room left, capacity), **Record food taken** (taken by people, or removed because it expired; it updates the stock and the agent's idea of free room, and is logged), **Pause or resume deliveries**, opening hours, the incoming list, and recent stock movements. The demo host can still pick which fridge to look after.

## Step 10: impact and ESG report
- **Impact** (restaurant and coordinator accounts): meals rescued, kilograms kept from waste, CO2e avoided (estimate) and ESG points, for the last 30 days, 90 days or all time; an 8-week bar chart you can switch between meals, kilograms and CO2e; the recent deliveries ledger (what, where, how many); a "how these numbers are calculated" panel showing the factors and their version, with a clear placeholder warning.
  - Restaurants see their own venue. Coordinators see the whole network, a leaderboard of top venues by ESG points, and a switch to hide sample data.
- **Download report (PDF)**: a one-page A4 report (logo, period, summary, chart, deliveries table, method, disclaimer). The page shows a preview; the button opens your browser's print window, where you choose **Save as PDF**. Only the report is printed. This works in Arabic too, right-to-left.

## Update the website (no local software)
1. Upload the contents of this folder to GitHub (**Add file > Upload files**), replacing existing files. If GitHub complains about too many files, upload in two batches (`api`, `public`, `supabase` first). Vercel installs the new map library by itself.
2. No new SQL and no new keys. Redeploy on Vercel if it does not redeploy itself.
3. Run `select public.refresh_demo_data();` in the Supabase SQL Editor before a test session so the sample rescues look live.

## Try it
1. **Coordinator demo** > Live map. You should see fridges in colours, restaurants, and van markers for the live sample rescues. Toggle layers; click a fridge, a restaurant and a van.
2. Submit a dish as the **Restaurant demo**, then accept it in the **Volunteer demo**. Watch the Live map (coordinator window): the van heads to the restaurant, then to the fridge.
3. **Volunteer demo** > Jobs: tap **Navigate** next to the pickup or the fridge (opens Google Maps in a new tab).
4. **Fridge host demo** > My fridge: record 5 portions taken, pause and resume deliveries, check the incoming list.
5. **Restaurant demo** > Impact: look at the numbers and the chart, press **Download report (PDF)** and save it. Check that the PDF shows only the report.
6. **Coordinator demo** > Impact: network totals and the leaderboard. Switch to Arabic and download again.

## Notes
- The map tiles come from OpenStreetMap and need an internet connection. OpenStreetMap's free tile service is for light use; a production launch would use a tile provider.
- Volunteer positions are estimated, not GPS.
- Impact factors and safety thresholds are placeholders until replaced with cited sources; the report says so. Do not present these figures as audited results.
- The agent's background housekeeping runs while someone has the app open.
- All records are fictional sample data.

---

# Earlier versions (Steps 7 to 8 and fixes)

## What this version fixes (from your testing)
1. **Offers never reached the demo volunteer.** The sample data had Bilal Sharma "busy" with a sample trip, and the dispatcher counted sample trips as real, so it skipped him. Sample trips no longer block anyone. Offers to signed-in volunteers now last **15 minutes** (demo volunteers still answer in about a minute), and a wrong clock on your computer can no longer make an offer look expired: the app now uses the server's clock. An offer that ran out now shows as "No reply" instead of "Offered".
2. **Choose whom to play.** Signed in as the Volunteer demo, a card at the top of Home and Jobs lets you pick any sample volunteer. Volunteers who currently hold an offer are listed first, and a button switches straight to them. Signed in as the Fridge host demo, you can pick which fridge you look after (fridges with deliveries on the way first).
3. **Fridge host dashboard.** The fridge host's home now has "Incoming to your fridge": every batch headed there, with photo, restaurant, items, the safe-window clock and status.
4. **Real photos for volunteers and fridge hosts.** Volunteers see the photo of batches they have a job on, and hosts see photos of batches headed to their fridge (instead of the illustration).
5. **Sealed items would not submit.** Cooked food, sandwiches and desserts need a preparation time by the rules; if the photo reader (or you) picked one of those categories for a sealed product, "Not applicable" could not be used. Now: there is a new category **Sealed chilled packs** for factory-sealed chilled products (needs a temperature, no preparation time); the preparation field is marked required (with a hint) only when it really is required, says "Not needed" when it is not, turns red if missing, and the page scrolls to the problem list when something blocks the submit.
6. **Testing the review queue.** The form has a new tick box, **Ask a coordinator to check this batch before it is listed**. Those batches go to the Review queue (with the clock running) even if the photo reading was confident.

## Update the website (no local software)
1. Upload the contents of this folder to GitHub (**Add file > Upload files**), replacing existing files. If GitHub complains about too many files, upload in two batches (`api`, `public`, `supabase` first).
2. In Supabase SQL Editor run `supabase/13_demo_fixes.sql` (and `12_dispatch.sql` if you have not yet).
3. No new keys. Redeploy on Vercel if it does not redeploy itself.
4. Run `select public.refresh_demo_data();` before a test session.

## Test it
1. **Volunteer demo** (window 2): the "Play as which volunteer?" card shows Bilal Sharma. Leave it on him.
2. **Restaurant demo** (window 1): submit an amber dish. Within a few seconds Window 2 > Jobs shows the offer with Accept, Decline and a 15 minute timer. Accept, pick up, deliver. If the offer went to someone else, the card in window 2 lists that volunteer first: tick the "Switch to ..." button and the offer appears.
3. **Sealed item:** submit "Sealed juice bottles" (category Sealed beverages, preparation "Not needed") and a yoghurt pack (category Sealed chilled packs, chilled 3.5 degrees). Both submit.
4. **Review queue:** submit any batch with "Ask a coordinator to check..." ticked. Coordinator demo > Review queue shows it with your photo. Try Decline, then check the restaurant's My batches shows the reason.
5. **Fridge host demo:** open Home. Pick the fridge your batch is going to (the one with "incoming" is listed first) and the batch appears under Incoming with its photo.
6. **Dashboards:** the volunteer's and the host's Recent rescues now show real photos for batches they are part of.

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
