// The flight data the screens use, in one place. Prices come from the price store (Supabase, filled nightly from the
// Travelpayouts price service, see lib/priceSource and lib/tpV3); the live price service is only the fallback when the
// store has nothing fresh. The older endpoints (/v1/prices/cheap, /v2/prices/latest, /v1/prices/calendar) are kept at
// the bottom for the read-only debug checks.
//
// Important: a fare that has a return date is a ROUND-TRIP fare -- one price for both flights. The data never splits it
// into a price per leg. A ticket's `found_at` is when this site got it from the price service ("price seen X h ago").

import { getAirlineNames } from './airlines'
import { tpFetch } from './lib/travelpayouts'
import { coveredMonths, overviewTickets, routePairTickets, routeMonthTickets } from './lib/priceSource'
import type { StoreTicket } from './lib/priceStore'
import { buildBookingLink } from './aviasalesLink'
import { MAX_PRICE_AGE_MS, parseTime } from './lib/priceAge'
import { dayOfWeek } from './weekdays'
import { nightsBetweenDates } from './lib/format'
import type { Fare, Leg } from './tripTypes'

export type Flight = {
  origin: string
  destination: string
  price: number
  departureDate: string // YYYY-MM-DD
  departureTime: string | null // HH:MM if known, else null (v2 has no time)
  returnDate: string | null
  returnTime: string | null // HH:MM of the return flight if the source has it
  stops: number | null // null = unknown
  airlineCode: string | null
  airlineName: string | null
  gate: string | null // booking site that found this fare (v2 only), for context only
  bookingUrl: string
  /** When the price was seen by a traveller (v2 `found_at`), ISO text. null = the data has no such time. */
  foundAt: string | null
  /** When the cached price stops being valid (v1 `expires_at`), ISO text. null = not in the data. */
  expiresAt: string | null
  /** The price service's deep link to this exact ticket (a path), when it gave one. */
  link?: string | null
}

export type CheapEntry = {
  price?: number
  airline?: string
  departure_at?: string
  return_at?: string | null
  expires_at?: string | null
}

type LatestEntry = {
  value?: number
  depart_date?: string
  return_date?: string | null
  gate?: string
  number_of_changes?: number
  found_at?: string | null
  duration?: number
  distance?: number
}

/** A COPY row of the "latest prices" list, not a real fare: a price repeated on neighbouring days, with no booking site
 * (`gate` empty) and a flight duration and distance of 0 (seen in real answers, e.g. BTS-ROM, 22 Oct: value 55 four times
 * for 1 Nov). Only rows that say all three things explicitly are dropped, so a real fare is never removed by mistake. */
export function isCopyRow(entry: { gate?: unknown; duration?: unknown; distance?: unknown }): boolean {
  return (entry.gate === '' || entry.gate === null) && entry.duration === 0 && entry.distance === 0
}

type CalendarEntry = {
  price?: number
  airline?: string
  departure_at?: string
  return_at?: string | null
  transfers?: number
  expires_at?: string | null
}

/** One cached fare for a departure day, as the calendar endpoint lists it. */
export type CalendarDayDetail = {
  price: number
  airlineCode: string | null
  time: string | null
  stops: number | null
  returnDate: string | null
  returnTime: string | null
  /** When this cached price stops being valid (v1 `expires_at`), ISO text, or null. */
  expiresAt: string | null
  /** When the price was seen (only the one-way list has it), ISO text, or null. */
  foundAt: string | null
}

// Prices are cached data anyway; re-using each answer for an hour keeps us far
// away from the API limits when the same search is opened again or shared.
const REVALIDATE = { next: { revalidate: 3600 } }


/** False for a price that has expired (`expires_at` in the past) or was seen too long ago (`found_at`). A
 * price with neither time is kept: it is shown as "age not in the data", never guessed to be fresh or old. */
export function isFreshPrice(entry: { foundAt?: string | null; expiresAt?: string | null }, now = Date.now()): boolean {
  const expires = parseTime(entry.expiresAt)
  if (expires !== null && expires < now) return false
  const found = parseTime(entry.foundAt)
  if (found !== null && now - found > MAX_PRICE_AGE_MS) return false
  return true
}

