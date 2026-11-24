// What a route page (/flights/bratislava-milan) says about one route, worked out from the price store alone.
//
// STORE ONLY, no live fallback: 47 route pages times four months times two kinds would mean hundreds of requests to the
// price service whenever the pages are rebuilt, and these pages are read by search engines rather than by someone waiting
// for a fresh quote. Every price therefore carries its real age (`seenAt` -> the "price seen 6 h ago" line), and the page
// says plainly when the store has nothing for a part of it. Nothing here guesses: a figure the data does not give is null
// and the page leaves that part out.
// Server code only.

import { readRouteTickets, type StoreTicket } from './priceStore'
import { coveredMonths } from './priceSource'
import { getAirlineNames } from '../airlines'
import { dayOfWeek } from '../weekdays'

export type RouteFare = {
  price: number
  departureDate: string
  /** Local departure time as the price service gives it, or null. */
  departureAt: string
  returnDate: string | null
  oneWay: boolean
  airlineCode: string | null
  airlineName: string | null
  transfers: number | null
  /** Minutes, as the price service gives it (checked against real direct flights: VIE-MIL is 80-85). */
  duration: number | null
  bookingSite: string | null
  link: string | null
  seenAt: string
}

export type MonthPrice = {
  month: string
  roundTrip: RouteFare | null
  oneWay: RouteFare | null
}

export type AirlineOnRoute = {
  code: string
  name: string | null
  /** The cheapest one-way ticket this airline has on the route. */
  cheapestOneWay: number | null
  /** The cheapest round-trip ticket this airline has on the route. */
  cheapestRoundTrip: number | null
  /** True when at least one of this airline's stored tickets on the route has no stops. */
  fliesDirect: boolean
  tickets: number
}

export type WeekdayPrice = {
  /** 0 = Sunday ... 6 = Saturday, like Date.getDay(). */
  day: number
  cheapest: number
  /** How many stored departure days of this weekday the figure comes from. */
  days: number
}

export type DirectFacts = {
  /** Whether the store holds a no-stop ticket on this route. null = the data never says how many stops. */
  hasDirect: boolean | null
  cheapestDirect: number | null
  cheapestWithStops: number | null
  /** Shortest and usual flight time of a no-stop one-way ticket, in minutes. */
  shortestDirectMinutes: number | null
  typicalDirectMinutes: number | null
}

export type RouteFacts = {
  months: string[]
  tickets: number
  cheapestRoundTrip: RouteFare | null
  cheapestOneWay: RouteFare | null
  byMonth: MonthPrice[]
  /** The cheapest round-trip price per departure day, for the calendar. */
  roundTripByDay: Record<string, number>
  /** The cheapest one-way price per departure day. */
  oneWayByDay: Record<string, number>
  airlines: AirlineOnRoute[]
  weekdays: WeekdayPrice[]
  direct: DirectFacts
  /** The newest and oldest "seen" time over all the tickets the page uses. */
  newestSeenAt: string | null
  oldestSeenAt: string | null
}

function toFare(t: StoreTicket, names: Map<string, string>): RouteFare {
  return {
    price: t.price,
    departureDate: t.departure_date,
    departureAt: t.departure_at,
    returnDate: t.return_date,
    oneWay: t.one_way,
    airlineCode: t.airline,
    airlineName: t.airline ? names.get(t.airline) ?? null : null,
    transfers: t.transfers,
    duration: t.duration,
    bookingSite: t.gate,
    link: t.link,
    seenAt: t.found_at,
  }
}

