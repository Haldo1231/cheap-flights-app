// Shared shapes for flights as they travel from the API routes to the pages.
// Everything here comes from cached Travelpayouts data -- a field is null
// when the cache does not have it (we never fill in a guess).

import type { CountryImage } from './lib/countryImage'

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
  /** When the cache found this price (ISO time). null = the source does not say (never guessed). */
  foundAt?: string | null
  /** The data flags this price as no longer valid or expired: it is ranked after valid prices and labelled. */
  outdated?: boolean
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
  /** When the cache found this price (ISO time), if the source says. */
  foundAt?: string | null
  /** The data flags this price as expired / no longer valid. */
  outdated?: boolean
}
export type CalendarDayMap = Record<string, CalendarDay>

/** A leg inside a trip summary. `price` is null when the whole fare has one price. */
export type TripLeg = Leg & { price: number | null }

/**
 * One concrete trip found for an Anywhere city. kind "fare" = a single cached
 * fare (a round-trip fare has one price for both legs); kind "legs" = an
 * outbound and a return flight that each have their own cached price.
 */
export type AnywhereTrip = {
  price: number
  kind: 'fare' | 'legs'
  outbound: TripLeg
  inbound: TripLeg | null
  /** When the cache found the price (ISO time); for two separately priced flights, the older of the two. null = not in the data. */
  foundAt?: string | null
}

export type AnywhereCity = {
  code: string
  name: string
  /** Home airport this city was checked from. */
  origin: string
  /** Price from the quick ranking -- rough, NOT checked against the filters. */
  roughPrice: number
  /** A real cached fare from the quick ranking (dates/airline), not filtered. */
  example: { price: number; outbound: Leg; inbound: Leg | null; foundAt?: string | null } | null
  /** Trip that honors every filter. null = checked, nothing matches. undefined = not checked. */
  trip?: AnywhereTrip | null
}

export type AnywhereCountry = {
  code: string
  name: string
  candidateCityCount: number
  /** Cheapest price among the cities that match the filters (null if none do). */
  price: number | null
  verifiedCity: AnywhereCity | null
  /** The other cities in this country (quick ranking only). */
  candidateCities: AnywhereCity[]
  /** The saved Unsplash photo for this country, or null (the card then shows a gradient + flag). */
  image?: CountryImage | null
}

/** What /api/compare answers: priced fares, or (open-jaw) two-leg combinations. */
export type CompareResponse =
  | {
      openJaw: true
      destination: string
      results: OpenJawCombo[]
      missingOutbound: boolean
      missingReturn: boolean
      outboundOnly: PricedLeg[]
    }
  | {
      openJaw?: false
      destination: string
      results: Fare[]
      /** How many cached fares were found before the list was cut to the cheapest. */
      total: number
      requestedReturn: string | null
      oneWayRequested: boolean
    }
