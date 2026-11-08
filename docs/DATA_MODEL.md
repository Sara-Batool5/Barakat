# BARAKAT data model

All sample data is fictional. Times are stored as `timestamptz`; seed rows use `_t(minutes)` so the newest records always look fresh when you load them.

## Tables
| Table | Purpose | Key columns |
|---|---|---|
| `restaurants` | Venues that donate surplus (restaurants, hotels, bakeries, cafes, cloud kitchens, caterers, supermarkets) | `venue_type`, `area`, `lat`, `lng`, `esg_points` |
| `fridges` | Community fridges | `code` (FR-001...), `capacity_portions`, `current_stock`, `status`, `open_24h`, `open_from`, `open_to` |
| `volunteers` | People and couriers who deliver | `transport`, `max_radius_km`, `max_portions`, `languages`, `status` |
| `batches` | One surplus submission | `status`, `tier`, `prepared_at`, `stored_temp_c`, `safe_until`, `confidence`, `fridge_id`, `reject_reason` |
| `batch_items` | Items inside a batch | `category`, `portions`, `kg`, `allergens` |
| `safety_checks` | Each screening decision, with reasons | `tier`, `passed`, `reasons` (jsonb), `decided_by` |
| `jobs` | Offers and deliveries (one row per attempt) | `status`, `attempt`, `offered_at`, `responded_at`, `picked_up_at`, `delivered_at` |
| `agent_events` | The activity timeline | `event_type`, `actor`, `tone`, `title`, `detail`, `payload` |
| `fridge_stock_log` | Stock movements | `delta_portions`, `reason` (delivered, taken, expired) |
| `impact_logs` | Meals, kg, CO2e and ESG points per delivered batch | `meals`, `kg`, `co2e_kg`, `esg_points`, `factor_version` |
| `profiles` | Links a sign-in to a role and a record | `role`, `restaurant_id`, `fridge_id`, `volunteer_id` |
| `app_config` | Safety rules and impact factors (public, versioned) | `key`, `value` |

## Batch lifecycle
`draft` -> `listed` -> `matched` -> `dispatched` -> `picked_up` -> `delivered` -> `closed`
Side exits: `rejected` (red tier or coordinator declined), `escalated` (waiting for a coordinator), `expired` (no volunteer or the safe window closed).

## Safety tiers
`green` sealed, baked or whole items. `amber` cooked or chilled items that need the restaurant's attestation and a safe window. `red` hard stops (raw meat and fish, plate leftovers, unknown food, chilled food stored too warm).
Rules live in `src/config/safetyRules.json` and are copied into `app_config`. **Thresholds are placeholders** until validated against Dubai Municipality requirements.

## Event types
`photo_received`, `vision_read`, `safety_check`, `safe_window_set`, `escalated`, `coordinator_decision`, `rejected`, `fridge_matched`, `volunteer_offered`, `offer_declined`, `offer_timed_out`, `volunteer_accepted`, `picked_up`, `delivered`, `impact_logged`, `no_fridge`, `no_volunteer`, `expired`.

## Sample dataset size
24 venues, 34 fridges, 38 volunteers, 175 batches over 45 days (131 delivered, 20 declined, 17 expired, 7 live right now), 305 items, 189 safety checks, 186 jobs, 1,663 agent events, 687 stock movements, 131 impact records. About 6,300 meals in total.

## Impact factors (placeholders)
`src/config/impactFactors.json`: kilograms per meal, CO2e per kilogram and ESG points per meal. Replace with cited sources before the pitch and always show the factor version beside any figure.

## Sign-in and roles (Step 3)
- `profiles` links a sign-in (`auth.users`) to a `role` and, once onboarding is done, to a `restaurant_id`, `volunteer_id` or `fridge_id`.
- A trigger creates the profile at sign-up. Only `restaurant`, `volunteer` and `fridge_host` can be chosen by the user; `coordinator` is set by an administrator in SQL.
- Row-level security (`supabase/02_policies.sql`, `05_auth_policies.sql`): restaurants see their own batches, volunteers see their own jobs, fridge hosts see batches headed to their fridge, coordinators see everything. The agent uses the service key on the server.
- Demo accounts (`*.demo@barakat.test`) are linked to the most active sample records so every role has something to show.

## Surplus submission (Step 4)
- Restaurants cannot insert into `batches` or `batch_items` directly. They call `submit_surplus_batch(...)`, which checks the caller is a restaurant with a venue, validates the items against the rules in `app_config`, forces `status = 'draft'`, saves items and the first timeline event (`photo_received`) in one step.
- Photos are stored in the private bucket `surplus-photos` under `<user id>/<batch id>.jpg`.
- `src/lib/safety.ts` holds the screening logic (tier, safe window, reasons). The form uses it for a live preview; the server-side agent will reuse it in Step 6.

