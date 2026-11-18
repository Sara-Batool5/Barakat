# BARAKAT test plan

Test in a normal window and a private window (two people at once), on a computer and on a phone, in English and in Arabic.

## A. The 10-minute smoke test (before any demo)
1. Coordinator: **System check** is all green.
2. Coordinator: **Refresh demo data**, then **Clear my test batches**.
3. Restaurant: Home > **Try a demo dish** (cooked) > Submit. The result says Listed, a fridge is matched, an offer is sent.
4. Volunteer: Jobs shows the offer. Accept, picked up, delivered.
5. Restaurant: My batches shows the batch Completed.
6. Coordinator: **Live map** shows the fridge and the route. **Agent activity** shows the steps. **Impact** shows meals.
7. Switch to Arabic on any page: the layout flips to right-to-left and nothing is blank.
If any step fails, stop and use the bug report below.

## B. Full test matrix
Tick each line for English and Arabic.

### Restaurant (demo account)
- [ ] R1 Submit a cooked dish with your own photo: photo reading fills the form.
- [ ] R2 Demo shortcuts: cooked, bakery, sealed chilled all submit.
- [ ] R3 Sealed bottled drink: category Sealed beverages, preparation "Not needed" submits.
- [ ] R4 Raw meat or an item left out too long is Not listed, with the reason shown.
- [ ] R5 Preparation time missing on a cooked dish: a clear message and a red field.
- [ ] R6 Tick "Ask a coordinator to check": the batch lands in the Review queue.
- [ ] R7 My batches updates by itself and shows the fridge and the timeline.
- [ ] R8 Impact: numbers, chart, sources; Download report prints only the report.

### Volunteer (demo account)
- [ ] V1 The picker lists volunteers; the one with an offer is first.
- [ ] V2 Accept, picked up, delivered; the safe-window clock runs.
- [ ] V3 Decline: the next volunteer is offered the job.
- [ ] V4 Do nothing: the offer lapses (15 minutes for you, about a minute for demo volunteers).
- [ ] V5 Navigate links open Google Maps.
- [ ] V6 Live map shows your route and the van moving.

### Coordinator (demo account)
- [ ] C1 Review queue: Approve starts a fresh round; Decline shows the reason to the restaurant.
- [ ] C2 Show agent reasoning: checks and timeline appear.
- [ ] C3 Agent activity: numbers, pipeline and live feed move.
- [ ] C4 Live map: layers, fridge colours, popups, "Live rescues" list.
- [ ] C5 Impact (network): leaderboard, sample switch, report.
- [ ] C6 Demo controls: refresh, then clear (with the confirmation).
- [ ] C7 System check: red lines show a clear fix; all green when set up.

### Fridge host (demo account)
- [ ] F1 Pick a fridge; incoming deliveries appear with photo and clock.
- [ ] F2 My fridge: record 5 portions taken; stock goes down and a movement is logged.
- [ ] F3 Pause deliveries: new batches no longer go to that fridge. Resume.

### Whole-system scenarios
- [ ] X1 Everyone declines: after three offers the batch goes to the Review queue as "no volunteer accepted".
- [ ] X2 A batch whose safe window ends before delivery expires and frees the fridge room and the volunteer.
- [ ] X3 Close every window for 5 minutes with the scheduler on: offers still lapse and move on (System check shows the scheduler).
- [ ] X4 Two restaurants submit at once: no fridge is over-booked.
- [ ] X5 Phone: Home, Jobs, Live map and the form are usable with one hand.
- [ ] X6 Slow or lost connection: a message appears, not a blank page.

## C. Bug report (send me this)
- Account and role:
- Language and device:
- What you did, step by step:
- What you expected:
- What happened (copy the exact words on the screen, including any "Something went wrong" line):

## D. Known limits
- Volunteer positions are estimated, not GPS. Pickup and delivery are confirmed by a tap.
- The safe-window hours per food type are BARAKAT's own defaults.
- The agent decides with rules and scores; the photo reading is the only AI model call.
- Arabic text needs a native proofread.
