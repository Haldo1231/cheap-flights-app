// The facts for a "link preview" card, worked out on the server from the same cached data
// the pages use. Everything here is best effort: when something is missing or slow the
// caller falls back to the plain brand picture. Server code only.

import { parseAnywhereParams, rankCountries, anywhereMonths, checkCity, checkCityOpenJaw } from '../anywhereSearch'
import { getCityInfo } from '../geoData'
import { AIRPORTS, airportCountryCode } from '../airportsList'
import { cleanCode } from './apiParams'
import { cheaperTrip, returnsToOtherAirport } from './tripRoute'
import { formatMonth, formatShortDate } from './format'
import { searchFromResults, type SavedSearch } from './saved/search'
import { priceNow } from './saved/price'
import type { OgCard } from './ogCard'
import type { TripSnapshot } from './tripUrl'

/** "Vienna +2" style label for the home airports of a search. */
function fromLabel(origins: string[]): string {
  const first = AIRPORTS.find((a) => a.code === origins[0])?.city ?? origins[0] ?? ''
  return `From ${first}${origins.length > 1 ? ` +${origins.length - 1}` : ''}`
}

function datesLine(out: string | null | undefined, back: string | null | undefined): string {
  if (!out) return ''
  return back ? `${formatShortDate(out)} → ${formatShortDate(back)}` : formatShortDate(out)
}

/** The card for one country of an Anywhere search: the same price the country's card shows. */
export async function countryShareCard(sp: URLSearchParams): Promise<OgCard | null> {
  const code = cleanCode(sp.get('country'))
  if (!code) return null
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const { origins, params } = parseAnywhereParams(sp)
  const { countries } = await rankCountries(origins, anywhereMonths(params), params.oneWay, token)
  const country = countries.find((c) => c.code === code)
  if (!country) return null
  // The same trip the country's card shows: with the "fly back to a different airport" switch on (exact dates / date range
  // round trips) the cheaper of the round trip and the trip back to another airport.
  const withJaw = sp.get('openJaw') === 'true' && !params.oneWay && params.dateMode !== 'month'
  const [checked, jawTrip] = await Promise.all([
    checkCity(country.cities[0], params, origins, token),
    withJaw ? checkCityOpenJaw(country.cities[0].cityCode, origins, params, token, country.cities[0].countryCode) : null,
  ])
  const trip = cheaperTrip(checked?.trip, jawTrip)
  return {
    title: country.name,
    eyebrow: fromLabel(origins),
    price: trip ? trip.price : null,
    note: trip ? (!trip.inbound ? 'one way' : returnsToOtherAirport(trip) ? 'two one-way tickets' : 'round trip') : '',
    line: trip ? datesLine(trip.outbound.date, trip.inbound?.date) : `${country.cities.length} destination${country.cities.length === 1 ? '' : 's'}`,
    cc: country.code,
  }
}

/** The card for a city's results: the price of THIS search (its dates, one way or round trip), worked out like the top of the
 * results list (lib/saved/price.ts: exact dates count only fares returning on the asked day). No price when the screen's
 * headline price is not one number that could be repeated here honestly: a whole month (the calendars mix one-way days and
 * combinations), a date range with weekday limits, or nothing cached. Never the city's cheapest fare on other dates. */
export async function destinationShareCard(sp: URLSearchParams): Promise<OgCard | null> {
  const destination = cleanCode(sp.get('destination'))
  if (!destination) return null
  const { origins } = parseAnywhereParams(sp)
  const search = searchFromResults(sp)
  const weekdayLimits = !!(sp.get('outDays') || sp.get('backDays'))
  const priced = search && search.dateMode !== 'month' && !(search.dateMode === 'range' && weekdayLimits)
  const [place, now] = await Promise.all([getCityInfo(destination), priced && search ? priceNow(search) : null])
  const name = place?.name ?? AIRPORTS.find((a) => a.code === destination)?.city ?? destination
  const price = now?.kind === 'price' ? now.price : null
  const oneWay = sp.get('oneWay') === 'true'
  return {
    title: name,
    eyebrow: fromLabel(origins),
    price,
    note: price !== null ? (oneWay ? 'one way' : 'round trip') : '',
    line: search ? searchDatesLine(search) : '',
    cc: place?.country.code ?? airportCountryCode(destination) ?? '',
  }
}

/** The dates of a search as the card shows them: "11 Dec → 14 Dec", "11 Dec – 20 Dec", "Jan 2027". */
function searchDatesLine(s: SavedSearch): string {
  if (s.dateMode === 'exact') return datesLine(s.dateFrom, s.dateTo)
  if (s.dateMode === 'range') return `${formatShortDate(s.dateFrom)} – ${formatShortDate(s.dateTo)}`
  if (s.dateMode === 'month') return formatMonth(s.dateFrom)
  return ''
}

/** The card for a trip page (the trip is read from the address, like the page does). */
export async function tripShareCard(trip: TripSnapshot): Promise<OgCard> {
  const destination = trip.outbound.destination
  const place = await getCityInfo(destination)
  const name = place?.name ?? AIRPORTS.find((a) => a.code === destination)?.city ?? destination
  const originCity = AIRPORTS.find((a) => a.code === trip.outbound.origin)?.city ?? trip.outbound.origin
  return {
    title: name,
    eyebrow: `From ${originCity}`,
    price: trip.price,
    note: trip.inbound ? (trip.kind === 'fare' ? 'round trip' : 'out + back') : 'one way',
    line: datesLine(trip.outbound.date, trip.inbound?.date),
    cc: place?.country.code ?? airportCountryCode(destination) ?? '',
  }
}