/** Every request asks for euro. If an answer says it is in another currency anyway, it is thrown away:
 * a dollar price must never be shown with a euro sign. (An answer that does not name a currency is kept.) */
export function currencyIsEuro(json: { currency?: unknown } | null | undefined): boolean {
  return typeof json?.currency !== 'string' || json.currency.toLowerCase() === 'eur'
}

function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.split('T')[0]
}

function timeOnly(iso: string | null | undefined): string | null {
  if (!iso || !iso.includes('T')) return null
  const match = iso.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : null
}


async function fetchLatest(
  origin: string,
  destination: string,
  token: string | undefined,
  options: { minDuration?: number; maxDuration?: number; oneWay?: boolean } = {}
): Promise<LatestEntry[]> {
  try {
    let url = `https://api.travelpayouts.com/v2/prices/latest?currency=eur&origin=${origin}&destination=${destination}&sorting=price&limit=1000`
    if (options.minDuration !== undefined) url += `&min_trip_duration=${options.minDuration}`
    if (options.maxDuration !== undefined) url += `&max_trip_duration=${options.maxDuration}`
    if (options.oneWay) url += `&one_way=true`
    const res = await tpFetch(url, token, REVALIDATE)
    if (!res.ok) return []
    const json = await res.json()
    if (!currencyIsEuro(json)) return []
    return Array.isArray(json.data) ? (json.data as LatestEntry[]) : []
  } catch {
    return []
  }
}

/** Turns a /v1/prices/cheap-style entry (also the shape /v1/city-directions
 * uses) into a Flight; null when it has no price or departure. */
export function normalizeFromCheap(entry: CheapEntry, origin: string, destination: string): Flight | null {
  if (typeof entry?.price !== 'number') return null
  const depDate = dateOnly(entry.departure_at)
  if (!depDate) return null
  if (!isFreshPrice({ expiresAt: entry.expires_at })) return null
  const returnDate = dateOnly(entry.return_at)
  return {
    origin,
    destination,
    price: entry.price,
    departureDate: depDate,
    departureTime: timeOnly(entry.departure_at),
    returnDate,
    returnTime: timeOnly(entry.return_at),
    stops: null,
    airlineCode: entry.airline || null,
    airlineName: null, // resolved later, batched
    gate: null,
    bookingUrl: buildBookingLink(origin, destination, depDate, returnDate || undefined),
    foundAt: null,
    expiresAt: entry.expires_at || null,
  }
}

function normalizeFromLatest(entry: LatestEntry, origin: string, destination: string): Flight | null {
  if (typeof entry?.value !== 'number' || !entry?.depart_date) return null
  if (isCopyRow(entry)) return null
  if (!isFreshPrice({ foundAt: entry.found_at })) return null
  return {
    origin,
    destination,
    price: entry.value,
    departureDate: entry.depart_date,
    departureTime: null, // v2 doesn't give a time of day
    returnDate: entry.return_date || null,
    returnTime: null,
    stops: typeof entry.number_of_changes === 'number' ? entry.number_of_changes : null,
    airlineCode: null, // v2 doesn't give an airline
    airlineName: null,
    gate: entry.gate || null,
    bookingUrl: buildBookingLink(origin, destination, entry.depart_date, entry.return_date || undefined),
    foundAt: entry.found_at || null,
    expiresAt: null,
  }
}

function dedupeKey(f: Flight): string {
  return `${f.origin}|${f.departureDate}|${Math.round(f.price)}`
}

/** Higher = better one to keep when several entries collapse into one. */
function keepScore(f: Flight, preferredReturn: string | null | undefined): number {
  let score = 0
  if (preferredReturn && f.returnDate === preferredReturn) score += 8
  if (f.airlineCode) score += 4
  if (f.departureTime) score += 2
  if (f.gate) score += 1
  if (f.foundAt || f.expiresAt) score += 1 // same price: keep the copy that says how fresh it is
  return score
}

/** Collapses near-duplicate entries (same origin/day/price) into one,
 * preferring the one that matches the requested return day, then the one with
 * real gate/airline/time info. */
