// Small pure helpers about WHERE an Anywhere trip comes back to. No React and no browser code in here, so the
// server (API routes, link-preview cards) and the pages can both use it.

import type { AnywhereTrip } from '../tripTypes'

/** True when the trip leaves from one home airport and comes back to another. */
export function returnsToOtherAirport(trip: AnywhereTrip | null | undefined): boolean {
  return !!trip?.inbound && trip.inbound.destination !== trip.outbound.origin
}

/** The words that say what a trip is, shown on every card and row while the "fly back to a different airport" switch is on:
 * "round trip, back to BTS" (one round-trip fare, same airport), "two one-way tickets, back to PRG" (out from one airport,
 * back to another), or "out + back" (a Whole month trip: two cached prices added) / "one way". */
export function tripRouteLabel(trip: AnywhereTrip): string {
  if (!trip.inbound) return 'one way'
  const back = trip.inbound.destination
  if (returnsToOtherAirport(trip)) return `two one-way tickets, back to ${back}`
  return trip.kind === 'fare' ? `round trip, back to ${back}` : 'out + back'
}

/** The cheaper of a same-airport round trip and a trip back to a different airport. The different-airport trip only wins
 * when it is really cheaper (or when there is no round trip at all); on equal prices the normal round trip stays. null =
 * neither exists. */
export function cheaperTrip(roundTrip: AnywhereTrip | null | undefined, jawTrip: AnywhereTrip | null | undefined): AnywhereTrip | null {
  const jaw = jawTrip && returnsToOtherAirport(jawTrip) ? jawTrip : null
  if (!roundTrip) return jaw
  if (jaw && jaw.price < roundTrip.price) return jaw
  return roundTrip
}
