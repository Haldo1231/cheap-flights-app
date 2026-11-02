'use client'

// The "fly back to a different airport" trips of the Anywhere screens. They arrive in a separate request and are NEVER
// merged into the normal results: the main price of a card or row stays the cheapest round trip from the same airport.
// The different-airport trip is shown next to it as an extra line (country cards), or as its own list below the round
// trips (a country's cities). No trip cached = no extra line.

import { useJson } from './useJson'
import type { AnywhereJawResponse } from '../api/anywhere-jaw/route'
import type { AnywhereCity, AnywhereTrip } from '../tripTypes'

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

/** A different-airport trip next to the same-airport round trip of the same city. */
export type JawExtra = {
  trip: AnywhereTrip
  /** Trip price minus the round-trip price: positive = dearer, negative = cheaper. null = no round trip to compare with. */
  difference: number | null
}

/** The extra line for one city, or null when no different-airport trip is cached (or it does not come back to another airport). */
export function jawExtra(jawTrip: AnywhereTrip | undefined | null, roundTrip: AnywhereTrip | null | undefined): JawExtra | null {
  if (!jawTrip || !returnsToOtherAirport(jawTrip)) return null
  return { trip: jawTrip, difference: roundTrip && roundTrip.inbound ? jawTrip.price - roundTrip.price : null }
}

/** The cities of one country that have a different-airport trip, cheapest trip first. `cities` is every checked city of
 * the country (those with a round trip on your days and those without). */
export function jawCityRows(cities: AnywhereCity[], jaw: Record<string, AnywhereTrip>): { city: AnywhereCity; extra: JawExtra }[] {
  const rows: { city: AnywhereCity; extra: JawExtra }[] = []
  for (const city of cities) {
    const extra = jawExtra(jaw[city.code], city.trip)
    if (extra) rows.push({ city, extra })
  }
  return rows.sort((a, b) => a.extra.trip.price - b.extra.trip.price || a.city.name.localeCompare(b.city.name))
}
