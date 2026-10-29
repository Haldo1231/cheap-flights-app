// The facts for a "link preview" card, worked out on the server from the same cached data
// the pages use. Everything here is best effort: when something is missing or slow the
// caller falls back to the plain brand picture. Server code only.

import { parseAnywhereParams, rankCountries, checkCity } from '../anywhereSearch'
import { getCheapestFare } from '../flightSources'
import { getCityInfo } from '../geoData'
import { AIRPORTS, airportCountryCode } from '../airportsList'
import { cleanCode } from './apiParams'
import { formatShortDate } from './format'
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
  const { countries } = await rankCountries(origins, token)
  const country = countries.find((c) => c.code === code)
  if (!country) return null
  const checked = await checkCity(country.cities[0], params, token)
  const trip = checked?.trip
  return {
    title: country.name,
    eyebrow: fromLabel(origins),
    price: trip ? trip.price : null,
    note: trip ? (trip.inbound ? 'round trip' : 'one way') : '',
    line: trip ? datesLine(trip.outbound.date, trip.inbound?.date) : `${country.cities.length} destination${country.cities.length === 1 ? '' : 's'}`,
    cc: country.code,
  }
}

/** The card for a city's results: its cheapest cached fare from the chosen airports. */
export async function destinationShareCard(sp: URLSearchParams): Promise<OgCard | null> {
  const destination = cleanCode(sp.get('destination'))
  if (!destination) return null
  const { origins } = parseAnywhereParams(sp)
  const [place, fare] = await Promise.all([
    getCityInfo(destination),
    getCheapestFare(origins, destination, process.env.TRAVELPAYOUTS_TOKEN),
  ])
  const name = place?.name ?? AIRPORTS.find((a) => a.code === destination)?.city ?? destination
  return {
    title: name,
    eyebrow: fromLabel(origins),
    price: fare ? fare.price : null,
    note: fare ? (fare.inbound ? 'round trip' : 'one way') : '',
    line: fare ? datesLine(fare.outbound.date, fare.inbound?.date) : '',
    cc: place?.country.code ?? airportCountryCode(destination) ?? '',
  }
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
