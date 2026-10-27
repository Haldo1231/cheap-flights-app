// Shared shapes for flights as they travel from the API routes to the pages.
// Everything here comes from cached Travelpayouts data -- a field is null
// when the cache does not have it (we never fill in a guess).

/** One flight (one direction). */
export type Leg = {
  origin: string
  destination: string
  date: string // YYYY-MM-DD
  time: string | null // HH:MM local departure time, null if the cache has none
  airlineCode: string | null
  airlineName: string | null
  stops: number | null // null = unknown
  /** One-way search link for just this flight. */
  bookingUrl: string
}

/** A leg that also has its own price (used when two legs are priced separately). */
export type PricedLeg = Leg & { price: number }

/**
 * One cached fare. A round-trip fare is ONE price that covers both flights
 * (Travelpayouts does not split it per leg), so `price` belongs to the whole
 * fare and the return leg carries no price of its own.
 */
export type Fare = {
  id: string
  price: number
  kind: 'round-trip' | 'one-way'
  outbound: Leg
  inbound: Leg | null
  /** Booking site that found the fare (only known for some sources). */
  gate: string | null
  /** Books the whole fare (both flights when it is a round trip). */
  bookingUrl: string
  /** For exact-date round trips: does the cached return date equal the one requested? */
  returnMatchesRequest: boolean | null
}

/** Open-jaw: two separately priced one-direction flights, possibly to/from different airports. */
export type OpenJawCombo = {
  outbound: PricedLeg
  inbound: PricedLeg
  total: number
}

/** One day of a month calendar (cheapest cached fare departing that day). */
export type CalendarDay = {
  price: number
  /** Home airport this fare belongs to (for the inbound calendar: the airport you fly back to). */
  origin: string
  airlineCode: string | null
  airlineName: string | null
  time: string | null
  stops: number | null
  /** Return date the cached fare was priced with, if the cache has one. */
  returnDate: string | null
  returnTime: string | null
}
export type CalendarDayMap = Record<string, CalendarDay>
