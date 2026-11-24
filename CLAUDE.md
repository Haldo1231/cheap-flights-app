@AGENTS.md

# cheap-flights-app

Flight comparison site for Central European travelers. Compares prices from 4 departure airports: Bratislava (BTS), Vienna (VIE), Budapest (BUD), Košice (KSC).
Solo project by Lukas. Monetization: affiliate links via Travelpayouts / Aviasales.

Live: https://cheap-flights-app.vercel.app
Repo: github.com/Haldo1231/cheap-flights-app

## About the owner
- Lukas is non-technical. He wants results, not lessons: do not explain how things work unless he asks.
- Talk to him in Slovak, short and plain.

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS
- Supabase (Postgres)
- Vercel (hosting + cron jobs)
- Travelpayouts Data API (free tier, cache-based)

## Key files
- `app/destinationsList.ts`: 12 destination slugs (Rome, Milan, Barcelona, Athens, Paris, London, Berlin, Amsterdam, Lisbon, Warsaw, Krakow, Madrid)
- `app/airportsList.ts`: airport list for the AirportPicker autocomplete
- `/api/cron/generate-deals`: daily Vercel cron that fills the `weekly_deals` table (Bearer token, `CRON_SECRET`)
- Supabase tables: `weekly_deals`, `hostels` (name, booking_url, price_per_night, rating, destination_slug)

## Environment variables
These live in `.env.local` and Vercel. Never print, commit or log their values.
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- TRAVELPAYOUTS_TOKEN
- CRON_SECRET

## Design
Airport departure-board look. Keep it consistent.
- Colors: navy `#14213D`, amber `#FCA311`, paper `#FBF9F4`
- Fonts: IBM Plex Sans + IBM Plex Mono

## Rules: how to work on this project
1. Work autonomously and go all the way: plan, build, test and finish the task without asking for OK on steps or explaining as you go.
2. When something is unclear, make a sensible decision yourself and note it under "Decisions" at the end of this file.
3. Ask only when truly blocked: a missing login or access, a decision only Lukas can make (money, accounts, anything public under his name), or something that would delete data or cost money.
4. Read the relevant files before changing anything. Never remove or break existing features.
5. After every change, run `npm run build` (and tests, if any) and fix errors before calling it done. Check UI changes in a browser at desktop and iPhone width.
6. Commit with a clear message after each working change and push, so Vercel deploys it.
7. New libraries are fine when they clearly help; prefer none. Mention any you added in the final report.
8. Final report: 3–5 short lines in Slovak — what changed, the live link, and anything Lukas must do himself.

## Known limitations (not bugs)
- Travelpayouts free data is cached: small routes (e.g. KSC → Prague) can return no results.
- Prices can be stale, so always show them as "from €X".

## Current priorities (in order)
1. Find the Travelpayouts affiliate marker ID and add it to all Aviasales flight links (this is what makes money).
2. Replace the fake hostel data with real listings.
3. Design pass on `/anywhere`, `/deals` and destination pages.
4. Mobile / responsive testing.

## Decisions
- (Claude adds decisions made on its own here.)
