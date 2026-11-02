'use client'

// The month calendar of flights BACK from a destination to the home airports (BTS, VIE, BUD, KSC, PRG). Used by the page
// "Find a flight back" (the other airports than the one you left from) and by the Whole Month return calendar with the
// switch "Fly back to a different airport" (every home airport, with the difference to the airport you left from).
// One request per month (/api/return-flights): every day of the month, cheapest first. The calendar shows each day's
// cheapest fare; the others are listed when a day is tapped. Only ONE-WAY fares are used: a flight back is a ticket of
// its own, added to a one-way flight out.

import { useMemo } from 'react'
import { useJson } from './useJson'
import { lastDayOfMonth } from './format'
import { airportCity } from '../airportsList'
import type { CalendarDay, CalendarDayMap, Fare } from '../tripTypes'
import type { ReturnFlightsResponse } from '../api/return-flights/route'
import type { CalendarNote } from '../components/CalendarGrid'

/** How many of the cheapest fares a month asks for (the most the API gives): room for 5 airports x 31 days. */
const MONTH_LIMIT = 400

/** The request for one month of flights from `from` to these airports. Not filtered by day: the same answer serves every
 * outbound day, so choosing another outbound day does not ask for anything new. */
export function returnMonthUrl(from: string, airports: string[], month: string): string {
  return `/api/return-flights?${new URLSearchParams({
    from,
    mode: 'range',
    start: `${month}-01`,
    end: lastDayOfMonth(month),
    to: airports.join(','),
    limit: String(MONTH_LIMIT),
  })}`
}

/** Fares by day, each day cheapest first (equal prices: by airport code, so the order is always the same). */
export function groupByDate(fares: Fare[]): Record<string, Fare[]> {
  const byDate: Record<string, Fare[]> = {}
  for (const fare of fares) (byDate[fare.outbound.date] ??= []).push(fare)
  for (const list of Object.values(byDate)) list.sort((a, b) => a.price - b.price || a.outbound.destination.localeCompare(b.outbound.destination))
  return byDate
}

const NO_FARES: Fare[] = []

export function useReturnMonth({ enabled, from, airports, month }: { enabled: boolean; from: string; airports: string[]; month: string }) {
  const airportList = airports.join(',')
  const url = enabled && from && month && airportList ? returnMonthUrl(from, airportList.split(','), month) : null
  const { data, loading, error } = useJson<ReturnFlightsResponse>(url)
  const fares = data?.results ?? NO_FARES
  const byDate = useMemo(() => groupByDate(fares), [fares])
  return { byDate, loading, error, found: fares.length }
}

/** A flight back as a calendar day. `origin` is the airport you fly back TO (like the other inbound calendar). */
function dayOf(fare: Fare): CalendarDay {
  const leg = fare.outbound
  return {
    price: fare.price,
    origin: leg.destination,
    airlineCode: leg.airlineCode,
    airlineName: leg.airlineName,
    time: leg.time,
    stops: leg.stops,
    returnDate: null,
    returnTime: null,
    foundAt: fare.seenAt,
  }
}

export type ReturnCalendar = { days: CalendarDayMap; notes: Record<string, CalendarNote> }

/** The calendar of the cheapest flight back for each day (from `after` on), with the airport written under the price.
 * With `sameAirport` (the airport you left from) the note also says how much cheaper than flying back there the day's
 * cheapest flight is, e.g. "PRG −4". Days with no cached flight are simply not in the calendar. */
export function returnCalendar(byDate: Record<string, Fare[]>, options: { after?: string | null; sameAirport?: string | null } = {}): ReturnCalendar {
  const days: CalendarDayMap = {}
  const notes: Record<string, CalendarNote> = {}
  const { after, sameAirport } = options
  for (const [date, fares] of Object.entries(byDate)) {
    if ((after && date < after) || fares.length === 0) continue
    // On a tie the airport you left from is the one named (it is the "same airport" price, no difference to show).
    const best = (sameAirport && fares.find((f) => f.price === fares[0].price && f.outbound.destination === sameAirport)) || fares[0]
    const to = best.outbound.destination
    days[date] = dayOf(best)
    const place = airportCity(to)
    if (!sameAirport) {
      notes[date] = { text: to, spoken: `cheapest flight back goes to ${place}` }
      continue
    }
    const same = fares.find((f) => f.outbound.destination === sameAirport)
    if (to === sameAirport) {
      notes[date] = { text: to, spoken: `cheapest flight back goes to ${place}, the airport you left from` }
    } else if (same) {
      // `best` is the cheapest of the day and is not at the same airport, so it is cheaper than the same-airport flight.
      const cheaper = same.price - best.price
      notes[date] = {
        text: `${to} −${cheaper}`,
        spoken: `cheapest flight back goes to ${place}, €${cheaper} cheaper than flying back to ${airportCity(sameAirport)} (€${same.price})`,
      }
    } else {
      notes[date] = { text: to, spoken: `cheapest flight back goes to ${place}; no cached flight back to ${airportCity(sameAirport)} that day` }
    }
  }
  return { days, notes }
}
