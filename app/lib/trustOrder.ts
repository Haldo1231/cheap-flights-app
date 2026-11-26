// Which cached prices go on top of a list that recommends (Anywhere, Deals). Nothing is hidden: a price only moves down.
//   tier 0: seen in the last 72 h AND the outbound flight names its airline (a complete, fresh fare)
//   tier 1: seen in the last 72 h, but no airline in the data
//   tier 2: seen longer ago than 72 h, or the data does not say when (we cannot call it fresh)
// Inside a tier the cheaper price comes first. Client-safe (no server imports).

import { MAX_PRICE_AGE_MS, priceAgeMs } from './priceAge'
import { airportCountryCode } from '../airportsList'
import type { AnywhereCity, AnywhereCountry } from '../tripTypes'

export type Trusted = { price: number; seenAt?: string | null; airline?: string | null }

export function trustTier(item: Trusted, now = Date.now()): 0 | 1 | 2 {
  const age = priceAgeMs(item.seenAt ?? null, now)
  if (age === null || age > MAX_PRICE_AGE_MS) return 2
  return item.airline ? 0 : 1
}

/** Fresh and complete first, then fresh without an airline, then old or undated; cheaper first inside each group. */
export function byTrust<T>(get: (item: T) => Trusted | null) {
  const now = Date.now()
  return (a: T, b: T): number => {
    const x = get(a)
    const y = get(b)
    if (!x || !y) return x ? -1 : y ? 1 : 0
    return trustTier(x, now) - trustTier(y, now) || x.price - y.price
  }
}

/** True when a flight from this home airport to a city in `countryCode` stays inside the airport's own country
 * (Košice → Bratislava): never offered as a tip. Unknown countries are not treated as domestic. */
export function isDomestic(origin: string, countryCode: string | null | undefined): boolean {
  const home = airportCountryCode(origin)
  return !!home && !!countryCode && home.toUpperCase() === countryCode.toUpperCase()
}

/** An Anywhere city by its checked trip (null = no trip, goes last). */
export function cityTrust(city: AnywhereCity): Trusted | null {
  const trip = city.trip
  return trip ? { price: trip.price, seenAt: trip.seenAt ?? null, airline: trip.outbound.airlineCode ?? trip.outbound.airlineName } : null
}

/** An Anywhere country by the trip of its checked city. */
export function countryTrust(country: AnywhereCountry): Trusted | null {
  if (country.price === null) return null
  const trip = country.verifiedCity?.trip
  return { price: country.price, seenAt: trip?.seenAt ?? null, airline: trip ? trip.outbound.airlineCode ?? trip.outbound.airlineName : null }
}

/** The index of the cheapest price in a list (the first one on a tie), for the "Cheapest" badge: after the trust order the
 * cheapest item is not always on top, and the badge must only ever sit on the real cheapest one. -1 when there is none. */
export function cheapestIndex(prices: (number | null | undefined)[]): number {
  let best = -1
  prices.forEach((p, i) => {
    if (p != null && (best === -1 || p < (prices[best] as number))) best = i
  })
  return best
}