function dedupe(flights: Flight[], preferredReturn?: string | null): Flight[] {
  const byKey = new Map<string, Flight>()
  for (const f of flights) {
    const key = dedupeKey(f)
    const existing = byKey.get(key)
    if (!existing || keepScore(f, preferredReturn) > keepScore(existing, preferredReturn)) {
      byKey.set(key, f)
    }
  }
  return Array.from(byKey.values())
}

async function resolveAirlineNames(flights: Flight[]): Promise<Flight[]> {
  const codes = flights.map((f) => f.airlineCode)
  const names = await getAirlineNames(codes)
  return flights.map((f) =>
    f.airlineCode ? { ...f, airlineName: names.get(f.airlineCode) || null } : f
  )
}

/** DEBUG ONLY (the read-only month check): the old calendar endpoint's cheapest fare for every departure day of a month,
 * with airline / times / return day where the cache has them. The screens read the price store instead. */
export async function fetchMonthCalendarDetailed(
  origin: string,
  destination: string,
  month: string,
  token: string | undefined
): Promise<Record<string, CalendarDayDetail>> {
  try {
    const url = `https://api.travelpayouts.com/v1/prices/calendar?origin=${origin}&destination=${destination}&depart_date=${month}&calendar_type=departure_date&currency=eur`
    const res = await tpFetch(url, token, REVALIDATE)
    if (!res.ok) return {}
    const json = await res.json()
    if (!currencyIsEuro(json)) return {}
    const data: Record<string, CalendarEntry> = json.data || {}

    const result: Record<string, CalendarDayDetail> = {}
    for (const [date, entry] of Object.entries(data)) {
      // Only the days of the month that was asked for: the answer is not trusted to stay inside it (a day of the
      // month before or after must never count as a day of this month).
      if (!date.startsWith(month)) continue
      // A calendar entry whose own departure day is not the day it is listed under is not that day's fare: dropped.
      if (entry?.departure_at && dateOnly(entry.departure_at) !== date) continue
      if (typeof entry?.price !== 'number') continue
      if (!isFreshPrice({ expiresAt: entry.expires_at })) continue
      result[date] = {
        price: entry.price,
        airlineCode: entry.airline || null,
        time: timeOnly(entry.departure_at),
        stops: typeof entry.transfers === 'number' ? entry.transfers : null,
        returnDate: dateOnly(entry.return_at),
        returnTime: timeOnly(entry.return_at),
        expiresAt: entry.expires_at || null,
        foundAt: null,
      }
    }
    return result
  } catch {
    return {}
  }
}


/** Fills in the airline names of just these flights (a winning fare). Tickets already carry airline and time. */
export async function completeFlights(flights: Flight[]): Promise<Flight[]> {
  return resolveAirlineNames(flights)
}

async function finish(flights: Flight[], preferredReturn?: string | null): Promise<Flight[]> {
  const merged = dedupe(flights, preferredReturn).sort((a, b) => a.price - b.price)
  const withAirlines = await resolveAirlineNames(merged)
  return withAirlines.sort((a, b) => a.price - b.price)
}

/** A stored ticket as a Flight (the shape the lists and pages use). The booking link opens this exact ticket when the
 * price service gave a deep link. */
export function ticketToFlight(t: StoreTicket): Flight {
  return {
    origin: t.origin,
    destination: t.destination,
    price: t.price,
    departureDate: t.departure_date,
    departureTime: timeOnly(t.departure_at),
    returnDate: t.return_date,
    returnTime: timeOnly(t.return_at),
    stops: t.transfers,
    airlineCode: t.airline,
    airlineName: null,
    gate: t.gate,
    bookingUrl: buildBookingLink(t.origin, t.destination, t.departure_date, t.return_date ?? undefined, t.link ?? undefined),
    foundAt: t.found_at,
    expiresAt: null,
    link: t.link,
  }
}

/** A stored ticket as one calendar day. */
export function ticketToDayDetail(t: StoreTicket): CalendarDayDetail {
  return {
    price: t.price,
    airlineCode: t.airline,
    time: timeOnly(t.departure_at),
    stops: t.transfers,
    returnDate: t.return_date,
    returnTime: timeOnly(t.return_at),
    expiresAt: null,
    foundAt: t.found_at,
  }
}

/** The cached flights of one route on one day, cheapest first: the cheapest one-way ticket of the day (`oneWay`), or every
 * round-trip ticket leaving that day (one per return day). `returnDate` (round trips) only decides which near-identical
 * copy is kept. `enrich` is accepted for older callers and ignored: tickets already carry airline and time. */
