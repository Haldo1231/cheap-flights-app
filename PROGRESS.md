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

