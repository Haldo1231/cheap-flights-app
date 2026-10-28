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
Status: done, but the photos themselves still need to be fetched (needs your key)

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
