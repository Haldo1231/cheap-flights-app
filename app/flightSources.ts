// Shared logic for fetching real cached flight data from Travelpayouts and
// turning it into a clean, de-duplicated, honestly-labeled list.
//
// Three source endpoints, each with real limits we're upfront about:
// - /v1/prices/cheap: has a real airline code + exact departure AND return
//   time, but is very sparse for an exact date (often empty) and gives at most
//   ~1 cached fare per call.
// - /v2/prices/latest: much richer (can return many distinct cached fares),
//   but has NO airline info (only a "gate" = booking site that found the
//   price) and only day-level dates, no times. It also contains a lot of
//   near-duplicate filler entries (empty gate, 0 duration/distance, same price
//   repeated across many nearby return dates) which we collapse.
// - /v1/prices/calendar: one cached fare per departure day, WITH airline,
//   departure time and return date/time. We use it to fill in the airline and
//   times for a /v2 fare when it is clearly the very same fare (same day, same
//   return day, same price).
//
// Important: a fare that has a return date is a ROUND-TRIP fare -- one price
// for both flights. The data never splits it into a price per leg.

import { getAirlineNames } from './airlines'
import { buildBookingLink } from './aviasalesLink'
import { MAX_PRICE_AGE_MS, parseTime } from './lib/priceAge'
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

let warnedAboutToken = false
function warnIfNoToken(token: string | undefined) {
  if (!token && !warnedAboutToken) {
    warnedAboutToken = true
    console.warn('TRAVELPAYOUTS_TOKEN is not set: every price lookup will come back empty.')
  }
}

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

