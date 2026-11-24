// The Travelpayouts SubID on every booking link: where the click came from, so Travelpayouts' statistics (Reports →
// Performance → group by SubID) show clicks, bookings and earnings per screen, trip type and home airport.
// Format: `page_trip_airport`, e.g. `citycal_two_bts`. Travelpayouts allows only Latin letters, digits and "_" (max 4096
// characters; support.travelpayouts.com article 203955653), and it is passed as `sub_id=` on the tp.media link (checked
// with Travelpayouts' own link API on 17 Nov 2026).

/** The screen a booking button is on. */
export type LinkPage =
  | 'anywhere' // the Anywhere overview cards and the "Where can I fly cheaply?" page (/anywhere)
  | 'country' // a country screen of Anywhere
  | 'citycal' // a city's Whole month page, days picked on the calendars
  | 'combos' // a city's Whole month page, picked from "Best combinations"
  | 'trip' // the trip detail page
  | 'deals' // /deals
  | 'dest' // /destinations/[slug]
  | 'guide' // a guide or trip report
  | 'results' // the exact-date and date-range result lists (and their different-airport pairs)
  | 'back' // "Find a flight back"
  | 'route' // a route page (/flights/bratislava-milan)

/** One-way ticket, round-trip ticket, or two one-way tickets that make one trip. */
export type LinkTrip = 'ow' | 'rt' | 'two'

export const LINK_PAGES = ['anywhere', 'country', 'citycal', 'combos', 'trip', 'deals', 'dest', 'guide', 'results', 'back', 'route'] as const satisfies readonly LinkPage[]
export const LINK_TRIPS = ['ow', 'rt', 'two'] as const satisfies readonly LinkTrip[]

const SAFE = /[^a-z0-9]/g

/** `page_trip_airport` in lowercase, letters and digits only inside each part. Airport = the home airport the trip starts
 * from (for a flight back: the home airport it lands at). */
export function makeSubId(page: LinkPage, trip: LinkTrip, airport: string | null | undefined): string {
  const code = (airport ?? '').toLowerCase().replace(SAFE, '') || 'xxx'
  return `${page}_${trip}_${code}`
}

/** The same booking link with this SubID (replaces one that is there). Only tp.media links get it. */
export function withSubId(url: string, subId: string | null | undefined): string {
  if (!subId || !url.startsWith('https://tp.media/r?')) return url
  const clean = subId.replace(/[^A-Za-z0-9_]/g, '').slice(0, 200)
  if (!clean) return url
  return /[?&]sub_id=[^&]*/.test(url) ? url.replace(/([?&])sub_id=[^&]*/, `$1sub_id=${clean}`) : `${url}&sub_id=${clean}`
}

/** The SubID of a link, or null. */
export function subIdOf(url: string): string | null {
  const m = /[?&]sub_id=([A-Za-z0-9_]+)/.exec(url)
  return m ? m[1] : null
}
