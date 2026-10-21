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
Status: not started

## Task 5: No crashes/infinite loads — loading, empty, error states everywhere
Status: not started