async function fetchCheapExact(
  origin: string,
  destination: string,
  date: string | undefined,
  token: string | undefined
): Promise<CheapEntry[]> {
  warnIfNoToken(token)
  try {
    let url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=eur&token=${token}`
    if (date) url += `&depart_date=${date}`
    const res = await fetch(url, REVALIDATE)
    if (!res.ok) return []
    const json = await res.json()
    if (!currencyIsEuro(json)) return []
    const destData = json.data?.[destination]
    if (!destData) return []
    return Object.values(destData) as CheapEntry[]
  } catch {
    return []
  }
}

async function fetchLatest(
  origin: string,
  destination: string,
  token: string | undefined,
  options: { minDuration?: number; maxDuration?: number; oneWay?: boolean } = {}
): Promise<LatestEntry[]> {
  try {
    let url = `https://api.travelpayouts.com/v2/prices/latest?currency=eur&origin=${origin}&destination=${destination}&sorting=price&limit=1000&token=${token}`
    if (options.minDuration !== undefined) url += `&min_trip_duration=${options.minDuration}`
    if (options.maxDuration !== undefined) url += `&max_trip_duration=${options.maxDuration}`
    if (options.oneWay) url += `&one_way=true`
    const res = await fetch(url, REVALIDATE)
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

/** The calendar endpoint's cheapest fare for every departure day of a month,
 * with airline / times / return day where the cache has them. */
export async function fetchMonthCalendarDetailed(
  origin: string,
  destination: string,
  month: string,
  token: string | undefined
): Promise<Record<string, CalendarDayDetail>> {
  try {
    const url = `https://api.travelpayouts.com/v1/prices/calendar?origin=${origin}&destination=${destination}&depart_date=${month}&calendar_type=departure_date&currency=eur&token=${token}`
    const res = await fetch(url, REVALIDATE)
    if (!res.ok) return {}
    const json = await res.json()
    if (!currencyIsEuro(json)) return {}
    const data: Record<string, CalendarEntry> = json.data || {}

    const result: Record<string, CalendarDayDetail> = {}
    for (const [date, entry] of Object.entries(data)) {
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

// Fill in airline/times for a /v2 fare from the calendar, but ONLY when the
// calendar entry is clearly the same fare. Bounded so a wide date range can't
// trigger a flood of calendar requests.
const ENRICH_FLIGHT_LIMIT = 60
const ENRICH_CALENDAR_LIMIT = 8

async function enrichFromCalendar(flights: Flight[], token: string | undefined): Promise<Flight[]> {
  const needy = flights.filter((f) => !f.airlineCode || !f.departureTime).slice(0, ENRICH_FLIGHT_LIMIT)
  if (needy.length === 0) return flights

  const keys: string[] = []
  for (const f of needy) {
    const key = `${f.origin}|${f.destination}|${f.departureDate.slice(0, 7)}`
    if (!keys.includes(key) && keys.length < ENRICH_CALENDAR_LIMIT) keys.push(key)
  }

  const calendars = new Map<string, Record<string, CalendarDayDetail>>()
  await Promise.all(
    keys.map(async (key) => {
      const [origin, destination, month] = key.split('|')
      calendars.set(key, await fetchMonthCalendarDetailed(origin, destination, month, token))
    })
  )

  return flights.map((f) => {
    if (f.airlineCode && f.departureTime) return f
    const cal = calendars.get(`${f.origin}|${f.destination}|${f.departureDate.slice(0, 7)}`)?.[f.departureDate]
    if (!cal) return f
    // Same fare = same departure day, same return day, (nearly) the same price.
    if (cal.returnDate !== f.returnDate || Math.abs(cal.price - f.price) > 1) return f
    return {
      ...f,
      airlineCode: f.airlineCode ?? cal.airlineCode,
      departureTime: f.departureTime ?? cal.time,
      returnTime: f.returnTime ?? cal.returnTime,
      stops: f.stops ?? cal.stops,
    }
  })
}

/** Fills in airline/times (via the calendar) and airline names for just these
 * flights -- used for a single winning fare, so it costs at most one calendar call. */
export async function completeFlights(flights: Flight[], token: string | undefined): Promise<Flight[]> {
  const enriched = await enrichFromCalendar(flights, token)
  return resolveAirlineNames(enriched)
}

async function finish(
  flights: Flight[],
  token: string | undefined,
  preferredReturn?: string | null,
  enrich = true
): Promise<Flight[]> {
  const merged = dedupe(flights, preferredReturn).sort((a, b) => a.price - b.price)
  const enriched = enrich ? await enrichFromCalendar(merged, token) : merged
  const withAirlines = await resolveAirlineNames(enriched)
  return withAirlines.sort((a, b) => a.price - b.price)
}

/** All distinct cached flights for one origin, departing on a specific day.
 * Combines the source endpoints; honest about what's missing (no fabricated
 * times/airlines). `oneWay` asks the source for one-way fares; `returnDate`
 * (round trips) only decides which near-identical fare we keep; `enrich:
 * false` skips the extra calendar lookups when only the price matters. */
export async function getDayFlights(
  origin: string,
  destination: string,
  date: string,
  token: string | undefined,
  options: { oneWay?: boolean; returnDate?: string | null; enrich?: boolean } = {}
): Promise<Flight[]> {
  const [cheapEntries, latestEntries] = await Promise.all([
    fetchCheapExact(origin, destination, date, token),
    fetchLatest(origin, destination, token, { oneWay: options.oneWay }),
  ])

  const fromCheap = cheapEntries
    .map((e) => normalizeFromCheap(e, origin, destination))
    .filter((f): f is Flight => f !== null)

  const fromLatest = latestEntries
    .filter((e) => e.depart_date === date)
    .map((e) => normalizeFromLatest(e, origin, destination))
    .filter((f): f is Flight => f !== null)

  return finish([...fromCheap, ...fromLatest], token, options.returnDate, options.enrich ?? true)
}

/** All distinct cached flights for one origin within a date range + trip
 * duration filter (date-range search mode). */
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
  // A one-way search has no trip length, so the min/max days only apply to round trips.
  const entries = await fetchLatest(origin, destination, token, {
    minDuration: options.oneWay ? undefined : minDays,
    maxDuration: options.oneWay ? undefined : maxDays,
    oneWay: options.oneWay,
  })

  const filtered = rangeStart
    ? entries.filter((e) => (e.depart_date || '') >= rangeStart && (!rangeEnd || (e.depart_date || '') <= rangeEnd))
    : entries

  const flights = filtered
    .map((e) => normalizeFromLatest(e, origin, destination))
    .filter((f): f is Flight => f !== null)

  return finish(flights, token, null, options.enrich ?? true)
}

/** The single cheapest cached fare for one direction on a day (or month, as
 * YYYY-MM, or no date at all). The source lists one fare per number of stops, so the
 * cheapest is the MINIMUM price, not the first entry (which is usually the direct, dearer one).
 * The fare may be a round-trip fare (it then has a return date and its price covers both flights). */
export async function getCheapestLeg(
  origin: string,
  destination: string,
  date: string | undefined,
  token: string | undefined
): Promise<Flight | null> {
  const entries = await fetchCheapExact(origin, destination, date, token)
  const flights = entries.map((e) => normalizeFromCheap(e, origin, destination)).filter((f): f is Flight => f !== null)
  if (flights.length === 0) return null
  const cheapest = flights.reduce((min, f) => (f.price < min.price ? f : min))
  const [named] = await resolveAirlineNames([cheapest])
  return named
}

/** The cheapest cached ONE-WAY fare for one direction on a day (or in a month, as YYYY-MM): used where a
 * flight is priced on its own and added to another (open-jaw). A fare that has a return date is a round-trip
 * price for two flights, so it is never taken as the price of one flight. null = no cached one-way price. */
export async function getCheapestOneWayLeg(
  origin: string,
  destination: string,
  dateOrMonth: string | undefined,
  token: string | undefined
): Promise<Flight | null> {
  const [cheapEntries, latestEntries] = await Promise.all([
    fetchCheapExact(origin, destination, dateOrMonth, token),
    fetchLatest(origin, destination, token, { oneWay: true }),
  ])
  const fromCheap = cheapEntries.map((e) => normalizeFromCheap(e, origin, destination))
  const fromLatest = latestEntries
    .filter((e) => !dateOrMonth || (e.depart_date || '').startsWith(dateOrMonth))
    .map((e) => normalizeFromLatest(e, origin, destination))
  const oneWay = [...fromCheap, ...fromLatest].filter((f): f is Flight => f !== null && f.returnDate === null)
  if (oneWay.length === 0) return null
  const cheapest = oneWay.reduce((min, f) => (f.price < min.price ? f : min))
  const [named] = await resolveAirlineNames([cheapest])
  return named
}

/** One-way prices for the days of a month: the calendar's entries that have no return date, plus the
 * one-way list (v2 `one_way=true`), the cheapest per day. A calendar entry WITH a return date is a
 * round-trip price and is left out (it would be shown as the price of a single flight). */
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

/** The single cheapest cached round-trip/one-way fare to a destination across
 * several home airports (no particular date), or null when none is cached. */
export async function getCheapestFare(
  origins: string[],
  destination: string,
  token: string | undefined
): Promise<Fare | null> {
  const flights = await Promise.all(origins.map((o) => getCheapestLeg(o, destination, undefined, token)))
  const valid = flights.filter((f): f is Flight => f !== null).sort((a, b) => a.price - b.price)
  return valid.length > 0 ? flightToFare(valid[0]) : null
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
