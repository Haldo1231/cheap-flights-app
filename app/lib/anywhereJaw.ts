'use client'

// The "fly back to a different airport" trips of the Anywhere screens. They arrive in a separate request and are
// merged into the normal results: a city's trip is replaced when the different-airport trip is cheaper (or when the
// city had no trip that matched the filters at all), and the lists are put in price order again.

import { useJson } from './useJson'
import type { AnywhereJawResponse } from '../api/anywhere-jaw/route'
import type { AnywhereCity, AnywhereCountry, AnywhereTrip } from '../tripTypes'

const NONE: Record<string, AnywhereTrip> = {}

/** True when the trip leaves from one home airport and comes back to another. */
export function returnsToOtherAirport(trip: AnywhereTrip | null | undefined): boolean {
  return !!trip?.inbound && trip.inbound.destination !== trip.outbound.origin
}

/** Loads the different-airport trips for the overview (no country) or for one country. Pass `enabled` false to skip. */
export function useAnywhereJaw(dataString: string, enabled: boolean, country?: string) {
  const url = enabled ? `/api/anywhere-jaw?${dataString}${country ? `&country=${encodeURIComponent(country)}` : ''}` : null
  const { data, loading, error } = useJson<AnywhereJawResponse>(url)
  return { trips: data?.trips ?? NONE, found: Object.keys(data?.trips ?? NONE).length, loading, error }
}

function betterTrip(current: AnywhereTrip | null | undefined, jaw: AnywhereTrip | undefined): AnywhereTrip | null {
  if (!jaw) return null
  return !current || jaw.price < current.price ? jaw : null
}

/** Country cards: each country's checked city takes the different-airport trip when it is cheaper. Countries that had
 * no matching trip before can now have one. Both lists come back in price order. */
export function mergeJawIntoCountries(countries: AnywhereCountry[], unmatched: AnywhereCountry[], jaw: Record<string, AnywhereTrip>) {
  const matched: AnywhereCountry[] = []
  const still: AnywhereCountry[] = []
  for (const country of [...countries, ...unmatched]) {
    const city = country.verifiedCity
    const better = city ? betterTrip(city.trip, jaw[city.code]) : null
    const merged: AnywhereCountry =
      city && better ? { ...country, price: better.price, verifiedCity: { ...city, origin: better.outbound.origin, trip: better } } : country
    ;(merged.price != null ? matched : still).push(merged)
  }
  matched.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  return { countries: matched, unmatched: still }
}

/** The cities of one country, the same way. */
export function mergeJawIntoCities(cities: AnywhereCity[], unmatched: AnywhereCity[], jaw: Record<string, AnywhereTrip>) {
  const matched: AnywhereCity[] = []
  const still: AnywhereCity[] = []
  for (const city of [...cities, ...unmatched]) {
    const better = betterTrip(city.trip, jaw[city.code])
    const merged: AnywhereCity = better ? { ...city, origin: better.outbound.origin, trip: better } : city
    ;(merged.trip ? matched : still).push(merged)
  }
  matched.sort((a, b) => (a.trip?.price ?? Infinity) - (b.trip?.price ?? Infinity))
  return { cities: matched, unmatched: still }
}
