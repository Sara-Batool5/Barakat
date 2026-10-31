# BARAKAT: Step 5 (photo-reading agent, food images, fixed sidebar)

React + Vite + TypeScript + Tailwind CSS + Framer Motion + Supabase + a Vercel function that calls Gemini. English and Arabic (right-to-left).

## What is new in this step
- **Vision intake agent.** When a restaurant picks a photo in New surplus, a server function (`api/analyze-photo.ts`) sends it to Gemini, which returns the items it sees: name, category, portions and likely allergens, with a confidence score. The form fills itself in; the restaurant reviews and confirms.
  - Safety first: the model is told never to assume food is safe, unsure items go to the cautious categories, and the answer is checked and cleaned on the server (categories, allergens and portions are validated).
  - Only signed-in restaurant accounts can use it (the server checks the sign-in), limited to 30 analyses per user per hour.
  - Each analysis is saved (`vision_analyses`). When the batch is submitted, its activity timeline gets an "Items identified" entry with the model and confidence.
- **Food images in My batches.** 45 flat illustrations (one per sample food item) show for batches without a real photo, in the list, in the expanded details and in the dashboard's recent rescues. Real uploaded photos always replace them.
- **Sidebar stays put.** The side panel is now fixed while the main page scrolls, and Sign out stays visible.
- A few small fixes: a safer text helper and a clearer "Coming next" list.

## Update the website (no local software)
1. Upload the contents of this folder to GitHub (**Add file > Upload files**), replacing existing files. The folder now has an `api` folder; make sure it is uploaded too. If GitHub complains about too many files, upload in two batches.
2. In Supabase SQL Editor, run `supabase/10_vision.sql`.
3. Set up the agent's two secret values in Vercel (next section), then redeploy.

## Set up the photo-reading agent
You need two server-only values. Add them in Vercel, **Settings > Environment Variables**, and do NOT start the names with `VITE_`:
| Name | Where to get it |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio (aistudio.google.com), **Get API key**, create a key (free tier) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, **Project Settings > API Keys**: the **secret** key (starts with `sb_secret_`), or the legacy **service_role** key |
Tick **Sensitive** for both if Vercel offers it, save, then **Redeploy**.
These keys must never go into the website code, GitHub, or a variable starting with `VITE_`.

## Checklist
- Sidebar: scroll a long page (Dashboard); the sidebar stays in place and Sign out stays visible
- My batches: every entry shows a food illustration; open one and a larger picture appears with its items
- New surplus (Restaurant demo): choose a food photo; "Photo analysis" shows "reading..." then the items found and a confidence bar; the form below fills in; edit anything
- Choose a non-food photo: it says it does not look like food
- Submit; in My batches open the new batch's activity: "Photo received" then "Items identified"
- Without the two secret values: the card says photo analysis is not set up, and the form still works by hand
- Arabic: the analysis card and food list switch to Arabic right-to-left
- If something fails, send me the message on screen, or the red lines from Vercel's build log

## Notes
- The free Gemini tier has low per-minute limits; if it is busy, the function tries a lighter model, then asks you to retry. Free-tier terms may let Google use inputs to improve its products, so only upload photos of food.
- Allergens from the AI are suggestions only. The restaurant must confirm them, and Step 6's safety gate re-checks every batch.
- The food images are illustrations made for this prototype (`tools/food_art.py`), not photographs.
- All records are fictional sample data.
