# BARAKAT: Step 1 (Foundation, landing page, demo sign-in)

React + Vite + TypeScript + Tailwind CSS + Framer Motion. English and Arabic (right-to-left).

## What is in this step
- Landing page (navbar with language toggle and Sign in, hero, safety tiers, roles, agent timeline, FAQ, footer)
- Sign-in page with a role picker (demo only; real accounts arrive in Step 3)
- Placeholder app shell at `/app` that opens after sign-in
- All text lives in `src/i18n/translations.ts` (English and Arabic side by side)
- Colours live in `src/index.css` (same green palette as your reference)

## Put it online (no local software)
1. On GitHub, create a new empty repository.
2. Unzip this file, then use **Add file > Upload files** and drag in everything inside the `barakat-web` folder (including `src` and `public`). Commit.
3. On vercel.com choose **Add New > Project**, import the repository, and press **Deploy**. Vercel detects Vite automatically. No environment variables are needed yet.
4. Open the Vercel link and run the checklist below.

## Checklist
- Landing page loads and the hero route animates
- Language button switches to Arabic and the layout flips right-to-left
- Mobile: menu opens, Sign in is reachable
- Sign in > pick a role > Enter BARAKAT > the app shell opens
- Refreshing `/app` keeps you signed in; Sign out returns to the landing page
- If the build fails, copy the red error lines from Vercel's build log and send them to me

## Notes
- No photos are used. The hero is an SVG illustration; photos can be added later in `public/`.
- The logo is a placeholder (`src/components/Logo.tsx`), to be replaced at the end.
- Statistics shown are the UAE 2030 target and product facts. Timeline and fridge data are labelled sample data.