export async function getDayFlights(
  origin: string,
  destination: string,
  date: string,
  token: string | undefined,
  options: { oneWay?: boolean; returnDate?: string | null; enrich?: boolean } = {}
): Promise<Flight[]> {
  const byOrigin = await getDayFlightsFrom([origin], destination, date, token, options)
  return byOrigin[origin] ?? []
}

/** The same for several home airports at once (one store read): the flights of each airport, by airport. `direction`
 * "back" = flights from the city to each airport (the airport is still the key). */
export async function getDayFlightsFrom(
  origins: string[],
  destination: string,
  date: string,
  token: string | undefined,
  options: { oneWay?: boolean; returnDate?: string | null; enrich?: boolean; direction?: 'out' | 'back' } = {}
): Promise<Record<string, Flight[]>> {
  const back = options.direction === 'back'
  const pairs = origins.map((o) => (back ? { origin: destination, destination: o } : { origin: o, destination }))
  const tickets = await routePairTickets(pairs, date.slice(0, 7), !!options.oneWay, token)
  const flights = await finish(tickets.filter((t) => t.departure_date === date).map(ticketToFlight), options.returnDate)
  const result: Record<string, Flight[]> = Object.fromEntries(origins.map((o) => [o, []]))
  for (const f of flights) result[back ? f.destination : f.origin]?.push(f)
  return result
}

/** The cached flights of one route within a date range (date-range search): every ticket leaving in the range; round trips
 * only with `minDays` to `maxDays` nights. At most 4 months are looked at. */
export async function getRangeFlights(
  origin: string,
  destination: string,
  rangeStart: string | undefined,
  rangeEnd: string | undefined,
  minDays: number,
  maxDays: number,
  token: string | undefined,
  options: { enrich?: boolean; oneWay?: boolean } = {}
): Promise<Flight[]> {
  const byOrigin = await getRangeFlightsFrom([origin], destination, rangeStart, rangeEnd, minDays, maxDays, token, options)
  return byOrigin[origin] ?? []
}

/** The same for several home airports at once (one store read per month): the flights of each airport, by airport. */
export async function getRangeFlightsFrom(
  origins: string[],
  destination: string,
  rangeStart: string | undefined,
  rangeEnd: string | undefined,
  minDays: number,
  maxDays: number,
  token: string | undefined,
  options: { enrich?: boolean; oneWay?: boolean } = {}
): Promise<Record<string, Flight[]>> {
  const covered = coveredMonths()
  const months = monthsBetween(rangeStart ?? `${covered[0]}-01`, rangeEnd ?? `${covered[covered.length - 1]}-28`)
  const oneWay = !!options.oneWay
  const pairs = origins.map((o) => ({ origin: o, destination }))
  const perMonth = await Promise.all(months.map((m) => routePairTickets(pairs, m, oneWay, token)))
  const flights = await finish(
    perMonth
      .flat()
      .filter((t) => {
        if (rangeStart && t.departure_date < rangeStart) return false
        if (rangeEnd && t.departure_date > rangeEnd) return false
        if (!oneWay && t.return_date) {
          const nights = nightsBetweenDates(t.departure_date, t.return_date)
          if (nights < minDays || nights > maxDays) return false
        }
        return true
      })
      .map(ticketToFlight)
  )
  const result: Record<string, Flight[]> = Object.fromEntries(origins.map((o) => [o, []]))
  for (const f of flights) result[f.origin]?.push(f)
  return result
}

/** The cheapest cached ROUND-TRIP ticket of one route for a day, a month (YYYY-MM) or any covered month; null when none. */
export async function getCheapestLeg(
  origin: string,
  destination: string,
  date: string | undefined,
  token: string | undefined
): Promise<Flight | null> {
  const months = date ? [date.slice(0, 7)] : coveredMonths()
  const perMonth = await Promise.all(months.map((m) => routePairTickets([{ origin, destination }], m, false, token)))
  const tickets = perMonth.flat().filter((t) => !date || date.length !== 10 || t.departure_date === date)
  if (tickets.length === 0) return null
  const cheapest = tickets.reduce((min, t) => (t.price < min.price ? t : min))
  const [named] = await resolveAirlineNames([ticketToFlight(cheapest)])
  return named
}

