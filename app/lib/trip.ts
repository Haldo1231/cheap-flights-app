// Client-safe helpers for turning cached data into the shapes the pages show.

import { buildBookingLink } from '../aviasalesLink'
import type { CalendarDay, Fare, Leg } from '../tripTypes'
import type { TripLegSnapshot, TripSnapshot } from './tripUrl'

/**
 * Turns a month-calendar day into a Fare, so a calendar day always has full
 * flight details (airline, time, return) even when the day-by-day lookup finds
 * nothing. `from`/`to` are the real direction of the flight: for the outbound
 * calendar from = home airport, for the inbound calendar from = the destination.
 */
export function calendarDayToFare(day: CalendarDay, date: string, from: string, to: string): Fare {
  const outbound: Leg = {
    origin: from,
    destination: to,
    date,
    time: day.time,
    airlineCode: day.airlineCode,
    airlineName: day.airlineName,
    stops: day.stops,
    bookingUrl: buildBookingLink(from, to, date),
  }
  const inbound: Leg | null = day.returnDate
    ? {
        origin: to,
        destination: from,
        date: day.returnDate,
        time: day.returnTime,
        airlineCode: day.airlineCode,
        airlineName: day.airlineName,
        stops: null,
        bookingUrl: buildBookingLink(to, from, day.returnDate),
      }
    : null
  return {
    id: `cal|${from}|${to}|${date}|${day.price}`,
    price: day.price,
    kind: inbound ? 'round-trip' : 'one-way',
    outbound,
    inbound,
    gate: null,
    bookingUrl: buildBookingLink(from, to, date, day.returnDate || undefined),
    returnMatchesRequest: null,
    foundAt: day.foundAt ?? null,
    outdated: !!day.outdated,
  }
}

/** Day-by-day flights plus the calendar's own fare for that day (if it is not
 * already in the list), valid prices first and cheapest first. */
export function withCalendarFare(fares: Fare[], calendarFare: Fare | null): Fare[] {
  if (!calendarFare) return fares
  const alreadyThere = fares.some(
    (f) => f.outbound.origin === calendarFare.outbound.origin && f.price === calendarFare.price
  )
  if (alreadyThere) return fares
  return [...fares, calendarFare].sort((a, b) => Number(!!a.outdated) - Number(!!b.outdated) || a.price - b.price)
}

/**
 * What a Whole Month pick costs in total. A round-trip fare is ONE price for both flights, so it is
 * never added to another fare's price (adding two would count the trip twice):
 * - two one-way fares: their prices added;
 * - one round-trip fare whose own return day is the picked return day: just its price
 *   (`returnIncluded`: the return flight is part of it);
 * - anything else (a round-trip fare that returns on another day, or a round-trip fare as the
 *   return flight): no exact total. null, never a guess.
 */
export function monthTripPrice(
  out: Fare | null,
  back: Fare | null,
  backDate: string | null,
  oneWay: boolean
): { total: number | null; returnIncluded: boolean } {
  if (!out) return { total: null, returnIncluded: false }
  if (oneWay) return { total: out.price, returnIncluded: false }
  if (out.kind === 'round-trip') {
    return out.inbound && backDate && out.inbound.date === backDate
      ? { total: out.price, returnIncluded: true }
      : { total: null, returnIncluded: false }
  }
  if (!back || back.kind === 'round-trip') return { total: null, returnIncluded: false }
  return { total: out.price + back.price, returnIncluded: false }
}

/** The fare a Whole Month day shows first: the cheapest ONE-WAY fare (the building block of an out + back
 * trip), otherwise the cheapest fare of any kind. `fares` is already cheapest-first. */
export function defaultMonthFare(fares: Fare[]): Fare | null {
  return fares.find((f) => f.kind === 'one-way') ?? fares[0] ?? null
}

function legSnapshot(leg: Leg, price: number | null): TripLegSnapshot {
  return {
    origin: leg.origin,
    destination: leg.destination,
    date: leg.date,
    time: leg.time,
    airlineCode: leg.airlineCode,
    stops: leg.stops,
    price,
  }
}

/** What the trip page needs to show one cached fare (one price for the whole fare). */
export function snapshotFromFare(fare: Fare): TripSnapshot {
  return {
    kind: 'fare',
    outbound: legSnapshot(fare.outbound, null),
    inbound: fare.inbound ? legSnapshot(fare.inbound, null) : null,
    price: fare.price,
    gate: fare.gate,
    foundAt: fare.foundAt ?? null,
  }
}

/** What the trip page needs for two separately priced flights (Whole Month, open-jaw). A trip of two
 * prices is only as fresh as the older one, so `foundAt` is the older of the two times. */
export function snapshotFromLegs(
  outbound: Leg & { price: number },
  inbound: (Leg & { price: number }) | null,
  foundAt: string | null = null
): TripSnapshot {
  return {
    kind: 'legs',
    outbound: legSnapshot(outbound, outbound.price),
    inbound: inbound ? legSnapshot(inbound, inbound.price) : null,
    price: outbound.price + (inbound?.price ?? 0),
    gate: null,
    foundAt,
  }
}
