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
Status: not started

## Task 3: Hostel affiliate — check if hostel links can earn commission
Status: not started

## Task 4: Mobile — check every page at phone width
Status: not started

## Task 5: No crashes/infinite loads — loading, empty, error states everywhere
Status: not started
