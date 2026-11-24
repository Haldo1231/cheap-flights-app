# Progress log — upgrade-1 branch

# Find a flight back (branch `feature/anywhere-return-and-flight-back`, commit 2)
New page `/back` and `/api/return-flights`: from a one-way flight, look for cached one-way flights back from the destination to any of the five
home airports (exact date or date range, cheapest first), pick one and see the combined trip with the total and both booking links. Button on
one-way result cards, on the one-way trip page and on a picked one-way flight in Whole month. Tested with fake price data; real cache coverage of
one-way fares decides how many return flights show up (the page says so when there are none).

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
Status: done. All photos are fetched (226 countries); see "Country photos (done ...)" near the bottom of this file.

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
Status: done. The photos are fetched (226 countries); see "Country photos (done ...)" near the bottom of this file.

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

# Country photos (done: 226 of 244 countries)

Status: finished on 2026-10-30, all on `main`. **226 countries have a photo**; 18 small territories have none (Unsplash had no suitable
landscape photo), so they show the navy-to-amber gradient with the flag: American Samoa, Brunei, Bonaire/Sint Eustatius/Saba, Central African
Republic, Côte d'Ivoire, Equatorial Guinea, Guinea-Bissau, Kiribati, Marshall Islands, Nauru, Pitcairn, Suriname, South Sudan, Chad, Togo,
Tokelau, Turkmenistan, Wallis and Futuna. The script remembers them (`noPhoto` in the data file) and does not retry; `--refresh` would.

- **How it was fetched:** about 15 batches over roughly 9 hours, in the cloud, each ended by Unsplash's hourly limit (50 requests an hour,
  a new app is in "demo" mode). After each batch the build was run, then the data files were committed and pushed to `main`. First the
  countries most likely to have flights from Bratislava, Vienna, Budapest and Košice, then all the other real countries. The real Anywhere
  list needs Travelpayouts, which the cloud workspace cannot reach, so that first group is a best guess; the order only decided what got a
  photo first.
- **In scope:** 244 countries and territories. The script's list (from the `flag-icons` package, because Travelpayouts' own list was not
  reachable) has 13 more entries that are not countries or are uninhabited (Europe, United Nations, Unknown, Pacific Community, Antarctica,
  six uninhabited islands or military bases); they were skipped on purpose and also show the gradient.
- **Checks done on all 226 entries:** every entry is from Unsplash, has an `https://images.unsplash.com` picture address, a photographer name,
  and a photographer and photo link on unsplash.com; no picture is used for two countries and no description mentions people. The file
  stores plain links; the site adds `utm_source=cheapflights&utm_medium=referral` when it shows the credit (`creditLink` in
  `app/lib/countryImage.ts`, tested on all of them). `npm run build` passed before every push.
  Not tested: that the pictures actually load, because the cloud workspace cannot reach `images.unsplash.com`. Check on the live site.
- **A bug found and fixed on the way:** Unsplash caches search answers for 24 hours, and a cached answer keeps the "requests left" number from
  when it was first made. After one batch the script kept reading its own old answers ("2 left") and wrongly stopped for over an hour. It now
  ignores that number on cached answers (`scripts/fetch-country-images.mjs`).
- **If you want to change a photo:** skim `data/country-images-review.md` (a link for every pick). To replace a bad one, delete its entry in
  `data/country-images.json` and run `npm run images -- --only=CODE`, then commit the two data files. For a new country, just run
  `npm run images` (on your own computer with `UNSPLASH_ACCESS_KEY` in `.env.local`; `-- --wait` waits for each new hour).
- **Tried and switched off:** an hourly automatic Claude task (named "Country photos hourly") ran several times on 2026-10-29. It fetched photos
  but could not push them to GitHub (the automatic sessions had no access to this repository), so nothing it fetched was saved. It is paused.
  It could be turned on again only after giving it push access to the repository.

# Price accuracy (branch `fix/price-accuracy`)
The cloud environment cannot reach Travelpayouts (the network policy blocks it, and there is no token), so live prices could not be compared.
Fixed what the code itself showed to be wrong: `getCheapestLeg` returned the first listed fare instead of the minimum (it feeds "from EUR X" on
destination pages, deals, share cards and open-jaw); Whole Month, Anywhere's whole-month check, open-jaw and the Whole Month cost panel added
prices that were already round-trip prices (counting flights twice); the response currency was never checked; `found_at` / `expires_at` were
never used. Now: minimum valid price, expired/stale prices dropped, non-euro answers discarded, round-trip fares kept as one price, one-way
calendars use true one-way prices, and every price shows how old it is. `/api/debug-prices` lets the owner compare with the real API on the preview.
Not verifiable from here: how the live API treats a request without `return_date` or `one_way`, and how fresh `found_at` really is.

# Return to a different home airport (branch `feature/return-to-any-airport`)
The option "fly back to a different airport" was hidden for Date range and Anywhere, off by default, and replaced the normal results when on.
Now: on by default with 2+ home airports, offered for exact dates and date range, and shown as a second list under the normal round-trip fares
(one-way fare out + one-way fare back, A != B, all your airports paired, weekday/nights/budget apply). Anywhere is not covered (it would add
many price requests per country).

# Different return airport, restored as a switch (branch `fix/different-airport-toggle`)
Why it looked broken: the box was renamed, switched on by default and hidden when fewer than 2 airports were ticked (and never offered for
Anywhere / Whole month); the trips themselves now need real one-way fares (before: the cheapest fare of each day per airport, which could be a
round-trip price counted twice), so with thin cached data nothing may be found. Now: a visible switch, OFF by default, shown for exact dates and
date range on every round trip; returns to any of the five home airports; one-way fares from the one-way list and the calendar; and a clear message when none exist.

# Anywhere: fly back to a different airport (branch `feature/anywhere-return-and-flight-back`, commit 1)
The switch now exists on the Anywhere screens (country cards, a country, a city) and stays on through country > city > trip (it lives in the
address). The extra trips come from a second request (`/api/anywhere-jaw`) so the normal cards show first; a status line says it is still
working. Measured with a fake price server: ON asks for about 3-4x as many price requests as OFF on a cold cache (about +85, one-way lists
that are shared and cached for an hour) with about the same time to the first cards. If this turns out too heavy for the free price service,
this commit can be reverted on its own.

