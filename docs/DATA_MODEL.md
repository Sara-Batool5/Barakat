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
