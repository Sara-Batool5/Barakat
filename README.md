# BARAKAT: Step 7 (fridge matching and volunteer dispatch)

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase + Vercel functions (Gemini for photos). English and Arabic (right-to-left).

## What is new in this step
- **Fridge matching.** Once a batch is listed, the agent picks the best community fridge: active, open when the food arrives, with room (counting space already promised to other batches), within 25 km, and reachable inside the safe window. It prefers nearer and emptier fridges, and reserves the room.
- **Volunteer dispatch.** The agent offers the job to the best volunteer: signed-in volunteers first, then the nearest. It checks transport capacity, radius, availability and that pickup plus delivery fit inside the safe window. Each offer lasts 6 minutes. If a volunteer declines or does not answer, the next one is offered straight away. After 3 failed offers the batch goes to a coordinator and the fridge room is released.
- **Volunteer Jobs page.** Offers with a response timer, Accept and Decline, then "I have picked it up" and "I have delivered it", with the safe-window clock on every job.
- **Delivery closes the loop.** On delivery the fridge stock rises, the reservation is released, the volunteer is free again, and the impact (meals, kg, CO2e, ESG points) is recorded and added to the restaurant.
- **Restaurant progress.** My batches shows the fridge, who is waiting for whom, and the timeline, and refreshes by itself.
- **Demo volunteers move on their own.** The sample volunteers (no sign-in account) answer offers and complete trips in compressed time (a few minutes), so the whole chain can be watched with only one person at the keyboard. Real volunteer accounts always answer for themselves.
- **Dashboard photo fix.** Recent rescues now shows the real uploaded photo (for coordinators and the restaurant that uploaded it) instead of the illustration.
- Housekeeping: while anyone has the app open, a background call every 15 seconds closes lapsed offers, retries waiting batches, moves the demo volunteers along, and expires batches whose safe window closed.

## Update the website (no local software)
1. Upload the contents of this folder to GitHub (**Add file > Upload files**), replacing existing files. If GitHub complains about too many files, upload in two batches (`api`, `public`, `supabase` first).
2. In Supabase SQL Editor run `supabase/12_dispatch.sql`.
3. No new keys. Redeploy on Vercel if it does not redeploy itself.

## Try the whole chain
1. Window 1: sign in as the **Restaurant** demo, open New surplus, submit an amber dish (photo, cooked, chilled 3.5 degrees, prepared 1 hour ago). The result screen says Listed, then "Fridge matched" with the fridge and distance, and that an offer was sent.
2. Window 2 (a private window, or another browser): sign in as the **Volunteer** demo and open **Jobs**. The offer appears with a 6 minute timer. Accept it, press "I have picked it up", then "I have delivered it".
3. Back in window 1, My batches follows along (it refreshes every 15 seconds) and ends as Completed, with the timeline: fridge matched, offer sent, volunteer assigned, picked up, delivered, impact recorded. The dashboard's meals, CO2e and the fridge's stock go up.
4. To watch the agent cope when volunteers do not answer: submit another batch and press **Decline** (or do nothing for 6 minutes). The next offer goes to a demo volunteer, who accepts and delivers by themselves within a few minutes, as long as someone has the app open.

## Checklist
- Coordinator demo: Recent rescues shows the real photos you uploaded
- Restaurant demo: after submitting, the result screen shows the fridge match
- Volunteer demo: Jobs shows the offer, and the buttons work
- Arabic: Jobs and the progress lines switch to Arabic right-to-left
- If a step fails, send me the message on screen (for example "Run supabase/12_dispatch.sql" means that file is missing)

## Notes
- Safety thresholds and impact factors are still placeholders. BARAKAT screens food; it does not certify it.
- Pickup and delivery are confirmed by the volunteer's tap in this prototype (no GPS check).
- The agent's housekeeping runs while the app is open somewhere (and the expiry job in Supabase runs every minute). A production version would call it from a scheduler.
- Coordinators cannot yet review escalated batches (Step 8).
- All records are fictional sample data.
