# cheap-flights-app

Flight comparison site for Central European travelers. Compares prices from 4 departure airports: Bratislava (BTS), Vienna (VIE), Budapest (BUD), Košice (KSC).
Solo project by Lukas. Monetization: affiliate links via Travelpayouts / Aviasales.

Live: https://cheap-flights-app.vercel.app
Repo: github.com/Haldo1231/cheap-flights-app

## About the owner
- Lukas is non-technical and learning while building.
- Explain everything in short, plain language. No jargon without a one-line explanation.

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
1. Read the relevant files before changing anything.
2. Explain what you will change and why BEFORE changing it. Wait for OK on anything big.
3. Never remove or break existing features.
4. After every change, run `npm run build` and fix any errors before saying it's done.
5. Commit with a clear message after each working change.
6. Don't add new libraries or services without asking first.

## Known limitations (not bugs)
- Travelpayouts free data is cached: small routes (e.g. KSC → Prague) can return no results.
- Prices can be stale, so always show them as "from €X".

## Current priorities (in order)
1. Find the Travelpayouts affiliate marker ID and add it to all Aviasales flight links (this is what makes money).
2. Replace the fake hostel data with real listings.
3. Design pass on `/anywhere`, `/deals` and destination pages.
4. Mobile / responsive testing.
