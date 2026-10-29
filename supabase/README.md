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
