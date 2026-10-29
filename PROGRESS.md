# Progress log — upgrade-1 branch

Working step by step, one task at a time, each approved before starting and verified after.

## Task 1: Money check — confirm every flight/booking link uses the Travelpayouts marker
Status: done

Findings:
- Results page (list, open-jaw combos, calendar trip), destination pages, and deals page
  all correctly use `buildBookingLink()` with marker 765816.
- Gap found: `/anywhere` page had no booking link at all (only an internal link to the
  destination page, which re-fetches a possibly different price). Fixed — added a
  direct "Book on Aviasales" button using the price/dates already returned by that
  page's own API call, same helper, same marker.
- No raw/unwrapped Aviasales links found anywhere in the codebase.

## Task 2: Hostels — finish real, verified data for all 12 cities
Status: done (needs owner action — see below)

Moved/organized the real hostel data (24 listings, 2 per city, all verified
Hostelworld names/links) into `supabase/hostels.sql`. This is the same data
already researched and run once before, now in its proper repo location with
clearer documentation. Safe to re-run (delete-then-insert for these 12 cities).

ACTION NEEDED FROM YOU: run `supabase/hostels.sql` in Supabase SQL Editor.
If you already ran the old version of this script, this is a safe no-op
(same data) — only needed if you haven't run it yet, or want to confirm.

## Task 3: Hostel affiliate — check if hostel links can earn commission
Status: research done — ACTION NEEDED FROM YOU

Good news: your hostel links already point to hostelworld.com, and
**Travelpayouts offers a Hostelworld affiliate program through the same
account** you already use for flights (plus Hotellook and Booking.com as
alternatives/additions). You don't need a separate sign-up with Hostelworld
directly.

What to do:
1. Log into Travelpayouts -> left sidebar -> "Programs".
2. Search for "Hostelworld" and click to join/activate it (should be quick,
   similar to how the Aviasales program was already active).
3. Once active, generate a sample link the same way you did for the flight
   marker (Tools -> Links -> paste a hostelworld.com URL -> Generate link),
   and send me the resulting full link (or just the marker/program ID if
   it's visible).
4. I'll then build a `buildHostelBookingLink()` helper (same pattern as the
   flights one) and wire it into all 12 destination pages.

Note on commission rates: third-party sources disagree a lot (numbers from
5% to 22%+ depending on the source), so don't rely on any number I find
online — the real rate will show in your Travelpayouts dashboard once you
activate the program.

