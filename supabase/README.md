# BARAKAT database setup (Supabase, free plan)

Everything here is pasted into the Supabase **SQL Editor** in a browser. Nothing to install.
All sample data is fictional: venue, fridge and volunteer names are invented, and locations are approximate area centres.

## 1. Create the project
1. Go to supabase.com, sign in, and choose **New project** (free plan). Pick the closest region and save the database password somewhere safe.
2. Wait until the project finishes setting up, then open **SQL Editor** in the left menu.

## 2. Run the files in this order
For each file: open it (on GitHub, click the file, then the copy button), paste it into a new SQL Editor tab, and press **Run**. Wait for "Success" before the next one.

| Order | File | What it does |
|---|---|---|
| 1 | `01_schema.sql` | Creates tables, views, triggers and helper functions |
| 2 | `02_policies.sql` | Row-level security: who can see what |
| 3 | `03_demo_read_policies.sql` | Lets the app read the sample data before real sign-in exists |
| 4 | `seed_part1of5.sql` | Rules and impact factors, 24 venues, 34 fridges, 38 volunteers, 175 batches, items, safety checks |
| 5 | `seed_part2of5.sql` | Jobs and the first agent events |
| 6 | `seed_part3of5.sql` | More agent events |
| 7 | `seed_part4of5.sql` | More agent events and fridge stock history |
| 8 | `seed_part5of5.sql` | Rest of the stock history and impact records |
| 9 | `90_verify.sql` | Shows row counts so you can confirm everything loaded |
| 10 | `05_auth_policies.sql` | Step 3: lets new users create their own profile and volunteer record |
| 11 | `06_demo_accounts_create.sql` | Step 3: creates four one-tap demo accounts |
| 12 | `07_demo_accounts_link.sql` | Step 3: gives each demo account its role and a sample record (shows 4 rows when done) |

The seed files are large (about 150 KB each). If the editor feels slow, give it a few seconds after pasting.
If a seed file shows an error, tell me the first line of the message; the files are safe to run again.

## 3. Connect the website
1. In Supabase open **Project Settings, then API** (or **API Keys**). Copy the **Project URL** and the **anon / publishable** key.
2. In Vercel open your project, **Settings, then Environment Variables**, and add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
3. In Vercel **Deployments**, redeploy the latest deployment.
4. Sign in on the website. The dashboard shows a badge: "Connected to Supabase" means it is reading your database.

Never put the **service role** key in the website or in GitHub. It is only for the agent's server code in a later step.

## Other files
- `04_drop_demo_read_policies.sql`: removes the demo read access before a real launch.
- `99_reset.sql`: deletes all BARAKAT tables so you can start over. Destructive.

## Step 3: sign-in, roles and demo accounts
1. In Supabase open **Authentication, then Providers, then Email** and switch **Confirm email** off. This is a prototype, and the demo needs sign-up to work instantly.
2. Run `05_auth_policies.sql`, `06_demo_accounts_create.sql`, then `07_demo_accounts_link.sql` (steps 10 to 12 above).
3. If `06` shows an error, create these four users by hand in **Authentication, then Users, then Add user** (tick **Auto Confirm User**, password `BarakatDemo#2026`), then run `07`:
   `restaurant.demo@barakat.test`, `volunteer.demo@barakat.test`, `host.demo@barakat.test`, `coordinator.demo@barakat.test`
4. On the website's sign-in page, the four demo buttons now work in one tap.
5. Before a real launch run `08_remove_demo_accounts.sql` and `04_drop_demo_read_policies.sql`. The demo coordinator can see all data.

## Step 4: restaurant surplus form and photos
Run `09_intake.sql` once (after 01 to 07). It adds the safe submit function the form calls, closes direct inserts on batches, and limits the private photo bucket so each person only uses their own folder.
Then sign in as the Restaurant demo, open **New surplus**, fill the form and submit. In Supabase you can check the result: **Table Editor, then batches** (a new row with status `draft`) and **Storage, then surplus-photos** (your photo).
