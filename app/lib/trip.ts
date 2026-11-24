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
    seenAt: day.foundAt ?? null,
  }
}

/** Day-by-day flights plus the calendar's own fare for that day (if it is not
 * already in the list), cheapest first. */
export function withCalendarFare(fares: Fare[], calendarFare: Fare | null): Fare[] {
  if (!calendarFare) return fares
  const alreadyThere = fares.some(
    (f) => f.outbound.origin === calendarFare.outbound.origin && f.price === calendarFare.price
  )
  if (alreadyThere) return fares
  return [...fares, calendarFare].sort((a, b) => a.price - b.price)
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
    seenAt: fare.seenAt,
  }
}

/** What the trip page needs for two separately priced flights (Whole Month, open-jaw). */
export function snapshotFromLegs(
  outbound: Leg & { price: number },
  inbound: (Leg & { price: number }) | null
): TripSnapshot {
  return {
    kind: 'legs',
    outbound: legSnapshot(outbound, outbound.price),
    inbound: inbound ? legSnapshot(inbound, inbound.price) : null,
    price: outbound.price + (inbound?.price ?? 0),
    gate: null,
    seenAt: null,
  }
}

export type MonthSelection = {
  /** True when the picked flights make a whole trip with a price. */
  complete: boolean
  /** Flights total, null until complete. A flight is never counted twice. */
  total: number | null
  /** The return flight to show. For one round-trip fare this is the fare's own return (no price of its own). */
  backLeg: Leg | null
  /** The return is part of the outbound fare (one round-trip price for both flights). */
  backIncluded: boolean
  /** Plain-language reason the picked flights cannot be added up, if there is one. */
  problem: string | null
  /** The outbound flight the total is made of: the fare picked, or (a flight back priced on its own) the one-way fare that
   * stands in for a round-trip fare, which already pays for its own way back. null until an outbound is picked. */
  outFare: Fare | null
}

/** The one-way ticket for the outbound of a trip that comes back on a ticket of its own (for example to another airport):
 * the picked fare when it is one-way, otherwise the cheapest cached one-way fare from the same airport on the same day
 * among the day's flights. null when none is cached: a round-trip fare's price can not be reused, it also pays for the way back. */
export function oneWayOutbound(selected: Fare | null, dayFares: Fare[]): Fare | null {
  if (!selected) return null
  if (!selected.inbound) return selected
  const { origin, date } = selected.outbound
  return dayFares.reduce<Fare | null>(
    (cheapest, f) => (!f.inbound && f.outbound.origin === origin && f.outbound.date === date && (!cheapest || f.price < cheapest.price) ? f : cheapest),
    null
  )
}

/** What the flights picked in Whole Month cost together. A round-trip fare is ONE price that already pays
 * for its return flight, so it is never added to a return price; two prices are only added when both
 * flights are one-way fares.
 * `oneWayOut` (only passed with the switch "Fly back to a different airport" ON): the flights back then come from a list
 * of one-way tickets for every home airport, so a picked flight back is always its own ticket, added to the one-way outbound
 * (`oneWayOut`, see oneWayOutbound) -- or explained when no one-way outbound is cached. */
export function monthSelection(out: Fare | null, back: Fare | null, oneWay: boolean, backDate: string | null, oneWayOut?: Fare | null): MonthSelection {
  const none: MonthSelection = { complete: false, total: null, backLeg: null, backIncluded: false, problem: null, outFare: out }
  if (!out) return none
  if (oneWay) return { ...none, complete: true, total: out.price }

  if (oneWayOut !== undefined && back && !back.inbound && out.inbound) {
    if (!oneWayOut) {
      return {
        ...none,
        problem: `No one-way flight out from ${out.outbound.origin} on ${out.outbound.date} is cached, so a flight back to ${back.outbound.destination} can not be added to it. A round-trip fare already pays for its own way back. Pick another outbound day or flight.`,
      }
    }
    return { complete: true, total: oneWayOut.price + back.price, backLeg: back.outbound, backIncluded: false, problem: null, outFare: oneWayOut }
  }

  if (out.inbound) {
    if (backDate && backDate !== out.inbound.date) {
      return {
        ...none,
        problem: `This outbound fare is a round trip that already includes the way back on ${out.inbound.date}. To come back on ${backDate} instead, pick a one-way outbound flight.`,
      }
    }
    return { complete: true, total: out.price, backLeg: out.inbound, backIncluded: true, problem: null, outFare: out }
  }

  if (!back) return none
  if (back.inbound) {
    return {
      ...none,
      problem: `The only cached fare for the return day is a round trip starting at the destination, not the price of one flight. Pick a one-way return flight, or choose a round-trip outbound fare.`,
    }
  }
  return { complete: true, total: out.price + back.price, backLeg: back.outbound, backIncluded: false, problem: null, outFare: out }
}