# Different airport: new rules (branch `feature/different-airport-rules`)
New rules from the owner for "fly back to a different airport": the switch never replaces the normal round trip any more; the main price stays
the cheapest same-airport round trip and the different-airport trip is an extra line next to it.
- **Narrow searches (exact, date range, weekdays), destination and Anywhere:** switch OFF by default. ON adds the line
  "BTS → Barcelona → PRG, €68 (+€8 vs round trip)" (Anywhere cards, a city's page under the switch); none cached = no line. A country's page
  lists the round trips first and the different-airport trips below, cheapest first. The old "cheaper trip wins and the cards move" merge
  (`mergeJawIntoCountries`, `mergeJawIntoCities`) is gone.
- **Whole month:** Anywhere + Whole month has no switch. A destination + Whole month has it (OFF by default): ON + an outbound picked, the
  Returning calendar shows the cheapest flight back to ANY home airport per day, with the airport and the difference to the airport you left
  from; a tapped day lists all airports, cheapest first. The button "Fly back to a different airport" on a picked trip (any Whole month round
  trip) opens a month calendar of flights back to the OTHER airports on `/back` (`bm=month`), with the day list and the combined trip with
  both booking links. All of it is in the address.
- **Honest data rule:** a round-trip fare's price is never reused for a trip that comes back elsewhere (it already pays for its way back). The
  outbound is the cheapest cached ONE-WAY fare from the same airport on that day; if there is none, the button is greyed out / the summary says so.
- **Not changed:** with the Whole month switch OFF the two calendars and "Best combinations" work as before (they already pair a one-way out
  with a one-way back from any of the chosen airports).
- **Cost of the month calendar of flights back:** one request to `/api/return-flights` per month = 2 price requests per airport. Measured
  (fake price server, production build, cold cache): 8 requests for the 4 other airports (4 one-way lists + 4 month calendars), 10 for all 5;
  next month 4; a month already seen or a repeat within the hour 0. After the Whole month page has loaded (its calendars are cached) the
  button costs 4 new requests and the Whole month switch 5.
- Tested with a fake price server (the cloud workspace cannot reach Travelpayouts): points 1, 2b and 3 in a browser (desktop + phone), plus the
  whole earlier regression suite. Not verifiable from here: how many real days have a cached ONE-WAY fare (the free data is thin; if a month
  shows few priced days, that is the data, not an error).

# Anywhere: month guard and no unchecked example (branch `fix/anywhere-month-guard`)
Real examples from the live site: a December Anywhere search showed trips in November and January and called them "matches your filters"; a one-way
search showed a round-trip "example" fare in January. Cause (from the code): the month branch kept every day the calendar answer listed and never
compared it with the searched month or the return month; and the "example" was the rough `city-directions` ticket (any date, often a round trip).
- **Month guard:** `fetchMonthCalendarDetailed` keeps only days of the asked month (covers the Anywhere overview, the country screen, the normal
  search calendars and the one-way calendars); `findBestCombinations` got an optional `months` argument (departure month, return month) used by
  Anywhere and by the Whole month day pairs. `getCheapestOneWayLeg` (old month branch of `/api/compare`, not reachable from the site) got the same rule.
- **No example block:** removed from `AnywhereCityRow`. The rough "~€" price stays for round-trip searches only. A one-way Anywhere check (exact date
  and date range) now ignores fares that have a return date.
- **Effect to expect:** fewer countries match a month search (days outside the month no longer count, a round trip must return in the return month).
- **Tested:** with the fake price server and with a SIMULATION that also lists the 25 days before and after the month: before the fix 7 of 10
  country cards were outside the month, after it 0. The real behaviour of the Travelpayouts calendar answer is still unverified from the cloud.

# Anywhere: one mixed list, country screen = city calendar (branch `feature/anywhere-mixed-list-country-calendar`)
Three requests from the owner.
- **1a Whole month (nothing new to build, re-checked):** Anywhere + Whole month has no switch on the overview and the country screen; after picking a
  trip the button "Fly back to a different airport" opens the month calendar of flights back to the OTHER home airports, a tapped day lists all
  airports cheapest first, choosing one shows the combined trip with the total and both booking links (`buildBookingLink`). Covered by the existing
  tests t25/t27 (all pass).
- **1b Exact dates / date range:** with the switch ON the Anywhere cards and the country page are ONE list sorted by total price. Each card / row
  shows the cheaper of its round trip and its two-one-way-tickets trip; "from €X" and the country ranking use it; every trip says "round trip, back
  to BTS" or "two one-way tickets, back to PRG". The separate extra line and the separate list are gone (Anywhere only). OFF = exactly as before
  (old wording, no second request). The destination (city) page keeps its switch and its extra line (1c).
- **2 Bug "No matching day" although the city calendar has fares:** cause: the country check only tried up to 3 airports (those whose "popular
  destinations" list names the city), the city page asks every chosen airport. Now `checkCity` checks EVERY chosen airport with the same
  functions the city page uses (`getMonthDaysByOrigin` / `cheapestPerDay`, shared with `/api/calendar`; same requests, same cache). Palermo case
  reproduced with the fake server (city calendar: 30 days, country screen: "No matching day") and fixed. An agreement test compares every city of
  every country with the city page's own data: one way + Whole month (also with a weekday limit), round trip + Whole month (against an independent
  pairing of each airport's calendars), date range, exact dates, date range + weekdays: 21 of 21 cities agree in each case.
  **Cost (fake world, cold cache, 5 airports):** overview 25 → 105 requests (month), 25 → 65 (date range), 59 → 114 (exact); a country page with 4
  cities: 10 → 30 (month), 7 → 17 (range), 15 → 31 (exact); opened directly 45 / 28 / 47. The switch's second request: 80 → 100.
- **3 The repeated €46 in Palermo's December calendar (investigation, NOTHING changed in what the site shows):** the Travelpayouts API cannot be
  reached from the cloud workspace, so the real Palermo answer was not read. Found: (a) the one-way month calendar is built from two lists, the
  calendar (`/v1/prices/calendar`) and the one-way latest-prices list (`/v2/prices/latest?one_way=true`), the cheapest entry per day wins; (b) real
  answers seen earlier in this project contain COPY rows in the latest-prices list (no booking site, duration 0, distance 0, found at midnight of the
  request day, the same price repeated on neighbouring dates, for example BTS→ROM 22 Oct: value 55 four times for 1 Nov) next to real rows (booking
  site Kiwi.com, duration, distance, found hours earlier); (c) the site does not filter them (`normalizeFromLatest`), and a calendar entry's own
  `departure_at` day is never compared with the day it is listed under; (d) a simulation with such rows reproduces the look exactly (€46 on 28 of 31
  days, the three real fares stand out). Not proven for Palermo. New read-only check `/api/debug-prices?...&month=...` (`app/lib/debugMonth.ts`).
  Proposed fix, NOT applied until the owner says OK: ignore latest-prices rows that look like copies, and calendar rows whose own departure day is not
  the day they are listed under, so a price only shows on the day it was really found (more empty days, fewer false "matches").
- **Tested** (fake price server, production build): new `t24` (50 checks: form, OFF vs ON, one mixed list, labels, sorted, cheaper-of-both against both
  API answers, country page, budget, city page unchanged, exact dates, Whole month without switch, agreement of every city) plus the regression
  suites t21, t23, t25, t26, t27 (budget part rewritten for the single list), t28, t29, t30, axe (WCAG, light/dark, phone/desktop) and the tap-size
  sweep. One axe finding exists on `main` too (search form, "Change destination" button: aria-label does not start with the visible text) and was left alone.

# Whole month, round trip: one-way calendars, one mixed list (branch `feature/whole-month-one-way-calendars`)
Two requests from the owner, in two commits (layout first).
- **1 Layout:** the calendars (Departing, Returning) come first, then "Best combinations" with its flights. The tapped day's flights still open in the panel.
- **2 Prices:**
  - **Endpoint:** the plain calendar (`/v1/prices/calendar`) answers round-trip fares. The one real answer in the history (the owner's paste, BTS to ROM, Oct 2026) has 39 days, every one with a return date. One-way prices come from `/v2/prices/latest?one_way=true`, keeping only rows with no return date. The calendar's own `one_way` parameter is NOT used (not documented clearly). NOT verified: whether `one_way=true` returns only one-way rows. The debug month check now also asks the calendar with `one_way=true` and counts the one-way days.
  - **Calendars:** one-way only, the airport on hover and for screen readers (not written on the calendar). Days without a one-way ticket stay empty.
  - **Best combinations:** round-trip fares and "2 one-way tickets" in one list, cheapest total first, labelled. A picked pair is priced as two one-way tickets with a booking link each (`FlightLeg`). When a cheaper round-trip fare exists for the same two days, it is shown next to the total with its own link. A round-trip pick keeps its own return day (with the switch ON it used to turn into two tickets).
  - **Day lists** on this page are one-way only, so picked days always add up to two one-way tickets.
  - **Copy rows:** the copy-row rule was proposed in the previous item and is now applied (`isCopyRow`: no booking site, duration 0, distance 0), plus the calendar departure-day check. It applies to every search, so a price shows only on the day it was really found.
  - **Requests (cold cache, fake world, five airports):** the page 20 before, 30 now (+10 one-way lists). The round-trip answer and the range list reuse the calendar cache because they start after the outbound calendar.
- **Tests (fake price server, production build):** unit (crafted answers, 17/17): the Hamburg case (one-way 35, not round-trip 89), round-trip-only days empty, copy rows dropped, departure-day check, month guard, two airports. Browser `t31` (16/16 default; 18/18 with cheaper one-way prices): layout order, one-way calendars only, labels, sorting, nights, sum with two links per ticket, alternative with link, round-trip pick, from Anywhere. Regression: t21, t23, t24 (50/50), t25, t26 (38/38), t27, t28, t29, t30. Accessibility (axe, light/dark, phones and desktop) clean on the new page.
- **Open decision:** Anywhere's round-trip Whole month check still counts round-trip fares only, so the country price can be higher than the city's cheapest for cities where two one-way tickets are cheaper. Making it match costs about 2 extra price requests per origin and city (cold cache).

# Phase 0: state check (12 Nov 2026)
- Open PRs then: #13 (one-way calendars + copy-row filter; merged on request on 13 Nov), #10 (axe fix), #2 and #3 (old duplicates of #4 and #5).
- The cloud workspace could not reach Travelpayouts (network policy) and had no token; a personal environment for this repository was set up
  (api.travelpayouts.com allowed) and the token and the Supabase service key were saved as network secrets (added by the gateway; never visible
  in the session). From then on every test used REAL data. A `token=` in an address overrides the header, hence step A below.
- PROGRESS.md was found out of date in places (older sections describe older states: "nothing merged", the extra-line design, "+85 requests",
  "copy-row fix not applied"); this file is a chronological log, newer sections win.

# Phase 1: the price store (branches `feature/token-header` → `feature/price-store` → `feature/store-reads`, PRs #14, #15, #16, stacked)
Goal: stop asking the price service while a visitor waits; one source for every screen; real tickets instead of copies.

**Step 1, what the v3 method answers (real data, 12 Nov).** `/aviasales/v3/prices_for_dates` per airport and month with `unique=true` lists
every destination once with its cheapest ticket of the month: December 2026, one way / round trip: BTS 204/142, VIE 324/287, BUD 302/222,
KSC 36/20, PRG 313/234 (the old source: 30 per airport, any date). Per route and month it lists one ticket per day (one way) or per
departure+return day (round trip), with date and time, airline, flight number, booking site, a deep link; 0 days outside the month, 0 copy
rows; round-trip prices per day identical to the old calendar; `one_way=true` really returns only one-way rows (also on the old v2 list, the
long-standing doubt). No `found_at` in v3 rows. Data thins out after two months (BTS one way: Nov 175, Dec 204, Jan 120, Feb 48, Mar 33).
`market` (sk/at/hu/cz) gave the same tickets and links on the route tested; default kept. Cost of fetching everything nightly would be 8,200
route-month requests, so the nightly job fetches the summaries for all destinations and the day-level data for the popular routes.

**Step A (#14):** the token travels in the `X-Access-Token` header. "Before" numbers measured on this branch with real data (cold cache,
5 airports): Anywhere overview 155 requests / 2.1–3.3 s (+150 requests with the different-airport switch), a country page 18–35 requests,
the Whole-month city page 30, an exact-date search 10. In two of four runs Travelpayouts answered **429 (too many requests)** for 60 and
285 calls, which the site showed as "no data": the real cause of missing destinations.

**Step B (#15): the store.** `supabase/price_store.sql` (4 tables + 2 functions, run once by the owner), `app/lib/priceStore.ts`,
`app/lib/tpV3.ts`, `/api/cron/refresh-prices` (daily 02:00 UTC; summaries for 5 airports × this month + 3, then the 12 named and the 25
cheapest destinations of each summary in all three kinds: round-trip out, one-way out, one-way back), time-boxed 50 s slices that call the
next slice themselves, paced under 190 requests/min, a run log with errors, departed days removed. Designed for 2 crons per project (the old
Hobby limit; the docs now say 100). **First real run from the cloud workspace (15 Nov):** 16 slices in 12 min 15 s, 1,690 requests, every one
HTTP 200 (none refused), 0 failed jobs, 20,732 tickets written; store size after it: 19,539 tickets, 14.1 MB in total (free tier: 500 MB).
The chaining worked locally; on Vercel the first production run must be checked in `price_runs`.

**Step C (#16): store first, live fallback.** `app/lib/priceSource.ts`: a route-month or month summary in the store and younger than 48 h is
served with no request; missing or stale → live, stored, logged; live fails → stored rows with their real age; store unusable → the live
answer directly. The screens' functions in `flightSources.ts` keep their shapes. Anywhere ranks the summaries (200–330 destinations per
airport) and checks round trips like the city page (fare or two one-way tickets). Booking links open the exact ticket (deep link). Found and
fixed while testing with real data: Supabase answers at most 1,000 rows (reads now page), too many small store queries (reads batched per
city and remembered for a minute), the nightly plan missed the one-way tickets a round-trip check needs (all three kinds planned now), a
`no-store` fetch broke pages rendered ahead of time (live fallback uses a 10-minute fetch cache).

**Second real run (15 Nov, all three kinds planned):** 20 slices in 15 min 22 s, 2,226 requests, every one HTTP 200, 0 failed jobs,
23,547 tickets written. Store after it: 24,495 tickets, **22.2 MB in total** (tickets 20.4, jobs 1.2, coverage 0.6; the free tier is 500 MB).
Across both runs and all tests, 3,916 requests, none refused (429).

**Before / after, real data, 5 airports, cold Next cache (requests = requests to Travelpayouts; times = the API route's answer time, measured
from the cloud workspace, which reads the store over the internet; the page times below were measured in a real browser right after):**

| search | before (step A build) | after (store filled) |
|---|---|---|
| Anywhere overview, whole month, round trip | 155 requests, 3.3 s (+150 with the different-airport switch) | 3 requests, 8.2 s cold (90 store reads), 1.7 s in the browser warm |
| Anywhere overview, whole month, one way | 155 requests, 2.7 s | 0 requests, 3.2 s |
| Anywhere overview, date range | 95 requests, 2.6 s (+150 / 2.0 s with the switch) | 0 requests, 0.01 s remembered (+0 / 2.2 s with the switch) |
| Anywhere overview, exact dates | 155 requests, 2.1 s (285 of them refused with 429) | 0 requests, 0.01 s remembered |
| Country page Italy, whole month, round trip | 30 requests, 0.7 s, 4 cities | 0 requests, 2.6 s, 19 cities (10 checked) |
| Country page Italy, whole month, one way | 30 requests, 0.5 s | 0 requests, 0.6 s |
| Whole-month city page BCN (browser) | 30 requests | 0 requests, 0.9 s until the content |
| Exact-date search BCN 12–16 Dec | 10 requests, 0.4 s | 0 requests, 0.01 s |
| Flights back from BCN (13–27 Dec) | 5 requests | 0 requests, 0.6 s, 46 fares |
| Destinations per airport, December, one way / round trip | 30 / 30 (any date, the "popular" list) | BTS 229/148, VIE 360/321, BUD 340/233, KSC 45/22, PRG 340/235 |

Agreement: for every Italian city the country screen's one-way month price equals the cheapest day of the city's own calendar (10 of 10).
Browser, store filled: Anywhere overview 1.7 s until the cards, country page Italy 2.0 s (3 live requests for routes outside the nightly plan),
Whole-month city page 0.9 s, exact-date search 0.3 s, no console problems.

**Not covered by the store:** exact-date round trips are sparse everywhere (the store holds the cheapest ticket per departure+return day pair the
service knows); a route-month nobody asked for and the job did not plan costs one live request per airport and kind the first time.
**Harness note:** the fake-price-server browser suites (t21–t31) predate the store and need a fake store + v3 to run again; Phase 2 QA runs
against real data.

# Phase 2: full QA with real data (branch `fix/phase2-qa`, 16 Nov 2026)
How it was tested: the production build ran in the cloud workspace against the real price service and the real store (filled by the two
Phase 1 runs). A browser script (`qa-phase2.js`, Playwright + axe, in the session's harness, not in the repository) opened 31 flows:
home, search form (destination and Anywhere), exact dates / date range / whole month / specific weekdays, one way / round trip /
different return airport, Anywhere (overview, with budget, country Italy in every mode, city), trip detail, "find a flight back" (days and
month), deals, destinations, trips, guides, about, disclosure, a missing page; each at 1280 px and 390 px (phone), light and dark:
**124 page checks**, each with a screenshot, an accessibility scan, a look for horizontal overflow, broken pictures, placeholder text
("undefined", "NaN", "€0"), booking links without the affiliate marker, console errors and failed requests. Result before the fixes:
108 clean, 16 with a finding. Every booking link on every screen carried the marker (0 without).

**Bugs found and fixed (one PR):**
1. **Anywhere country page, whole month, round trip: "Price age not in the data" on trips made of two one-way tickets.** Screenshot
   (Italy, phone): Milan €29 "round trip, both flights · Price seen 20 h ago", but Turin €37 "out + back · Price age not in the data",
   same for Rome, Catania, Bari, Pisa, Naples, Florence. The two tickets had a real age; the code that builds the "out + back" trip
   simply did not pass it on (`app/anywhereSearch.ts`). Now the older of the two tickets' ages is shown (as the city page does).
2. **Search form, the chosen-destination chip ("BCN Barcelona ×" / "Anywhere ×") failed the accessibility rule "label in name":** a screen
   reader announced "Change destination, currently Barcelona", which does not start with the visible text, so voice-control users saying
   "click Barcelona" would not hit it. The hidden label now follows the visible text ("BCN Barcelona, change destination"). Nothing
   changes on screen. (Open PR #10 fixed the same rule elsewhere.)
3. **Deals job could wipe the deals.** The live `weekly_deals` table is EMPTY (0 rows on 16 Nov; the deals page says "No deals yet",
   screenshot `deals`, dark). The job deletes all rows BEFORE it inserts the new ones, so a night with no cached fares (price service
   down, store empty) leaves an empty page until the next night. Now it keeps yesterday's deals and answers 503 with a note when it finds
   nothing (`/api/cron/generate-deals`, also given a 60 s limit like the other job). Why the table is empty today could not be checked
   from here: the job itself works (the old `/anywhere` page uses the same function and shows 12 destinations from the store), the Vercel
   cron log is not reachable from the workspace, and running the job from here would write into the live table (not done). **Owner:**
   after this is deployed, open Vercel → Cron Jobs → `generate-deals` → Run, or wait for 06:00 UTC, then check `/deals`.
4. **Phone (390 px): the test could not reach "Trip details" / "Fly back to a different airport" from the Whole-month page.** Not a site
   bug: on phones those links live inside the bottom cost bar, which opens on tap (screenshot `month-rt`, phone: the bar "Flights + stay ·
   6 days ▴" at the bottom). The test now taps the bar first; both flows then pass at phone width in light and dark.

**Findings that are not bugs (left as they are):**
- "Colour contrast" on the Anywhere budget page (4 variants): a false alarm from the cards' entrance animation (`rise-in`, cards fade in
  from transparent; the scan ran while cards below the fold were still transparent). A second scan after the animation finds 0 problems.
- The missing page (`/this-page-does-not-exist`) logs one console error: the browser reporting the 404 status itself. That is correct.
- Pages take 4–8 s cold from the cloud workspace (the store is read over the internet from there; 50–90 store reads for an Anywhere
  overview). On Vercel the store sits next to the functions; the browser numbers in Phase 1 (0.9–2 s) are the realistic ones. Not
  measurable from here.
- Whole month, one way: the calendar shows prices without an age; the age appears once a day is picked (the fare list). By design.

**Checks:** type-check, lint and `npm run build` pass; the crawl was run again on the fixed build: 124 page checks, 118 clean; the 6 remaining are the four expected 404 console lines of the missing page, one contrast false alarm (one of four variants this time, 0 on a scan after the animation) and one timeout of the exact-date round trip at phone width in dark mode that passed on a rerun (the store read from the workspace took longer than the test allows). 0 booking links without the marker, no overflow, no broken pictures, no placeholder text, "price seen" shown on every screen that shows a fare.

# Phase 3 (branch `feature/phase3`, 16 Nov 2026)
**1. Specific days within a date range: already covered, verified with real data, nothing added.** The search form shows the two
"Only specific days" switches (departure days, return days) in Date range mode; the days travel in the address (`outDays`, `backDays`);
`/api/compare` (date range), the different-airport pairing and Anywhere all apply the one shared rule (`matchesWeekdays`). Test through
the form (1–31 Dec, round trip, Barcelona, depart only Fri, return only Sun, from all 5 airports): the address carried `outDays=5&backDays=0`,
the results box said "Depart Fri · Return Sun", all 8 fares left on a Friday and came back on a Sunday (85 fares without the limit), all
30 different-airport pairs kept the days, Anywhere's 10 checked cities kept the days, one way kept only Fridays (13 fares).
Exact dates ignore weekdays on purpose (the person picked the day).

**2. Dark mode one step lighter.** Only the `--dark-*` block in `app/globals.css` changed (plus the phone's address-bar colour in
`app/layout.tsx`): page #141E36 → #1E2A46, card #1D2944 → #28375A, inner box #27355A → #344675, border #364565 → #475A86,
secondary text #B4BCCD → #C4CBDA, header/footer/hero #0E172D → #141F38, buttons #36518A → #3F5C9C. Every text colour keeps at least
4.5:1 on the backgrounds it is used on (computed: main text 7.9–14.1, secondary text 5.7–10.1, amber prices 4.6–8.1); the accessibility
scan of 52 page checks (7 flows × desktop/phone × light/dark) found 0 problems. The old values are listed in the comment above the
block, so going back (or one step further) is a 10-line edit. Before/after pictures were sent in the session (home, exact-date results).

**3. Booking links: every flight button goes through `buildBookingLink` with marker 765816.** Code review: every `bookingUrl` on every
screen (results list, open-jaw pairs, Whole month, trip page, flights back, deals, the old `/anywhere` page, share data) is built by
`buildBookingLink` (`app/aviasalesLink.ts`), which always wraps the Aviasales address in `tp.media/r?...marker=765816...`; no other
file writes an Aviasales address. In the browser: 267 flight links on 9 screens with real data (exact round trip, exact one way, date
range with the different-airport pairs, Whole month with picked days, trip detail, flights back, the old Anywhere page) all point to
tp.media with marker 765816 and an aviasales.com address inside; the Phase 2 crawl (124 page checks) found 0 links without it.
Hostel links are the hostels' own booking links (not flights).

# Nightly price run stuck + empty deals page (branch `fix/price-run-watchdog`, 17 Nov 2026)
**What happened to run 3 (the first chained run on Vercel; runs 1 and 2 on 15 Nov ran from the cloud workspace, not on Vercel).**
Evidence: `price_runs` / `price_jobs` and Supabase's own request log (Logs → API Gateway, kept 1 day). Vercel's runtime logs could
not be read: the Hobby plan keeps them for 1 hour, so the logs of 02:26 and 06:00 were already deleted.
- 02:26:39 the cron started run 3. Slices 1–5 worked (every ~47 s; each new slice read the run row 0.2–0.4 s after the previous
  slice saved it), 624 jobs done, every database request answered 200/201/204, no job with an error.
- 02:30:32.913 slice 5 saved its counts and asked for slice 6. **After that, not a single request reached the database** (checked
  02:30–02:45 and the rest of the night). A new slice's first action is reading the run row, so slice 6 never ran its code.
- Why the call got lost cannot be proven without Vercel's log. What is certain: the address, the secret and the deployment
  protection were fine (the same call worked four times that night); Supabase was not the cause (all answers normal; today's
  incidents were in ap-northeast-2 and sa-east-1, this project is in eu-west-1); no deployment happened then (last merge 16 Nov).
  The weakness in the design was: the call for the next slice was let go after 3 s without knowing whether it arrived, and nothing
  looked at a stopped run until the next night.
- Finished from the workspace (same chain, 15 more slices): run 3 **done at 12:09 UTC, 20 slices, 2,253 requests, 23,927 tickets,
  0 failed jobs**, 508 departed tickets removed.

**The deals page.** The 06:00 deals job DID work: at 06:03:43 it deleted the old rows and stored 6 new ones (Supabase log: DELETE 204,
POST 201, from Vercel, Ashburn). The page `/deals` is rebuilt at most once an hour and only when someone visits it. Its saved version
came from the 16 Nov 18:14 deployment, when the table was empty, so it kept saying "No deals yet". Nobody visited it between 06:03
and 11:45; the 11:45 visit got the old page and triggered the rebuild (that rebuild read 6 rows). Found on the way: the
`airports` table had only BTS, VIE, BUD and KSC, and `weekly_deals.origin` must name one of them, so a day with a Prague deal in the
top 6 would have made the whole insert fail, and because the job deleted first, the page would have been empty. Prague was added to
the table (one row). Also seen, harmless: Supabase's gateway refuses 1 of a burst of 16 parallel coverage reads now and then
(PGRST303); the site fetches that month summary live instead.

**Changes (this branch):**
- `app/lib/priceRun.ts` + `/api/cron/refresh-prices`: a slice answers **202 "accepted" first and works afterwards** (`after()`, same
  300 s limit), so the slice before it KNOWS the hand-over arrived; no 202 → tried again (3 tries, pauses 3 s and 10 s). A slice that
  cannot read its run or job counts hands over instead of finishing the run on wrong numbers. Failed jobs get 2 more tries at the end
  of the run (5 in total). Notes in `price_runs` say what happened ("hand-over failed …", "resumed by the watchdog …").
- **Watchdog**: a running run with no finished job for 30 min is resumed by the deals cron at 06:00 (`resumeStuckRun`) or by the next
  nightly call; older than 20 h it is given up and the nightly call starts a fresh one. No third cron needed.
- `/api/cron/generate-deals`: adds missing home airports to `airports`, stores the new deals BEFORE deleting the old ones (a failed
  insert keeps yesterday's deals), then `revalidatePath('/deals')` so the page shows them on the next visit.

**Tested against the real store (run 4, from the workspace, with a 1-minute stuck limit for the test):**
| test | result |
|---|---|
| hand-over to a dead address | 3 tries, note "hand-over failed: try 1 … try 3 … (the watchdog resumes the run)" |
| nightly call while the run is fresh | 409 "a run is in progress" |
| nightly call after 1 min without progress | 202 "resumed", slice 2 ran |
| deals job with a stuck run | 200 in 5.4 s: 6 deals stored, 6 old removed, /deals refreshed, "run 4 … next slice started" |
| /deals right after the job | first visit rebuilt (1.9 s) with the 6 deals, second from cache (5 ms); no "No deals yet" |
| a job failed 3 times (simulated) | put back at the end ("1 failed jobs put back for another try"), done on try 4 |
| the whole test run after the watchdog | **done** by itself: 23 slices, 2,262 requests, 24,064 tickets, 0 failed jobs, every hand-over confirmed |

**What to check after merging:** tomorrow's `price_runs` row: status `done`; a note "resumed by the watchdog" means a hand-over was
lost and recovered at 06:00. `/deals` should show 6 deals. The Vercel cron log for refresh-prices now shows `202` (the slice works
after the answer); that is expected. Nothing to set on Vercel (`PRICE_RUN_STUCK_MINUTES` is only for tests).
**Note:** while testing, Next.js 16.4.2 printed a security notice for agent-run builds (advisory GHSA-mfr8-8qww-v76h, moderate,
`use cache` + `unstable_cache`, fixed in 16.4.5). This site uses neither, so it is not affected; updating Next.js is a separate,
optional change.
# Know what earns money, phase 1: SubIDs and counts (branch `feature/subid-analytics`, 17 Nov 2026)
**Checked first (no guessing):** Travelpayouts' help centre (article 203955653): a SubID may use only Latin letters, digits and `_`,
up to 4096 characters; statistics per SubID are in Reports → Performance (filter or "Group by SubID": clicks, bookings, conversion,
earnings). Travelpayouts' own link API (POST /links/v1/create with our project 588622 and marker 765816) returned exactly our link
with `sub_id=` added, and tp.media redirects such a link to Aviasales with the marker. Vercel's docs (limits and pricing): Hobby =
page views only, 50,000 events a month across all projects, 1 month of data, no custom events (Pro: custom events with 2 properties).

**Built:** SubID `page_trip_airport` on every booking link (`app/lib/subId.ts`), Vercel Web Analytics for page views (new package
`@vercel/analytics` 2.0.1, approved in the plan), and the site's own "search" and "book_click" events in a new `site_events` table
(`supabase/site_events.sql`, **for the owner to run once**) with counts at `/api/debug-prices?key=…&events=1`.

**Tested with real data in a browser (13 of 13):** every booking link on every screen carries the expected SubID: exact round trip
(results_rt_*, results_ow_* for the "return flight only" link), exact one way, date range with 260 links incl. the different-airport
pairs, the city page's calendars (citycal_two_bts) and a "Best combinations" pick (combos_two_bts, address gets `via=combo`), trip
detail (trip_rt_bud, trip_ow_bud), flights back (back_two_bts), the old Anywhere page, deals, a destination page; a click sends
`{"name":"book_click","subId":"results_rt_bud"}`; the search form sends `{"name":"search","mode":"month","trip":"rt","anywhere":false}`
(and nothing when the form refuses to search). A real tp.media link with deep link + SubID answered 302 to the exact Aviasales ticket
with marker 765816. Without the table, /api/event answers 204 and logs one warning.
**Owner:** run `supabase/site_events.sql`; switch on Vercel → Analytics → Enable. Three test clicks from 17 Nov show in Travelpayouts
(SubIDs `citycal_rt_bts`, `deals_rt_bud` and one without a SubID).

# Nightly price run: the HTTP 508 that killed 7 nights (branch `claude/epic-cerf-7a1z6z`, 24 Nov 2026)
**Found by looking at `price_runs`, not by guessing:** runs 1–4 (15–17 Nov) finished `done` in 16–23 slices. Every run since
then failed the same way — runs 5–10 (18–23 Nov) are `failed` and run 11 (today) hung in `running`. Each one stopped after
**exactly 9 slices**, with the hand-over to the next slice refused three tries in a row:
`hand-over failed: try 1: HTTP 508; try 2: HTTP 508; try 3: HTTP 508`. Roughly **1,100 of ~2,250 route jobs never ran each
night** (run 11: 1,173 done, 1,084 pending, 0 failed).

| run | night | status | slices | jobs left undone |
|---|---|---|---|---|
| 4 | 17 Nov | done | 23 | 0 |
| 5–10 | 18–23 Nov | failed | 9 | ~1,100 each |
| 11 | 24 Nov | running (hung) | 9 | 1,084 |

**Checked in the documentation, not assumed:** Vercel's error page for 508 (`INFINITE_LOOP_DETECTED`, "Loop Detected", last
updated 9 Feb 2026) says the error "occurs when an infinite loop is detected within the application" and lists an application
"making an infinite number of requests to itself" as a cause. That is exactly what a slice does — it calls its own production
address for the next slice. Vercel documents **no number** for when 508 starts, and no recursion limit on its functions-limits
page, so the rule behind it is unknown; what the run log shows is that about the first 8 self-calls of a chain go through and
then 508 stays (the 06:00 watchdog got one more slice, and that slice's hand-over was refused at once).

**Why the long tail went stale while "Anywhere" looked fine:** the 40 summary jobs are planned first and always finished, so the
month summaries stayed fresh. The route jobs behind them — the 12 named destinations and the 25 cheapest per summary — are the
ones that were cut off.

**Fixed by needing far fewer self-calls, not more retries:** a slice now works **180 s instead of 50 s** (`DEFAULT_BUDGET_MS`).
About 2,250 requests paced at `MIN_GAP_MS` (320 ms, ≤ ~190/min) take roughly 12 minutes, which is **~5 slices instead of ~20** —
under the ~8 where 508 appeared. Added `sliceBudget()`: the budget is capped so that whatever `PRICE_REFRESH_BUDGET_MS` is set
to, a slice still has room (10 s retry pause + ~75 s of hand-over tries) to finish its hand-over inside `maxDuration` of 300 s.
Before, the README suggested 250000, which would have left no room and could have killed a slice mid-hand-over.

**Not changed on purpose:** the pacing (`MIN_GAP_MS`) stays — the price service allows about 300 requests/min per method and
lowering it would risk 429s, and even at the limit a night needs more than 300 s, so self-chaining cannot be avoided on Hobby.

**What is verified and what is not:** type-check, lint and build are clean. The 180 s arithmetic comes from the real request
counts in `price_runs`. The fix **cannot be proved from a development machine** — it needs the code on Vercel, because the 508
comes from Vercel answering the site's call to itself. So this is to be confirmed on the first night after the merge.

**Nothing to do about the hung run 11:** tonight's job sees it `running` with no progress and older than 20 h (`RESUME_WITHIN_MS`),
marks it given up and starts a fresh run. No manual database change needed.

**What to check the morning after the merge:** the newest `price_runs` row should be `status = done`, `slices` about 5, and
`jobs_pending = 0`. If it is `failed` after ~8 slices again, the slice has to get bigger or the work smaller — more retries
will not help.
**Still waiting on the owner (unchanged from 17 Nov):** run `supabase/site_events.sql`; Vercel → Analytics → Enable; delete the
Supabase access token that was shared for reading logs.
**Note:** Next.js 16.4.2 again printed the security notice for agent-run builds (advisory for `use cache` / `unstable_cache`,
fixed in 16.4.5). This site uses neither; the build finishes on a retry, as the notice itself says. Updating Next.js stays a
separate, optional change.

# Phase 2: route pages for search engines (branch `claude/epic-cerf-7a1z6z`, 24 Nov 2026)
**47 new pages**, one per route: `/flights/bratislava-milan` and the rest, plus the list page `/flights`.

**The data threshold, decided from the real store rather than a guess.** A route gets a page only when `price_tickets`
holds at least: 30 tickets, 20 different departure days, 3 of the 4 covered months, 8 one-way AND 8 round-trip departure
days, and a newest price no older than 72 h. Measured against all 60 routes to the 12 named destinations, 47 pass:

| airport | pages | of 12 |
|---|---|---|
| Vienna | 12 | all |
| Budapest | 12 | all |
| Bratislava | 11 | Krakow left out (4 round-trip days) |
| Prague | 11 | Krakow left out (5 round-trip days) |
| **Košice** | **1** | only Rome; the other 11 have 2–12 tickets |

Košice is not a bug: the free price data barely covers it (KSC–Krakow has 2 tickets, newest 129 h old). The script prints
every left-out route with the reason.

**The list of addresses is committed** (`data/routes.json`, written by `npm run routes`, read by `app/lib/routePages.ts`).
An address a search engine has indexed must not appear and vanish because the store looked different at build time, so the
list is never worked out while a page is drawn, and an address not on it answers 404 (`dynamicParams = false`).

**On each page:** cheapest round trip and cheapest one way (with airline, stops, dates and a booking button), a month-by-
month table, a read-only price calendar per month with the cheapest day marked, the cheapest day of the week to fly out,
the airlines on the route with their cheapest fares and whether they fly it non-stop, links to the same city from the other
home airports and to other routes from the same airport, and a link to the city's own page. Unique title and description
per route (both carry that route's own price), canonical address, BreadcrumbList structured data, and all 47 in the sitemap
(67 addresses now). Booking links carry marker 765816 and the new SubID page `route` (`route_rt_bts`, `route_ow_bts`).

**Decisions made along the way** (also listed in AGENTS.md → Decisions):
- Pages read the price store ONLY, no live fallback: 47 pages × 4 months × 2 kinds would be hundreds of requests to the
  price service on every rebuild. Every price shows its real age instead ("price seen 9 h ago").
- Flight time comes only from one-way non-stop tickets — for a round-trip ticket the data does not say whether `duration`
  covers one leg or both, and a wrong flight time is worse than none.
- "Cheapest day of the week" uses one-way fares only: a round-trip price belongs to a pair of days.
- Structured data is BreadcrumbList only. There is no search-engine result type for a flight price, and marking cached
  fares up as firm offers would claim more than the data says.

**Checked in a browser against the real store (not fake data):** `/flights` and the route pages at desktop width in light
and dark mode and at iPhone width — no sideways scrolling on any of them, the only console errors are Vercel's analytics
script, which does not exist outside Vercel. Bratislava→Milan reads "from €32 round trip", "a non-stop flight takes about
1 h 35 min", Friday cheapest at €16; Prague→Berlin correctly says every cached fare has a stop, and says plainly that this
does not prove no airline flies it non-stop; Košice→Rome works on 3 months of thinner data and drops the month it has
nothing for. An invented address (`/flights/nowhere-nowhere`) answers 404. The sitemap holds all 47. `npx tsc --noEmit`,
`npm run lint` and `npm run build` are clean, and a build with no database reachable still succeeds (the pages then say
there is no cached price rather than failing the build).

**Nothing for the owner to do.** `npm run routes` only needs re-running when the route list should be widened — worth doing
after a few weeks of Search Console, together with the decision whether to go past the 12 named destinations (132 more
routes pass the same threshold).
**Note:** the Next.js 16.4.2 security notice for agent-run builds appeared again; the build finishes on a retry, as the
notice says. The advisory is about `use cache` / `unstable_cache`, which this site does not use.

# Which prices the 508 bug actually cost us, and the job order (24 Nov 2026)
**The 508 fix from PR 21 has not been tested yet.** Run 11 started at 02:26 UTC on 24 Nov; PR 21 reached production at
11:11 UTC. So run 11 is an old-code run: 9 slices, `HTTP 508` three times, 1,084 of 2,217 route jobs never run. The first
night on the new 180 s slice is 25 Nov. Nothing to do by hand — tonight's job sees run 11 `running`, older than 20 h with
no progress, gives it up and starts a fresh run.

**What the failed nights cost, measured in the store.** The damage was not spread evenly, and that was a second bug.
`summaryJobs` planned the 40 summary jobs airport by airport (all four of Bratislava's months, then Vienna's, then
Budapest's, then Košice's, then Prague's), route jobs are appended as each summary finishes, and `claimJobs` takes pending
jobs oldest id first. So the jobs dropped at the end of a short night were **the same ones every night**:

| | jobs done in run 11 (per month, of ~70) | average age of a stored route-month |
|---|---|---|
| Vienna | ~72 | 36 h |
| Bratislava | ~76 | 45 h |
| Budapest | ~60 | 91 h |
| **Košice** | **1** | **154 h** |
| **Prague** | **1** | **154 h** |

1,433 of 2,938 `price_coverage` rows were 5+ days old, and the cut fell exactly at job id 1133: everything before it was
7.7 h old on average, everything after it 159 h.

**The fix:** `summaryJobs` is now month-major and rotates the airport order one step per month (Nov: BTS VIE BUD KSC PRG;
Dec: VIE BUD KSC PRG BTS; Jan: BUD KSC PRG BTS VIE; Feb: KSC PRG BTS VIE BUD). Every airport now has its first summary
inside the first 10 jobs, and no airport is last in more than one month. A night that stops half way now costs every
airport its far months instead of costing two airports everything. It is an ordering change only: the same 40 summary
jobs, each combination exactly once, no schema change, no extra requests.

**This also puts the Košice conclusion from the route-pages work in doubt.** "Košice is not a bug: the free price data
barely covers it" was measured against a Košice that had not been refreshed properly for a week (KSC–Krakow "2 tickets,
newest 129 h old" is exactly the starvation signature). Košice really does hold less (550 tickets over 137 destinations
against Vienna's 9,329 over 692), so it will stay the thinnest airport — but **re-run `npm run routes` after the first
night that finishes**: more Košice and Prague routes may now pass the threshold.

**Verified:** the new order printed and checked (40 jobs, all 40 airport × month × kind combinations exactly once, first
job index per airport 0/2/4/6/8, a different airport last in each month). `npx tsc --noEmit`, `npm run lint` and
`npm run build` clean (47 route pages still prerendered). Live site checked after the PR 22 deployment: `/`, `/flights`,
`/flights/bratislava-milan`, `/deals`, `/guides`, `/trips` and the sitemap all answer 200, the sitemap holds 67 addresses
with all 47 route pages, and Bratislava→Milan shows "from €32 round trip" with "price seen 9 h ago".
**Note:** the Next.js 16.4.2 security notice for agent-run builds appeared again; the build finished on the retry, as the
notice says.

# Three guides, written from our own data (branch `feature/guides-from-our-data`, 24 Nov 2026)
Priority 4 in AGENTS.md (Hostelworld approval) needs travel content, and the content section held nothing: zero
guides, zero trip reports. These three guides fill it. **All three are `draft: true`** — they show only on the
owner's own machine and are kept out of the live site, the listings and the sitemap until he has read them and set
`draft: false`. The text goes out under his name, so publishing is his decision.

| Guide | What it is built from |
|---|---|
| `five-airports-one-search` | Why the site compares five airports, when the travel to Vienna or Budapest pays off, the different-airport return, how to search all five |
| `what-a-city-break-costs` | Our own day-cost table for the 12 cities, the three spending styles and their multipliers, the trip-total formula, what the estimate leaves out |
| `cheapest-day-to-fly` | Our own price store: which weekday was cheapest on 50 routes, how big the gap is, the median cheapest return per month |

**Every number in them was measured, not remembered.** The day-cost table is the `destinations` table. The weekday
piece counted, over fares seen in the previous 14 days from the five airports to the 12 cities, the cheapest fare per
weekday per route, keeping the 50 routes that had a price on all seven days: Saturday cheapest on 14 routes, Friday
13, Thursday 11, Wednesday 8, Monday 7, **Tuesday 2**, Sunday 2 — so the "fly on a Tuesday" rule does not hold in our
data. Cheapest weekday averaged €29.60 one way against €54.80 for the dearest, a €20 median gap, 44% on average. The
guide states its own limits (50 routes, one snapshot, one-way fares only, part of the spread is the date not the day).
The month table is the median cheapest return per route-month: Nov €148, Dec €130, Jan €104, Feb €97.

**What was deliberately left out.** Coach and bus fares: we checked, and published prices for the same journey differ
between sources and change through the year. Even the Prague airport bus number is contested (119 was renumbered in
2024 and sources disagree on what replaced it). So the guides name operators, give times in round terms, and carry no
outside fares and no outside links at all — a guessed official link for Budapest Airport was already a 404, which is
exactly the failure mode we avoided.

**A real UI bug found while checking.** `.article` sets `overflow-wrap: anywhere` so long links do not overflow; in a
table cell on a phone that broke words and prices in half ("Barcelo na", "€1 4"). A 6-column table was technically
inside the page but unreadable. `.article table` now scrolls sideways (`display: block; width: max-content;
overflow-x: auto`) and cells keep their text on one line. This was fixed in the CSS rather than by simplifying the
table, because it would hit any table the owner writes.

**Also:** both content templates now say to use `#` for section headings. The renderer turns `#` into an h2 directly
under the page's h1; the templates said `##`, which skips a heading level.

**Checked in a browser** (drafts only exist in `npm run dev`): all three guides and the guides listing at 1440 px and
at 375/390 px, light and dark. No sideways scrolling of the page on any of them, the tables scroll inside themselves,
headings come out as h2, and the "Related destinations" box degrades to "No cached fare right now" without a database
(there is no `.env.local` on this machine, which is also why the dev console shows price 401s — neither is caused by
these changes). The sample trip page is unaffected. `npx tsc --noEmit`, `npm run lint` and `npm run build` clean, and
the production build leaves all three drafts out of the sitemap and renders no page for them.

**Published.** The owner read all three and asked for all three to go live on 24 Nov 2026, so `draft` is `false` on
each. They are the first articles on the site: `/guides` now lists three, and the sitemap carries their addresses.
The next content has to be his own, because trip reports are his alone.

**Bug found on the live page, right after publishing (24 Nov 2026).** In `cheapest-day-to-fly` a line wrapped so that
"2026." began a line, and Markdown reads that as a numbered list starting at 2026: the rest of the sentence was
rendered as `<ol start="2026">` with a stray list item. Caught by reading the HTML the live page served, not by the
build, which had no opinion about it. The sentence is reflowed, and `load.ts` now stops the build when a line in a
content file starts with a number of three or more digits and a full stop. A real numbered list never starts that
high, so the check only catches the mistake, and it names the file and the line. Verified both ways: the build is
clean now, and putting the mistake back makes it fail with that message.