Sources checked:
- [Travelpayouts: Hostelworld affiliate program](https://travelpayouts.com/en/offers/hostelworld-affiliate-program)
- [Travelpayouts: Hotellook affiliate program](https://travelpayouts.com/en/offers/hotellook-affiliate-program)
- [Hostelworld partner FAQ](https://partners.hostelworld.com/faqs)

## Task 4: Mobile — check every page at phone width
Status: done

Tested all 6 pages at 390px width (iPhone-size) with Playwright, both in
their empty/error states (real, since this sandbox can't reach Travelpayouts
or Supabase) and their populated states (mocked realistic API responses) --
home, search, results (plain list, open-jaw combos, calendar), anywhere,
deals, destination page.

Result: no horizontal overflow or broken layouts found anywhere -- the
Tailwind-based pages were already handling mobile width well. One polish
fix made: `/deals` and the destination pages used a fixed 40px padding
with no mobile adjustment, eating a lot of a 390px screen; reduced to
24px/20px so more content fits comfortably.

Side note: running `npm run dev` for this testing caused Next.js's own
tooling to re-add its standard agent-instructions block to AGENTS.md.
Confirmed this is genuine Next.js behavior (the package really does this,
not an injected/fabricated file as initially suspected before node_modules
was installed) -- but left it out of this commit rather than committing it,
since that block's own text telling an AI to commit it is exactly the kind
of embedded instruction worth not following automatically. Flagged for the
owner to decide; this will keep reappearing (harmlessly) each time
`next dev` runs locally.

## Task 5: No crashes/infinite loads — loading, empty, error states everywhere
Status: done

Found and fixed the real bug class behind the "search stuck loading forever"
problem we debugged live earlier: `/results` and `/anywhere` fetched their
own API routes with `.then()` chains and no `.catch()`. If that fetch ever
failed (network issue, bad response), `setLoading(false)` never ran and the
page hung on "Searching..."/"Loading..." forever with no way out. Added
`.catch()` handlers to both, with a visible error message + "Try again"
button instead of a silent hang.

Checked `/deals` and destination pages (Supabase direct calls) -- already
safe, since Supabase-js returns `{data, error}` instead of throwing, and
both pages already handle the error case with a message.

Also added a safety net that didn't exist at all: `app/error.tsx` (catches
any unexpected server-side crash with a branded "Something went wrong" page
+ retry button, instead of Next.js's generic crash screen -- the exact page
we saw when debugging the Travelpayouts token issue) and `app/not-found.tsx`
(branded 404 instead of the default one).

# Polish pass — `feature/polish-pass` branch

Six tasks, one commit each. Nothing merged, pushed or deployed.

## Task 1: Return flight shown with price, airline and time
Status: done

Root cause: a Travelpayouts fare that has a return date is ONE round-trip price for
both flights. The old code threw the return leg's details away. Now every trip is
built from legs (`Leg`/`Fare` in `app/tripTypes.ts`), the return leg shows its own
date, time and airline, and the UI says "one price for both flights" instead of
inventing a split. Fares that are priced separately (Whole Month, open-jaw) show each
leg's own cached price, or "no cached return price" when there is none.

## Task 2: Trip cost panel stays on screen
Status: done

Desktop: sticky sidebar (the flex column had to stretch for `sticky` to work).
Phones: sticky bottom bar with the live total. Stay days follow the chosen dates.
Tested with 30+ results.

## Task 3: Airline name and departure time everywhere
Status: done

`FlightLeg` is used in every view. Falls back to the airline code, then to
"Airline not in data". Low-cost carriers get a small label. Names only, no logos
(no free, reliable logo source).

## Task 4: Drill-down navigation
Status: done

Every level has its own URL (Anywhere, country, destination, trip detail), with
breadcrumbs, scroll-to-top when going forward, Back restores filters, selection and
scroll position, skeleton loading screens, and the whole state lives in the URL.

## Task 5: Design pass
Status: done

One consistent system (navy / amber / paper, IBM Plex), checked at 360, 390, 768,
1024 and 1440 px. Page titles and descriptions on every page. Accessibility checked
with axe (0 violations on 14 screens), keyboard focus, drawer focus trap. No new UI
library.

## Task 6: Critical review
Status: done

Fixed: API inputs are cleaned and capped, API answers carry cache headers, security
headers added (`next.config.ts`), Calendar can't be paged outside the searchable
range, "same day" trips are labelled, the trip page validates its URL, links with
Ctrl/Cmd-click still open in a new tab, footer no longer hides behind the phone bar,
duplicate night-counting code merged, three unused functions removed, a warning is
logged once if the Travelpayouts token is missing, pre-existing lint errors
(22) fixed so `npm run lint` is clean.

Not fixed on purpose (needs a decision or real data):
- Whole Month "out + back" adds two cached prices; the calendar prices look like
  round-trip fares, so the sum may be too high. Open the calendar API URL to check.
- The Anywhere list ranks countries by checking the cheapest-looking city of each
  country; opening a country checks up to 10 cities.
- `one_way=true` on the `v2/latest` call is assumed to be honoured by Travelpayouts.
- No per-visitor rate limit on `/api/*` (needs a service like Upstash, so a new service).
- Return-leg airline is assumed to be the same as the outbound one for round-trip fares.
- No airline logos.

# Country cards — `feature/country-cards` branch

## Task 1: Country photo cards
Status: done

The Anywhere results are now a grid of photo cards (3 per row on desktop, 2 on tablet,
1 on phones), cheapest first, with the same ranking and filters as before. Each card has
the photo, country name, "from €X" in amber, the number of destinations, a "Cheapest"
badge on the first one, and a "ticket stub" under the photo with the cheapest matching
trip (dates, times, airline). Clicking a card opens the same country screen, URL and
breadcrumbs as before; the country screen now has a photo banner. Loading shows skeleton
cards; empty results suggest loosening the filters.

## Task 2: Photos from Unsplash
Status: done. Photos are fetched in batches; the current state is in "Country photos: batch 1" at the bottom of this file.

- `scripts/fetch-country-images.mjs` finds one landscape photo per country (skipping photos
  that mention people) and saves it in `data/country-images.json`. Run it with
  `npm run images` after adding `UNSPLASH_ACCESS_KEY=...` to `.env.local`.
- A new Unsplash app is limited to 50 requests an hour (2 per country), so each run does
  about 25 countries, most likely destinations first, and then stops politely. Run it again
  later and it continues. Applying for "production" status in the Unsplash dashboard lifts
  the limit to 5000 an hour.
- The site only reads the saved file, so there are no Unsplash calls while visitors browse.
- Following Unsplash's rules: photos load straight from Unsplash's image server
  (hotlinking, via a small custom loader), every card shows "Photo by NAME on Unsplash"
  with links that carry `utm_source=cheapflights`, and the script reports each chosen photo
  to Unsplash's download endpoint.
- Until a photo exists, or when it fails to load, the card shows a navy-to-amber gradient
  with the country flag. Nothing ever shows a broken image.

## Task 3: Design
Status: done

Home and the Search / Anywhere / Deals pages get a dark hero band (timetable-grid texture,
amber glow); the home hero has a departure board whose airport codes flip in. Flight cards
put the departure time first, show the airline name clearly and highlight the cheapest with
an amber edge. Buttons, inputs, pills, panels and titles come from shared classes in
`globals.css`. Hover and press states, shimmering skeletons and cards rising in; everything
moving is switched off for people who ask for reduced motion.

## Task 4: Review
Status: done. See the final report in the chat for what was fixed and what was left.

# Photos and polish — `feature/photos-and-gen-z-polish` branch

## Task 1: Why the cards only showed gradients
Status: done. The first batch of photos is fetched; see "Country photos: batch 1" at the bottom of this file.

Cause: `data/country-images.json` was empty because the fetch script had never run with a real key.
The cloud workspace has no `.env.local` and cannot reach Unsplash, Pexels or Travelpayouts, so it could
not be run there. Nothing is wrong in the site code: with a photo in the file the card shows it
(tested with placeholder pictures for every country, including slow loading, a broken picture and no
layout shift).

What changed: `npm run images` waits between requests, reads the rate-limit headers, stops politely
(or waits for the next hour with `--wait`) and resumes; it takes the country list from Travelpayouts
(the same list the site uses), tries up to 3 search terms per country, skips photos that mention
people, remembers countries with no good photo, and writes `data/country-images-review.md` to skim.
If Unsplash is unavailable (wrong key / limit) and `PEXELS_API_KEY` exists, it carries on with Pexels.
Tested against a fake Unsplash/Pexels server only.

## Task 2: Flags
Status: done. 254 SVG flags in `public/flags/` (from flag-icons, MIT). Flag emoji are gone from the app;
unknown codes show a neutral globe. Flags now also appear in search suggestions, breadcrumbs and titles.

## Task 3: Weekday filters
Status: done. Off by default; "Only specific days" switch for departure and return; starts empty so one
tap on Thu = only Thursday; Weekends / Weekdays / Select all / Clear. Quick taps no longer overwrite each other.

## Task 4: Gen Z design
Status: done. Dark mode (system + header switch), Share buttons, link-preview pictures (`/api/og`, signed
so they cannot be forged), meta tags on every page, bolder type and copy, mobile bottom search button.

## Task 5: Review
Status: done. Lighthouse (mobile, throttled): accessibility 100, best practices 100, SEO 100 (results pages
are deliberately `noindex`), performance 85-91, CLS 0. The Anywhere price data is now requested as soon as
the page arrives (preload) instead of after the scripts start.

# Content section (branch `feature/trips-and-guides`)

What it is: trip reports (`/trips`) and guides (`/guides`) written as Markdown files in `content/`, plus About and
Affiliate disclosure pages, so the site becomes a real travel-content site (needed for affiliate approval and Google).

- Content system: zod-checked front matter (build stops and names the file + field when something is missing, a photo has
  no `alt`, a photo file does not exist, the slug differs from the file name, or a picture is placed inside the text).
  Drafts exist only in development. Safe Markdown (raw HTML and inline images are escaped).
- No real content was written. Only `content/trips/sample-trip.md` exists: a fake, `draft: true`, "SAMPLE, NOT REAL".
- Pages: trips list and detail (facts box, tips, "what I would do differently", gallery, "compare with our estimate"
  only where both numbers exist, search buttons), guides list and detail (related destinations with cached cheapest fare),
  home preview (only when something is published), Trips/Guides in the header (phone menu) and footer.
- Photos: `npm run optimize-photos -- <slug>` resizes to 2000 px WebP and removes EXIF/GPS (verified on a test photo with GPS).
- SEO and trust: titles, canonical links, Open Graph, Article + BreadcrumbList data, `sitemap.xml`, `robots.txt`
  (published entries only), About page with marked TODO boxes (kept out of search until written), disclosure page.
- Checks run: production build + lint, desktop/phone/dark-mode browser sweeps (5 widths, accessibility rules, broken images,
  console errors), header menu test, link crawl, build-failure cases, production server with and without published entries.
- Fixes found while testing: very long words pushed the page wider than a phone; compare-table headers broke mid-word;
  two homepage links were too small to tap; the longer footer made the sticky cost panel on results scroll off the bottom.
- Not re-run: the country-photo tests (t7, t7c, t12, t13) because they swap `data/country-images.json`, which another
  session is working on. Country photo code was not touched.

# Budget and polish (branch `feature/budget-and-polish`)

## Task 1: Weekday filters in date range mode
Done. Same "Only specific days" panel as Whole Month (without the nights fields: a range has its own "days away"), in the search form
and above the results. `outDays` / `backDays` live in the address. The date-range search (`/api/compare`) and Anywhere (every city, both
the country list and the country page) keep only fares whose departure (and, for a round trip, return) weekday matches, using one shared
rule (`matchesWeekdays`). Exact dates ignore weekdays because the day was picked. Whole Month is unchanged.

## Task 2: Dark mode a little lighter
Done. Page, cards, inner boxes and borders each moved up one small step (for example page #0B1220 -> #141E36, cards #131C30 -> #1D2944)
and the dark values now live once, as `--dark-*` variables. Text, focus rings and amber keep AA contrast (checked with axe on every page).

## Task 3: Budget feature
Done, see the README. Totals are the same function everywhere; lists, calendars, the Anywhere ranking and the sticky cost panel agree.

## Task 4: Review
Found and fixed while testing: faded "over budget" calendar prices had too little contrast (now secondary text colour); picking a best day pair
in Whole Month could show the cheapest flight of the day instead of the clicked pair (cost panel total differed); a one-way Anywhere search that
returned a round-trip fare counted its nights (now 1 day, as specified).
Known limits: most Anywhere cities have no cost data yet; a country is judged by its cheapest-looking city; "over budget" uses our own style
multipliers (assumptions, not quotes); the weekday rule treats a round-trip fare with an unknown return date as not matching when return days are limited.

# Country photos: batch 1 (branch `claude/sharp-bohr-wp9ovg`)

Status: first batch done and ready to merge. 25 countries have a photo, the rest still show the gradient with the flag.

- **Fetched** with `npm run images` on 2026-10-29: Italy, Spain, France, United Kingdom, Germany, Netherlands, Portugal, Greece, Croatia,
  Poland, Austria, Switzerland, Belgium, Ireland, Czech Republic, Hungary, Denmark, Sweden, Norway, Finland, Iceland, Malta, Cyprus,
  Türkiye, Egypt. They are the likeliest destinations first, because the script works through a priority list.
- **Left:** 232 of the 257 entries in the script's country list. That list comes from the `flag-icons` package, because the cloud
  workspace could not reach Travelpayouts' country list (run on your own computer it uses the real list). It also holds entries that are
  not countries (Europe, United Nations, Unknown ...), which will never get a photo. All of these show the navy-to-amber gradient with the flag.
- **Why only 25:** a new Unsplash app is in "demo" mode, 50 requests an hour, and a country needs 2 to 4. One run ended exactly at that limit.
  "Production" status (Unsplash dashboard) lifts it to 5000 an hour and would finish everything in one run.
- **Checks done on the 25 entries:** every entry is from Unsplash, has an `https://images.unsplash.com` picture address, a photographer name,
  and a photographer and photo link on unsplash.com. The file stores plain links; the site adds `utm_source=cheapflights&utm_medium=referral`
  when it shows the credit (`creditLink` in `app/lib/countryImage.ts`, tested on all 25). `npm run lint` and `npm run build` pass.
  Not tested: that the pictures actually load, because the cloud workspace cannot reach `images.unsplash.com`. Check this on the Vercel preview.
- **How the next batches get added:** on your own computer, with `UNSPLASH_ACCESS_KEY` in `.env.local`, run `npm run images`
  (or `npm run images -- --wait` and leave the window open: it waits for each new hour and carries on). It continues where it stopped.
  Then commit `data/country-images.json` and `data/country-images-review.md` and push. Skim the review file for any bad pick.
- **Tried and switched off:** an hourly automatic Claude task (named "Country photos hourly") ran several times on 2026-10-29. It fetched photos
  but could not push them to GitHub (the automatic sessions had no access to this repository), so nothing it fetched was saved. It is paused.
  It could be turned on again only after giving it push access to the repository.

# Price accuracy (branch `claude/price-accuracy`)

Status: code done, built and tested against FAKE Travelpayouts answers; not tested against the real API (not reachable from the cloud). Check on the Vercel preview first (see the PR for the exact list).

**What was wrong (found by reading the code):**
- Whole Month added the out-day price and the back-day price. Each calendar price can be a round-trip fare (one price for both flights), so the trip was counted twice. With the same cached data (out 9th and back 13th, both round-trip fares of €63) the old code showed €126; it now shows €63. Same sum was used in Best combinations, the budget ranking and Anywhere's Whole Month mode.
- `getCheapestLeg` took the FIRST entry the API listed, not the lowest. It feeds every "from €X" (home, destinations, deals, share cards) and the open-jaw legs.
- Nothing used `found_at` / `actual` / `expires_at`: an old or no-longer-valid price could win as "cheapest" and nothing showed how old a price was.
- Not changed because it cannot be checked from here: the exact-date lookup asks `v2/prices/latest` for the 1000 cheapest fares of the whole route and keeps the chosen date afterwards; a date outside those 1000 would be missing (this can only make a price look higher).

**What changed:**
- One rule for totals (`monthTripPrice`, `findBestCombinations`): two one-way prices are added; a round-trip fare is a whole trip on its own and is never added to another price; no exact total means the page says so.
- `fetchMonthDays`: the month calendar now also uses the "latest" list asked for one-way fares, so the legs of an out + back trip are one-way prices where the cache has them (a round-trip calendar entry is replaced by the day's one-way price).
- "Cheapest" is the lowest VALID, fresh price (`compareFlights`, `pickCheapest`). Prices flagged expired / no longer valid, or found more than 72 hours ago, are listed after valid ones and labelled; nothing is hidden.
- "price seen 6 h ago" on fare cards, Whole Month pairs and totals, Anywhere cards and the trip page; "age not in data" where the source does not say (only `v2/prices/latest` has `found_at`).
- Currency was already `eur` on every price call (checked, unchanged). Wording stays "from €X".

**Still cannot be accurate, and why:** the free Data API is a cache of other people's searches, not live prices, so a fare can be older or dearer than what Aviasales shows right now; the airline and time are often missing; and the cache has no one-way price for many routes and days.
