# BARAKAT: Step 4 (restaurant surplus form, photo upload, new logo)

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase. English and Arabic (right-to-left).

## What is new in this step
- **New logo** (`public/logo.png`, transparent background) in the navbar, footer, sign-in page, app sidebar and as the browser icon. On dark backgrounds it sits on a white disc.
- **New surplus** (restaurant accounts): photo (shrunk in the browser before upload), items with category, portions and allergens, preparation time, storage temperature, pickup window, notes and a confirmation tick.
- **Live safety preview** beside the form: tier (green, amber, red), how long the food stays safe, and plain reasons. Red batches (raw meat, plate leftovers, chilled food kept too warm, too little safe time left) cannot be submitted.
- **My batches**: everything the restaurant submitted, with photo, tier, status and an expandable activity timeline. The demo restaurant already has about 10 past batches.
- Submissions go through one protected database function (`supabase/09_intake.sql`), which forces status `draft`, checks the items against the safety rules, and saves photos in a private folder per user.
- Without Supabase the form still works in local demo mode (saved in this browser only).

## Update the website (no local software)
1. Upload the contents of this folder to GitHub (**Add file > Upload files**), replacing existing files. Vercel redeploys on its own.
   The logo files are in the `public` folder; make sure that folder is uploaded too.
2. In Supabase SQL Editor, run `supabase/09_intake.sql`.
3. Open the site, use the **Restaurant** demo button, open **New surplus** and submit a batch.

## Checklist
- The new logo shows in the navbar, footer, sign-in page and browser tab, with no white box around it
- Restaurant demo: sidebar shows Dashboard, New surplus, My batches, Impact
- Choose a photo, add "Chicken biryani trays" as Cooked food, chilled, 20 portions, prepared 1 hour ago, 3.5 °C: preview shows Amber and about 5h of safe time
- Raise the temperature to 8: preview turns Red and submit is blocked
- Submit a valid batch: success screen, then it appears at the top of My batches with your photo and status "Waiting for agent"
- Open its activity: one entry, "Photo received"
- Arabic: the form, preview and list switch to Arabic right-to-left
- If something fails, send me the message on screen, or the red lines from Vercel's build log

## Notes
- The agent does not read the photo or screen the batch yet. That is Step 5 (vision) and Step 6 (safety gate and safe-window clock). The preview is a guide only.
- Photos are private. Only the restaurant that uploaded one (and coordinators) can see it.
- Activity details are stored in English; in Arabic the titles are translated and details are hidden for now.
- All records are fictional sample data.
