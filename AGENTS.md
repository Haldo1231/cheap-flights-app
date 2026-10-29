# cheap-flights-app

Flight comparison site for Central European travelers. Compares prices from 5 departure airports: Bratislava (BTS), Vienna (VIE), Budapest (BUD), Košice (KSC), Prague (PRG).
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
- `app/flightSources.ts`: ALL Travelpayouts calls and the flight/fare shapes. A fare with a return date is ONE price for both flights; never split it per leg.
- `app/tripTypes.ts`: shared types (Leg, Fare, AnywhereCity, CompareResponse ...). `app/anywhereSearch.ts`: the "Anywhere" ranking and checks.
- `app/results/`: one `/results` page; `ResultsRouter.tsx` picks the screen from the URL (Anywhere, country, destination, month, open-jaw). `app/trip/` is the single-trip detail page.
- `app/lib/`: small helpers. `resultsUrl.ts` and `tripUrl.ts` build/read URLs (the URL is the single source of truth for filters and drill-down), `apiParams.ts` cleans API inputs, `useJson.ts` loads data with a short client cache so Back is instant.
- `data/country-images.json` + `scripts/fetch-country-images.mjs` (`npm run images`): one photo per country (Unsplash, Pexels as fallback), fetched ahead of time and committed. The site never calls a photo API. The script is resumable and respects the hourly limits (see README). `app/lib/countryImage.ts` (loader, credit links, flags) and `app/lib/countryImagesData.ts` (server-only lookup). Every photo must show its credit ("Photo by NAME on Unsplash", linked). A country without a photo shows a gradient + flag.
- `app/globals.css`: the design system pieces (`btn`, `field`, `surface`, `pill`, `eyebrow`, `h-page`, `hero-surface`, shadows, radii). Use these instead of long class strings. `app/components/PageHero.tsx` is the dark band at the top of pages; `CountryCard.tsx` is the Anywhere photo card.
- `public/flags/` + `scripts/copy-flags.mjs` (`npm run flags`) + `app/components/Flag.tsx`: country flags are real SVG pictures (flag emoji do not work on Windows). Never use flag emoji. `Icons.tsx` holds the small inline icons (no icon library).
- Dark mode: colours are tokens in `globals.css` (`ink` = text, `paper` = page, `surface` = cards, `deep` = always-dark header/hero/footer, `navy` = buttons). The dark values override the same names (system setting, or `data-theme` set by `ThemeToggle.tsx`). Use the tokens, never `bg-white` or hex colours; text on amber must be `text-deep`.
- Sharing: `ShareButton.tsx` (share sheet or copy link). `app/api/og/route.tsx` draws the link-preview picture; `app/lib/ogCard.ts` signs the card values so only our server can make cards; `lib/seo.ts` builds the page metadata (use `pageMetadata` for every page); `lib/shareData.ts` computes real cached prices for the cards.
- `WeekdayFilterPanel.tsx`: weekdays are OFF by default ("Only specific days" switch per direction). No `outDays`/`backDays` in the URL = any day.
- Content section (trip reports + guides): articles are Markdown files in `content/trips/` and `content/guides/` (copy-and-fill templates in `content/_templates/`; the README explains "How to add a new trip"). `app/lib/content/schema.ts` (zod; a missing or misspelled field makes `npm run build` fail with the file and field name), `load.ts` (reads the files; drafts exist only when `NODE_ENV !== 'production'`; checks slug = file name and that photo files exist), `costs.ts` (trip totals and the "compare with our estimate" rows: only where both numbers exist), `markdown.ts` (safe Markdown: raw HTML and inline images are escaped), `seo.ts` (Article + BreadcrumbList JSON-LD). Pages: `app/trips/`, `app/guides/`, `app/about/` (TODO boxes for the owner's own text; `app/lib/aboutStatus.ts` keeps it out of search/sitemap until written), `app/disclosure/`, `app/sitemap.ts`, `app/robots.ts`. UI in `app/components/content/`. NEVER invent trips, prices, stories or reviews: only the owner's real text goes in `content/`. `content/trips/sample-trip.md` is a fake `draft: true` sample (development only). Photos live in `public/trips/<slug>/`, made by `npm run optimize-photos -- <slug>` (reads `photos-inbox/<slug>/`, strips EXIF/GPS); every photo needs `alt`.
- `app/components/`: shared UI. `CostOfStay.tsx` is the trip cost panel (sticky sidebar on desktop, bottom bar on phones). `FlightLeg.tsx` shows airline + time for every flight.

## Environment variables
These live in `.env.local` and Vercel. Never print, commit or log their values.
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- TRAVELPAYOUTS_TOKEN
- CRON_SECRET
- UNSPLASH_ACCESS_KEY, PEXELS_API_KEY (optional) (only for `npm run images` on your own computer; not needed on Vercel)
- OG_SECRET (optional): signs the link-preview pictures; when it is missing, `CRON_SECRET` is used

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
- Some cached fares have no airline or departure time. Show "Airline not in data" instead of guessing. Never invent flight data.
- Whole Month "out + back" combines two separate cached prices; the calendar prices may themselves be round-trip fares, so that sum can overstate the real cost.
- The public API routes (`/api/*`) have input cleaning and caching but no per-visitor rate limit.
- Link-preview pictures use the built-in font (no bold weight), so the heavy text is thickened with a stroke. A shared trip page shows the price stored in its own link (as the page always did).

## Current priorities (in order)
1. ~~Travelpayouts affiliate marker (765816) on all Aviasales flight links.~~ Done.
2. ~~Replace the fake hostel data with real listings.~~ Done (see PROGRESS.md).
3. ~~Design pass~~ and ~~mobile / responsive testing~~ Done on `feature/polish-pass` (see PROGRESS.md).
4. Hostelworld affiliate approval (needs more travel content on the site).