/** The cheapest cached ONE-WAY ticket of one route for a day (YYYY-MM-DD), a month (YYYY-MM) or any covered month: used
 * where a flight is priced on its own and added to another. null = no cached one-way price. */
export async function getCheapestOneWayLeg(
  origin: string,
  destination: string,
  dateOrMonth: string | undefined,
  token: string | undefined
): Promise<Flight | null> {
  const months = dateOrMonth ? [dateOrMonth.slice(0, 7)] : coveredMonths()
  const perMonth = await Promise.all(months.map((m) => routePairTickets([{ origin, destination }], m, true, token)))
  const tickets = perMonth.flat().filter((t) => !dateOrMonth || t.departure_date.startsWith(dateOrMonth))
  if (tickets.length === 0) return null
  const cheapest = tickets.reduce((min, t) => (t.price < min.price ? t : min))
  const [named] = await resolveAirlineNames([ticketToFlight(cheapest)])
  return named
}

/** Every cached ONE-WAY ticket of one route for the given months (YYYY-MM; the covered months when none are given). */
export async function getOneWayFares(origin: string, destination: string, token: string | undefined, months: string[] = []): Promise<Flight[]> {
  const list = months.length > 0 ? months : coveredMonths()
  const perMonth = await Promise.all(list.map((m) => routePairTickets([{ origin, destination }], m, true, token)))
  return perMonth.flat().map(ticketToFlight)
}

/** The months (YYYY-MM) from one day to another, inclusive (at most 4, so a wide range cannot cause a flood of requests). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  const [ty, tm] = to.slice(0, 7).split('-').map(Number)
  while ((y < ty || (y === ty && m <= tm)) && out.length < 4) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

function addDaysTo(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

export type OpenJawFilter = {
  /** Earliest and latest DEPARTURE day (YYYY-MM-DD), inclusive. */
  outFrom: string
  outTo: string
  /** Allowed nights between the two flights. */
  minNights: number
  maxNights: number
  /** Only this return day, when the traveller named one. */
  backDate?: string | null
  /** Earliest and latest RETURN day, when the search names a return month. */
  backFrom?: string | null
  backTo?: string | null
  outDays: number[]
  backDays: number[]
}

export type OpenJawPair = { out: Flight; back: Flight; total: number }

/** Trips that leave from one of the home airports and come back to a DIFFERENT one: a one-way fare out plus a
 * one-way fare back, each at its own cached price, added together (two separate tickets). Only one-way fares are
 * used: a fare with a return date already pays for two flights and would be counted twice. Cheapest first. */
export async function findOpenJawPairs(
  origins: string[],
  /** The airports the traveller may come back to (their own airports plus all home airports). */
  returnTo: string[],
  destination: string,
  token: string | undefined,
  filter: OpenJawFilter,
  limit = 30
): Promise<{ pairs: OpenJawPair[]; outCount: number; backCount: number }> {
  const outMonths = monthsBetween(filter.outFrom, filter.outTo)
  const backMonths = monthsBetween(filter.backFrom ?? addDaysTo(filter.outFrom, 1), filter.backTo ?? filter.backDate ?? addDaysTo(filter.outTo, filter.maxNights))
  // One store read per month for all the airports out, and one for all the airports back.
  const [outLists, backLists] = await Promise.all([
    Promise.all(outMonths.map((m) => routePairTickets(origins.map((o) => ({ origin: o, destination })), m, true, token))),
    Promise.all(backMonths.map((m) => routePairTickets(returnTo.map((o) => ({ origin: destination, destination: o })), m, true, token))),
  ])
  const outs = outLists.flat().map(ticketToFlight).filter((f) => f.departureDate >= filter.outFrom && f.departureDate <= filter.outTo && filter.outDays.includes(dayOfWeek(f.departureDate)))
  const backs = backLists
    .flat()
    .map(ticketToFlight)
    .filter(
      (f) =>
        filter.backDays.includes(dayOfWeek(f.departureDate)) &&
        (!filter.backDate || f.departureDate === filter.backDate) &&
        (!filter.backFrom || f.departureDate >= filter.backFrom) &&
        (!filter.backTo || f.departureDate <= filter.backTo)
    )

  const pairs: OpenJawPair[] = []
  for (const out of outs) {
    for (const back of backs) {
      if (back.destination === out.origin) continue // same airport: an ordinary round trip, listed on its own
      if (back.departureDate <= out.departureDate) continue
      const nights = nightsBetweenDates(out.departureDate, back.departureDate)
      if (nights < filter.minNights || nights > filter.maxNights) continue
      pairs.push({ out, back, total: out.price + back.price })
    }
  }
  pairs.sort((a, b) => a.total - b.total)

  // The same two flights can come from two list entries: keep each flight pair once.
  const seen = new Set<string>()
  const top: OpenJawPair[] = []
  for (const pair of pairs) {
    const key = `${pair.out.origin}|${pair.out.departureDate}|${pair.out.price}|${pair.back.destination}|${pair.back.departureDate}|${pair.back.price}`
    if (seen.has(key)) continue
    seen.add(key)
    top.push(pair)
    if (top.length >= limit) break
  }
  return { pairs: top, outCount: outs.length, backCount: backs.length }
}