## Vision step (Step 5)
- `POST /api/analyze-photo` (Vercel function): checks the caller's sign-in and role with Supabase, calls Gemini with a strict JSON schema, validates the answer (known categories and allergens, portions 1 to 500, at most 8 items), saves it in `vision_analyses`, and returns it.
- `vision_analyses` is written only by the server (service key). Restaurants can read their own rows.
- `submit_surplus_batch(..., p_analysis_id)` copies the analysis confidence onto the batch and adds a `vision_read` event. An analysis can be used by one batch only.
- The restaurant always reviews and can edit the suggestions before submitting. The safety gate (Step 6) makes the real decision.

## Safety gate (Step 6)
- `POST /api/screen-batch { batchId }` (Vercel function): checks the caller is the batch's restaurant (or a coordinator), loads the rules from `app_config`, and decides `listed`, `rejected` or `escalated` (confidence below `confidence.auto_list_min`, default 0.75).
- It updates the batch (status, tier, `safe_until`, a pickup window capped 45 minutes before the safe window ends), saves a `safety_checks` row with the reasons, and writes `safety_check` plus `safe_window_set`, `rejected` or `escalated` events. A status guard (`status = 'draft'`) makes it safe to call twice.
- The same screening logic lives in `src/lib/safety.ts` (form preview) and `api/screen-batch.ts` (server); a parity test compares them.
- `expire_stale_batches()` runs every minute (pg_cron) and expires real batches whose `safe_until` has passed, cancelling their open jobs.

## Matching and dispatch (Step 7)
- `POST /api/dispatch` (Vercel function) with four actions: `match` (restaurant or coordinator), `respond` and `progress` (the volunteer who owns the job, or a coordinator), and `tick` (any signed-in user; housekeeping).
- Fridge choice: active, open at arrival (Dubai time), `capacity - stock - reserved >= portions`, within `dispatch.max_distance_km`, reachable at least 5 minutes before `safe_until`. Score = road distance + 4 x how full it is. The batch moves `listed -> matched` and the fridge's `reserved_portions` goes up.
- Volunteer choice: `status = available`, transport capacity and radius fit, no open job, not already tried for this batch, pickup and delivery fit before `pickup_until` and `safe_until`. Signed-in volunteers come first, then the nearest. A partial unique index allows only one open job (`offered`, `accepted`, `picked_up`) per batch.
- Offers expire after `dispatch.offer_timeout_minutes` (jobs.expires_at). After `max_offer_attempts` declined or timed-out offers the batch is `escalated` and the reservation is released.
- Delivery: job `delivered`, batch `closed`, fridge `current_stock` up and `reserved_portions` down, a `fridge_stock_log` row, `impact_logs` (meals, kg, CO2e, ESG points), restaurant `esg_points` up, volunteer `total_deliveries` up and `available` again.
- Sample volunteers (no `user_id`) are simulated by `tick`: they answer after 15 to 75 seconds (about 72% accept, 14% decline, 14% ignore) and travel at 15% of real time. Sample batches and jobs are never touched.

## Coordinator review (Step 8)
- `POST /api/dispatch { action: "review", batchId, decision: "approve" | "decline", note }` (coordinators only). The batch must be `escalated`.
- Approve: `escalated -> listed` (fridge cleared), a coordinator `safety_checks` row (`decided_by = 'coordinator'`, `passed = true`), a `coordinator_decision` event, then fridge matching and dispatch run again. Offer attempts are counted from the last coordinator decision, so the new round starts fresh. If the safe window has already closed the batch expires instead.
- Decline: `escalated -> rejected` with the coordinator's reason in `reject_reason`, a failed coordinator check and a `coordinator_decision` event.
- Agent activity reads `agent_events` (live feed, realtime on INSERT with a polling fallback), `batches` (pipeline counts) and computes: decisions in 24 hours (actor agent or system), share of batches with no `escalated` or `coordinator_decision` event, median minutes from `photo_received` to `fridge_matched`, and open escalations.

## Demo fixes (version 0.8.1)
- Dispatch ignores `is_sample` jobs when deciding who is busy. Signed-in volunteers (a `user_id` on the volunteer record) have `dispatch.human_offer_timeout_minutes` (15) to answer; demo volunteers use `offer_timeout_minutes` (6).
- Demo-only actions in `/api/dispatch` (allowed only for `volunteer.demo@barakat.test` and `host.demo@barakat.test`): `demo_volunteers`, `demo_set_volunteer` (moves the sign-in to another sample volunteer, returns the old one to the simulation), `demo_fridges`, `demo_set_fridge`.
- Every success answer from `/api/dispatch` carries `serverNow`; the app stores the offset and uses it for countdowns.
- New category `packaged_chilled` (amber, chilled, 24 hours, no preparation time) and `batches.review_requested` (the gate escalates such batches with reason `review_requested`).
- Storage: a photo can be read by its owner, by coordinators, and by anyone who can see the batch it belongs to (`can_see_batch`).
