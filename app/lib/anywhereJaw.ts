'use client'

// The "fly back to a different airport" trips of the Anywhere screens (exact dates and date range, switch ON).
// They arrive in a second request, so the normal round trips are on screen first. When they arrive they are MIXED INTO
// the same list: a city (or a country card) shows whichever is cheaper, its round trip from the same airport or the trip
// that comes back to another airport, the list is sorted by that price, and every trip says what it is
// ("round trip, back to BTS" / "two one-way tickets, back to PRG", see tripRouteLabel). Switch OFF = no second request
// and no change at all.

import { useJson } from './useJson'
import { cheaperTrip } from './tripRoute'
import type { AnywhereJawResponse } from '../api/anywhere-jaw/route'
import type { AnywhereCity, AnywhereCountry, AnywhereTrip } from '../tripTypes'

export { returnsToOtherAirport, tripRouteLabel } from './tripRoute'

const NONE: Record<string, AnywhereTrip> = {}

/** Loads the different-airport trips for the overview (no country) or for one country. Pass `enabled` false to skip. */
export function useAnywhereJaw(dataString: string, enabled: boolean, country?: string) {
  const url = enabled ? `/api/anywhere-jaw?${dataString}${country ? `&country=${encodeURIComponent(country)}` : ''}` : null
  const { data, loading, error } = useJson<AnywhereJawResponse>(url)
  return { trips: data?.trips ?? NONE, found: Object.keys(data?.trips ?? NONE).length, loading, error }
}

/** One city with its cheaper trip: the different-airport trip replaces the round trip only when it costs less (or when the
 * city has no round trip on your days). The same object comes back when nothing changes. */
export function mixJawIntoCity(city: AnywhereCity, jawTrip: AnywhereTrip | undefined): AnywhereCity {
  const better = cheaperTrip(city.trip, jawTrip)
  if (!better || better === city.trip) return city
  return { ...city, origin: better.outbound.origin, trip: better, roundTripPrice: city.trip?.price ?? null }
}

/** The country cards with the different-airport trips mixed in: each card's city and "from €X" are the cheaper of the two,
 * and the countries are sorted again by that price. A country that only has a different-airport trip moves up from "no
 * matching day" into the list. `used` = how many cards now show a trip back to another airport. */
export function mixJawIntoCountries(
  countries: AnywhereCountry[],
  unmatched: AnywhereCountry[],
  jaw: Record<string, AnywhereTrip>
): { countries: AnywhereCountry[]; unmatched: AnywhereCountry[]; used: number } {
  let used = 0
  const mixed = (country: AnywhereCountry): AnywhereCountry => {
    const city = country.verifiedCity
    if (!city) return country
    const next = mixJawIntoCity(city, jaw[city.code])
    if (next === city) return country
    used += 1
    return { ...country, verifiedCity: next, price: next.trip?.price ?? country.price }
  }
  const all = [...countries, ...unmatched].map(mixed)
  const matched = all.filter((c) => c.price !== null).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  return { countries: matched, unmatched: all.filter((c) => c.price === null), used }
}

/** The cities of one country with the different-airport trips mixed in, in the same way: the cheaper trip per city, the
 * matching cities sorted by it, a city that only has a different-airport trip no longer under "no matching day". */
export function mixJawIntoCities(
  cities: AnywhereCity[],
  unmatched: AnywhereCity[],
  jaw: Record<string, AnywhereTrip>
): { cities: AnywhereCity[]; unmatched: AnywhereCity[]; used: number } {
  let used = 0
  const mixed = [...cities, ...unmatched].map((city) => {
    const next = mixJawIntoCity(city, jaw[city.code])
    if (next !== city) used += 1
    return next
  })
  const matched = mixed.filter((c) => c.trip).sort((a, b) => (a.trip?.price ?? Infinity) - (b.trip?.price ?? Infinity))
  return { cities: matched, unmatched: mixed.filter((c) => !c.trip), used }
}