/** DEBUG ONLY (the read-only month check): one-way prices for the days of a month from the old endpoints, the calendar's
 * entries that have no return date plus the one-way list (v2 `one_way=true`), the cheapest per day. */
export async function fetchMonthOneWayDays(
  origin: string,
  destination: string,
  month: string,
  token: string | undefined
): Promise<Record<string, CalendarDayDetail>> {
  const [calendar, latest] = await Promise.all([
    fetchMonthCalendarDetailed(origin, destination, month, token),
    fetchLatest(origin, destination, token, { oneWay: true }),
  ])
  const days: Record<string, CalendarDayDetail> = {}
  for (const [date, day] of Object.entries(calendar)) if (day.returnDate === null) days[date] = day
  for (const entry of latest) {
    if (!(entry.depart_date || '').startsWith(month)) continue
    const f = normalizeFromLatest(entry, origin, destination)
    if (!f || f.returnDate !== null) continue
    const existing = days[f.departureDate]
    if (existing && existing.price <= f.price) continue
    days[f.departureDate] = {
      price: f.price,
      airlineCode: null,
      time: null,
      stops: f.stops,
      returnDate: null,
      returnTime: null,
      expiresAt: null,
      foundAt: f.foundAt,
    }
  }
  return days
}

/** The month calendars of ONE direction for several home airports: one entry per airport, each holding that airport's days
 * (the cheapest ticket per day: one-way tickets when `oneWay`, else round-trip tickets with their return day). The city page
 * (`/api/calendar`) and the Anywhere check both read their days through this, from the price store, so they agree.
 * `leg` "outbound" = from the airport to the city, "inbound" = from the city back to the airport. */
export async function getMonthDaysByOrigin(
  origins: string[],
  city: string,
  month: string,
  leg: 'outbound' | 'inbound',
  oneWay: boolean,
  token: string | undefined
): Promise<Record<string, Record<string, CalendarDayDetail>>> {
  const tickets = await routeMonthTickets(origins, city, month, oneWay, token, leg === 'inbound' ? 'back' : 'out')
  const result: Record<string, Record<string, CalendarDayDetail>> = Object.fromEntries(origins.map((o) => [o, {}]))
  for (const t of tickets) {
    const home = leg === 'inbound' ? t.destination : t.origin
    const days = result[home]
    if (!days) continue
    const have = days[t.departure_date]
    if (!have || t.price < have.price) days[t.departure_date] = ticketToDayDetail(t)
  }
  return result
}

/** For every day the cheapest fare among the airports, which is what the calendar of a city page shows. `origin` is the
 * home airport the fare belongs to; equal prices keep the airport listed first. */
export function cheapestPerDay(byOrigin: Record<string, Record<string, CalendarDayDetail>>): Record<string, CalendarDayDetail & { origin: string }> {
  const result: Record<string, CalendarDayDetail & { origin: string }> = {}
  for (const [origin, days] of Object.entries(byOrigin)) {
    for (const [date, entry] of Object.entries(days)) {
      if (!result[date] || entry.price < result[date].price) result[date] = { ...entry, origin }
    }
  }
  return result
}

