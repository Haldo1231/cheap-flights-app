// Client-safe helpers for turning cached data into the shapes the pages show.

import { buildBookingLink } from '../aviasalesLink'
import type { CalendarDay, Fare, Leg } from '../tripTypes'

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
