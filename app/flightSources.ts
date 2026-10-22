// Shared logic for fetching real cached flight data from Travelpayouts and
// turning it into a clean, de-duplicated, honestly-labeled list.
//
// Two source endpoints, each with real limits we're upfront about:
// - /v1/prices/cheap: has a real airline code + exact departure time, but is
//   very sparse for an exact date (often empty) and gives at most ~1 cached
//   fare per call.
// - /v2/prices/latest: much richer (can return many distinct cached fares),
//   but has NO airline info (only a "gate" = booking site that found the
//   price) and only day-level dates, no departure time. It also contains a
//   lot of near-duplicate filler entries (empty gate, 0 duration/distance,
//   same price repeated across many nearby return dates) which we collapse.

import { getAirlineName } from './airlines'
import { buildBookingLink } from './aviasalesLink'

export type Flight = {
  origin: string
  destination: string
  price: number
  departureDate: string // YYYY-MM-DD
  departureTime: string | null // HH:MM if known, else null (v2 has no time)
  returnDate: string | null
  stops: number | null // null = unknown
  airlineCode: string | null
  airlineName: string | null
  gate: string | null // booking site that found this fare (v2 only), for context only
  bookingUrl: string
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
): Promise<any[]> {
  try {
    let url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=eur&token=${token}`
    if (date) url += `&depart_date=${date}`
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    const destData = json.data?.[destination]
    if (!destData) return []
    return Object.values(destData)
  } catch {
    return []
  }
}

async function fetchLatest(
  origin: string,
  destination: string,
  token: string | undefined,
  minDuration?: number,
  maxDuration?: number
): Promise<any[]> {
  try {
    let url = `https://api.travelpayouts.com/v2/prices/latest?currency=eur&origin=${origin}&destination=${destination}&sorting=price&limit=1000&token=${token}`
    if (minDuration !== undefined) url += `&min_trip_duration=${minDuration}`
    if (maxDuration !== undefined) url += `&max_trip_duration=${maxDuration}`
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.data) ? json.data : []
  } catch {
    return []
  }
}

function normalizeFromCheap(entry: any, origin: string, destination: string): Flight | null {
  if (typeof entry?.price !== 'number') return null
  const depDate = dateOnly(entry.departure_at)
  if (!depDate) return null
  return {
    origin,
    destination,
    price: entry.price,
    departureDate: depDate,
    departureTime: timeOnly(entry.departure_at),
    returnDate: dateOnly(entry.return_at),
    stops: null,
    airlineCode: entry.airline || null,
    airlineName: null, // resolved later, batched
    gate: null,
    bookingUrl: buildBookingLink(origin, destination, entry.departure_at, entry.return_at || undefined),
  }
}

function normalizeFromLatest(entry: any, origin: string, destination: string): Flight | null {
  if (typeof entry?.value !== 'number' || !entry?.depart_date) return null
  return {
    origin,
    destination,
    price: entry.value,
    departureDate: entry.depart_date,
    departureTime: null, // v2 doesn't give a time of day
    returnDate: entry.return_date || null,
    stops: typeof entry.number_of_changes === 'number' ? entry.number_of_changes : null,
    airlineCode: null, // v2 doesn't give an airline
    airlineName: null,
    gate: entry.gate || null,
    bookingUrl: buildBookingLink(origin, destination, entry.depart_date, entry.return_date || undefined),
  }
}

function dedupeKey(f: Flight): string {
  return `${f.origin}|${f.departureDate}|${Math.round(f.price)}`
}

/** Collapses near-duplicate entries (same origin/day/price) into one,
 * preferring the one with real gate/airline/duration info when available. */
function dedupe(flights: Flight[]): Flight[] {
  const byKey = new Map<string, Flight>()
  for (const f of flights) {
    const key = dedupeKey(f)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, f)
      continue
    }
    const fHasInfo = !!(f.gate || f.airlineCode)
    const existingHasInfo = !!(existing.gate || existing.airlineCode)
    if (fHasInfo && !existingHasInfo) byKey.set(key, f)
  }
  return Array.from(byKey.values())
}

async function resolveAirlineNames(flights: Flight[]): Promise<Flight[]> {
  const codes = flights.map((f) => f.airlineCode).filter(Boolean) as string[]
  if (codes.length === 0) return flights
  const names = await Promise.all(codes.map((c) => getAirlineName(c)))
  const map = new Map(codes.map((c, i) => [c, names[i]]))
  return flights.map((f) =>
    f.airlineCode ? { ...f, airlineName: map.get(f.airlineCode) || null } : f
  )
}

/** All distinct cached flights for one origin, departing on a specific day.
 * Combines both source endpoints; honest about what's missing (no fabricated
 * times/airlines). */
export async function getDayFlights(
  origin: string,
  destination: string,
  date: string,
  token: string | undefined
): Promise<Flight[]> {
  const [cheapEntries, latestEntries] = await Promise.all([
    fetchCheapExact(origin, destination, date, token),
    fetchLatest(origin, destination, token),
  ])

  const fromCheap = cheapEntries
    .map((e) => normalizeFromCheap(e, origin, destination))
    .filter((f): f is Flight => f !== null)

  const fromLatest = latestEntries
    .filter((e) => e.depart_date === date)
    .map((e) => normalizeFromLatest(e, origin, destination))
    .filter((f): f is Flight => f !== null)

  const merged = dedupe([...fromCheap, ...fromLatest])
  const withAirlines = await resolveAirlineNames(merged)
  withAirlines.sort((a, b) => a.price - b.price)
  return withAirlines
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
  token: string | undefined
): Promise<Flight[]> {
  const entries = await fetchLatest(origin, destination, token, minDays, maxDays)

  const filtered = rangeStart
    ? entries.filter((e) => e.depart_date >= rangeStart && (!rangeEnd || e.depart_date <= rangeEnd))
    : entries

  const flights = filtered
    .map((e) => normalizeFromLatest(e, origin, destination))
    .filter((f): f is Flight => f !== null)

  const merged = dedupe(flights)
  const withAirlines = await resolveAirlineNames(merged)
  withAirlines.sort((a, b) => a.price - b.price)
  return withAirlines
}
