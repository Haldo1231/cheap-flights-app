// Today's cheapest price for a saved search, read the SAME way the search screens read it (store first, live fallback, see
// lib/priceSource.ts). The price kept when a search is saved comes from this function too, so "then" and "now" are always the
// same kind of number. Round trip = ONE round-trip ticket (never two one-way prices added up); one way = a one-way ticket.

import { coveredMonths, routePairTickets } from '../priceSource'
import { getDayFlightsFrom, getRangeFlightsFrom } from '../../flightSources'
import type { SavedSearch } from './search'

export type PriceNow =
  | { kind: 'price'; price: number; seenAt: string | null }
  /** Nothing in the store (and nothing live) for this search today. */
  | { kind: 'none' }
  /** The departure date or month is over. */
  | { kind: 'past' }
  /** The price service could not be asked right now. */
  | { kind: 'error' }

const today = () => new Date().toISOString().slice(0, 10)

function cheapest(list: { price: number; seenAt: string | null }[]): PriceNow {
  if (list.length === 0) return { kind: 'none' }
  const best = list.reduce((min, f) => (f.price < min.price ? f : min))
  return { kind: 'price', price: best.price, seenAt: best.seenAt }
}

export async function priceNow(s: SavedSearch, token = process.env.TRAVELPAYOUTS_TOKEN): Promise<PriceNow> {
  const now = today()
  try {
    if (s.dateMode === 'exact') {
      if (!s.dateFrom || s.dateFrom < now) return { kind: 'past' }
      const byOrigin = await getDayFlightsFrom(s.origins, s.destination, s.dateFrom, token, { oneWay: s.oneWay, returnDate: s.dateTo })
      const flights = Object.values(byOrigin)
        .flat()
        // A round trip counts only with the saved return day.
        .filter((f) => (s.oneWay ? !f.returnDate : f.returnDate === s.dateTo))
      return cheapest(flights.map((f) => ({ price: f.price, seenAt: f.foundAt })))
    }

    if (s.dateMode === 'range') {
      if (!s.dateFrom || !s.dateTo || s.dateTo < now) return { kind: 'past' }
      const start = s.dateFrom < now ? now : s.dateFrom
      const byOrigin = await getRangeFlightsFrom(s.origins, s.destination, start, s.dateTo, s.minNights ?? 1, s.maxNights ?? 30, token, {
        oneWay: s.oneWay,
      })
      const flights = Object.values(byOrigin).flat().filter((f) => (s.oneWay ? !f.returnDate : !!f.returnDate))
      return cheapest(flights.map((f) => ({ price: f.price, seenAt: f.foundAt })))
    }

    // Whole month, or no date picked (every month the store covers).
    const covered = coveredMonths()
    let months: string[]
    let returnMonth: string | null = null
    if (s.dateMode === 'month') {
      const month = (s.dateFrom ?? '').slice(0, 7)
      if (month < now.slice(0, 7)) return { kind: 'past' }
      if (!covered.includes(month)) return { kind: 'none' }
      months = [month]
      returnMonth = s.oneWay ? null : (s.dateTo ?? s.dateFrom ?? '').slice(0, 7)
    } else {
      months = covered
    }
    const pairs = s.origins.map((origin) => ({ origin, destination: s.destination }))
    const perMonth = await Promise.all(months.map((m) => routePairTickets(pairs, m, s.oneWay, token)))
    const tickets = perMonth
      .flat()
      .filter((t) => t.departure_date >= now)
      .filter((t) => (s.oneWay ? !t.return_date : !!t.return_date && (!returnMonth || t.return_date.startsWith(returnMonth))))
    return cheapest(tickets.map((t) => ({ price: t.price, seenAt: t.found_at })))
  } catch (e) {
    console.error('[saved] price lookup failed', e instanceof Error ? e.message : e)
    return { kind: 'error' }
  }
}