/** The single cheapest cached fare to a destination from several home airports in the covered months (round trips first,
 * one-way tickets only when no round trip is known), or null when none is cached. Read from the month summaries. */
export async function getCheapestFare(
  origins: string[],
  destination: string,
  token: string | undefined
): Promise<Fare | null> {
  const months = coveredMonths()
  for (const oneWay of [false, true]) {
    const perMonth = await Promise.all(months.map((m) => overviewTickets(origins, m, oneWay, token)))
    const candidates = perMonth.flat().filter((t) => t.destination === destination)
    if (candidates.length === 0) continue
    const cheapest = candidates.reduce((min, t) => (t.price < min.price ? t : min))
    const [named] = await resolveAirlineNames([ticketToFlight(cheapest)])
    return flightToFare(named)
  }
  return null
}

/** One cached flight as a leg (date, time, airline, stops, booking link). */
export function flightToLeg(f: Flight): Leg {
  return {
    origin: f.origin,
    destination: f.destination,
    date: f.departureDate,
    time: f.departureTime,
    airlineCode: f.airlineCode,
    airlineName: f.airlineName,
    stops: f.stops,
    bookingUrl: buildBookingLink(f.origin, f.destination, f.departureDate),
  }
}

/** Turns one cached flight into the shape the pages use: an outbound leg and,
 * for a round-trip fare, a return leg. The fare's single price is NOT split
 * between the legs. */
export function flightToFare(f: Flight, requestedReturnDate?: string | null): Fare {
  const outbound: Leg = {
    origin: f.origin,
    destination: f.destination,
    date: f.departureDate,
    time: f.departureTime,
    airlineCode: f.airlineCode,
    airlineName: f.airlineName,
    stops: f.stops,
    bookingUrl: buildBookingLink(f.origin, f.destination, f.departureDate),
  }

  // The fare data lists one carrier for the whole ticket, so the return leg
  // shows that same carrier. Stops are only claimed for the outbound leg.
  const inbound: Leg | null = f.returnDate
    ? {
        origin: f.destination,
        destination: f.origin,
        date: f.returnDate,
        time: f.returnTime,
        airlineCode: f.airlineCode,
        airlineName: f.airlineName,
        stops: null,
        bookingUrl: buildBookingLink(f.destination, f.origin, f.returnDate),
      }
    : null

  return {
    id: `${f.origin}|${f.destination}|${f.departureDate}|${f.returnDate ?? ''}|${f.price}`,
    price: f.price,
    kind: inbound ? 'round-trip' : 'one-way',
    outbound,
    inbound,
    gate: f.gate,
    bookingUrl: f.bookingUrl,
    returnMatchesRequest: requestedReturnDate ? f.returnDate === requestedReturnDate : null,
    seenAt: f.foundAt,
  }
}

/** Cheapest first: the cached ONE-WAY fares from one place back to each of the given airports, for a day or a range of days.
 * Used by "Find a flight back". Only fares dated from `after` on, never expired or stale. Airline names are filled in
 * where the data has an airline code. Each airport is looked at on its own (one-way list + the calendar months of the window). */
export async function getReturnFares(
  from: string,
  toAirports: string[],
  token: string | undefined,
  window: { start: string; end: string; after?: string | null },
  limit = 60
): Promise<{ fares: Flight[]; total: number }> {
  const months = monthsBetween(window.start, window.end)
  const airports = toAirports.filter((a) => a !== from)
  // One store read per month for all the airports.
  const perMonth = await Promise.all(months.map((m) => routePairTickets(airports.map((a) => ({ origin: from, destination: a })), m, true, token)))
  const flights = perMonth.flat().map(ticketToFlight)
  // Keep each airport/day/price once (dedupe expects one airport per list).
  const unique = airports
    .flatMap((a) =>
      dedupe(flights.filter((f) => f.destination === a && f.departureDate >= window.start && f.departureDate <= window.end && (!window.after || f.departureDate >= window.after)))
    )
    .sort((a, b) => a.price - b.price || a.departureDate.localeCompare(b.departureDate))
  const top = await resolveAirlineNames(unique.slice(0, limit))
  return { fares: top, total: unique.length }
}
