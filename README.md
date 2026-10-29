# BARAKAT: Step 3 (sign-in, roles and demo accounts)

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase. English and Arabic (right-to-left).

## What is new in this step
- Real sign-in and sign-up with Supabase (email and password), with a one-tap demo account for each role.
- Four roles: restaurant, volunteer, fridge host, coordinator. Nobody can sign up as a coordinator.
- Onboarding after sign-up: a restaurant adds its venue, a volunteer adds area, transport and languages, a fridge host picks a fridge.
- A role-based app: each role gets its own sidebar and a banner for its linked record. Pages for later steps are guarded by role and show a "coming in step N" card.
- Without Supabase the site still works: the sign-in page offers the four demo roles locally and says so.
- `supabase/05` to `08`: security rules for sign-up, demo account creation and linking, and removal.

## Update the website (no local software)
1. Upload the contents of this folder to your GitHub repository (**Add file > Upload files**), replacing existing files. Vercel redeploys on its own.
2. Run the new SQL files in Supabase (see `supabase/README.md`, section "Step 3"):
   turn **Confirm email** off in Authentication, then run `05_auth_policies.sql`, `06_demo_accounts_create.sql`, `07_demo_accounts_link.sql`.
3. Make sure Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from Step 2), then redeploy.

## Checklist
- Sign-in page shows two tabs and four demo buttons. Each demo button signs in and opens the app
- Restaurant demo: banner shows "Zaytoun Mezze Bar". Volunteer demo: "Bilal Sharma". Fridge host: "FR-014 Downtown Dubai Mall Entrance". Coordinator: "Network coordinator"
- Each role has a different sidebar; opening another role's page by URL sends you back to the overview
- Create account: fill the form, choose a role, finish onboarding, land in the app
- Sign out returns to the landing page; refreshing keeps you signed in
- Language button flips the whole flow to Arabic right-to-left
- If something fails, send me the message on screen, or the red lines from Vercel's build log

## Notes
- Demo accounts use a public password and the coordinator can see everything. Before a real launch run `supabase/08_remove_demo_accounts.sql` and `supabase/04_drop_demo_read_policies.sql`.
- A fridge host picks their own fridge in this prototype. A real launch should have a coordinator approve it.
- Password reset and email confirmation are left off for the prototype.
- All records are fictional sample data.