/** The cheapest of a list; the earliest departure wins a tie, so the same ticket is shown every time. */
function cheapest(tickets: StoreTicket[]): StoreTicket | null {
  let best: StoreTicket | null = null
  for (const t of tickets) {
    if (!best || t.price < best.price || (t.price === best.price && t.departure_date < best.departure_date)) best = t
  }
  return best
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = xs.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** The cheapest price per departure day. */
function cheapestByDay(tickets: StoreTicket[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of tickets) {
    const have = out[t.departure_date]
    if (have === undefined || t.price < have) out[t.departure_date] = t.price
  }
  return out
}

function airlinesOf(tickets: StoreTicket[], names: Map<string, string>): AirlineOnRoute[] {
  const byCode = new Map<string, AirlineOnRoute>()
  for (const t of tickets) {
    if (!t.airline) continue
    const row = byCode.get(t.airline) ?? { code: t.airline, name: names.get(t.airline) ?? null, cheapestOneWay: null, cheapestRoundTrip: null, fliesDirect: false, tickets: 0 }
    row.tickets++
    if (t.transfers === 0) row.fliesDirect = true
    if (t.one_way) row.cheapestOneWay = row.cheapestOneWay === null ? t.price : Math.min(row.cheapestOneWay, t.price)
    else row.cheapestRoundTrip = row.cheapestRoundTrip === null ? t.price : Math.min(row.cheapestRoundTrip, t.price)
    byCode.set(t.airline, row)
  }
  // Cheapest one-way first (the figure most airlines on these routes have); airlines without one go last.
  return Array.from(byCode.values()).sort((a, b) => (a.cheapestOneWay ?? Infinity) - (b.cheapestOneWay ?? Infinity) || b.tickets - a.tickets)
}

/** The cheapest ONE-WAY ticket per weekday of departure: "flying out on a Tuesday is the cheapest". Round-trip tickets are
 * left out on purpose — their price belongs to a pair of days, so it says nothing about one weekday. */
function weekdaysOf(oneWay: StoreTicket[]): WeekdayPrice[] {
  const byDay = new Map<number, { cheapest: number; days: Set<string> }>()
  for (const t of oneWay) {
    const d = dayOfWeek(t.departure_date)
    const row = byDay.get(d) ?? { cheapest: t.price, days: new Set<string>() }
    row.cheapest = Math.min(row.cheapest, t.price)
    row.days.add(t.departure_date)
    byDay.set(d, row)
  }
  return Array.from(byDay.entries())
    .map(([day, r]) => ({ day, cheapest: r.cheapest, days: r.days.size }))
    .sort((a, b) => a.cheapest - b.cheapest || a.day - b.day)
}

function directOf(tickets: StoreTicket[]): DirectFacts {
  const knowsStops = tickets.filter((t) => t.transfers !== null)
  if (knowsStops.length === 0) {
    return { hasDirect: null, cheapestDirect: null, cheapestWithStops: null, shortestDirectMinutes: null, typicalDirectMinutes: null }
  }
  const direct = knowsStops.filter((t) => t.transfers === 0)
  const withStops = knowsStops.filter((t) => (t.transfers ?? 0) > 0)
  // Flight time is read from ONE-WAY no-stop tickets only: for a round-trip ticket the data does not say whether its
  // `duration` covers one leg or both, and a wrong flight time is worse than none.
  const directMinutes = direct.filter((t) => t.one_way && typeof t.duration === 'number' && t.duration > 0).map((t) => t.duration as number)
  return {
    hasDirect: direct.length > 0,
    cheapestDirect: direct.length ? (cheapest(direct) as StoreTicket).price : null,
    cheapestWithStops: withStops.length ? (cheapest(withStops) as StoreTicket).price : null,
    shortestDirectMinutes: directMinutes.length ? Math.min(...directMinutes) : null,
    typicalDirectMinutes: median(directMinutes),
  }
}

/** Everything a route page shows, from the store. Airline codes are turned into names here ("FR" -> "Ryanair"); a code the
 * reference data does not know keeps its code, it is never guessed at. */
export async function getRouteFacts(origin: string, destination: string, now = new Date()): Promise<RouteFacts> {
  const months = coveredMonths(now)
  const all = await readRouteTickets(origin, destination, months)
  // A day that has already departed must never be shown, even if the nightly clean-up has not run yet.
  const today = now.toISOString().slice(0, 10)
  const tickets = all.filter((t) => t.departure_date >= today)
  const oneWay = tickets.filter((t) => t.one_way)
  const roundTrip = tickets.filter((t) => !t.one_way)

  const seen = tickets.map((t) => t.found_at).filter(Boolean).sort()
  const names = await getAirlineNames(tickets.map((t) => t.airline))

  return {
    months,
    tickets: tickets.length,
    cheapestRoundTrip: roundTrip.length ? toFare(cheapest(roundTrip) as StoreTicket, names) : null,
    cheapestOneWay: oneWay.length ? toFare(cheapest(oneWay) as StoreTicket, names) : null,
    byMonth: months.map((month) => {
      const rt = roundTrip.filter((t) => t.month === month)
      const ow = oneWay.filter((t) => t.month === month)
      return {
        month,
        roundTrip: rt.length ? toFare(cheapest(rt) as StoreTicket, names) : null,
        oneWay: ow.length ? toFare(cheapest(ow) as StoreTicket, names) : null,
      }
    }),
    roundTripByDay: cheapestByDay(roundTrip),
    oneWayByDay: cheapestByDay(oneWay),
    airlines: airlinesOf(tickets, names),
    weekdays: weekdaysOf(oneWay),
    direct: directOf(tickets),
    newestSeenAt: seen.length ? seen[seen.length - 1] : null,
    oldestSeenAt: seen.length ? seen[0] : null,
  }
}

/** "1 h 25 min" from minutes. */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
