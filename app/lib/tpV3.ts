// The "prices for dates" method (v3) of the Travelpayouts price service: the cheapest tickets found by Aviasales users in
// the last 48 hours. Asked per airport and month with unique=true it lists every destination once (its cheapest ticket of
// the month); asked per route and month it lists one ticket per day (one way) or per departure and return day (round trip).
// Every row is a real ticket with date and time, airline, flight number, booking site and a deep link. Checked with real
// answers: no copy rows and no days outside the asked month (the month guard below stays anyway). Server code only.

import { tpFetch } from './travelpayouts'
import { currencyIsEuro } from '../flightSources'
import { dedupeTickets, type StoreTicket, type TicketSource } from './priceStore'

/** The price service's market (which cache of prices). Tested on BTS-Milan: the default and sk/at/hu/cz gave the same
 * tickets, prices and links; the default is kept so what we show is what the Aviasales link opens. */
export const TP_MARKET: string | null = null

const ENDPOINT = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates'

type V3Row = {
  destination?: string
  destination_airport?: string
  departure_at?: string
  return_at?: string | null
  price?: number
  airline?: string
  flight_number?: string | number
  transfers?: number
  return_transfers?: number
  duration?: number
  gate?: string
  link?: string
}

export type V3Answer = { ok: true; tickets: StoreTicket[]; rows: number } | { ok: false; status: number; error: string }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)

/** The rows of one answer as store tickets: only priced rows of the asked month, one way or round trip as asked. */
export function normalizeV3(rows: unknown[], origin: string, month: string, oneWay: boolean, source: TicketSource, foundAt: string): StoreTicket[] {
  const out: StoreTicket[] = []
  for (const raw of rows) {
    const r = (raw ?? {}) as V3Row
    if (typeof r.price !== 'number' || !Number.isFinite(r.price) || r.price <= 0) continue
    if (!isDate(r.departure_at) || typeof r.destination !== 'string' || !r.destination) continue
    const departureDate = r.departure_at.slice(0, 10)
    if (!departureDate.startsWith(month)) continue // the month guard: never a day of another month
    const returnAt = isDate(r.return_at) ? r.return_at : null
    if (oneWay && returnAt) continue // a one-way answer must not carry a return
    if (!oneWay && !returnAt) continue // a round-trip answer must
    if (returnAt && returnAt.slice(0, 10) <= departureDate) continue
    out.push({
      origin,
      destination: r.destination.toUpperCase(),
      destination_airport: typeof r.destination_airport === 'string' ? r.destination_airport.toUpperCase() : null,
      departure_at: r.departure_at,
      departure_date: departureDate,
      return_at: returnAt,
      return_date: returnAt ? returnAt.slice(0, 10) : null,
      one_way: oneWay,
      price: Math.round(r.price),
      airline: typeof r.airline === 'string' && r.airline ? r.airline : null,
      flight_number: r.flight_number !== undefined && r.flight_number !== null && r.flight_number !== '' ? String(r.flight_number) : null,
      transfers: num(r.transfers),
      return_transfers: num(r.return_transfers),
      duration: num(r.duration),
      gate: typeof r.gate === 'string' && r.gate ? r.gate : null,
      link: typeof r.link === 'string' && r.link ? r.link : null,
      month,
      source,
      found_at: foundAt,
    })
  }
  return dedupeTickets(out)
}

async function fetchV3(params: Record<string, string>, token: string | undefined): Promise<{ ok: true; rows: unknown[] } | { ok: false; status: number; error: string }> {
  const u = new URL(ENDPOINT)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  u.searchParams.set('currency', 'eur')
  if (TP_MARKET) u.searchParams.set('market', TP_MARKET)
  try {
    const res = await tpFetch(u.toString(), token, { cache: 'no-store' })
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    const json = (await res.json()) as { success?: boolean; data?: unknown; currency?: unknown; error?: unknown }
    if (json.success === false) return { ok: false, status: res.status, error: String(json.error ?? 'not successful') }
    if (!currencyIsEuro(json)) return { ok: false, status: res.status, error: 'answer not in euro' }
    return { ok: true, rows: Array.isArray(json.data) ? json.data : [] }
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

/** Every destination of an airport in a month, each with its cheapest ticket (2 requests per airport and month cover both kinds). */
export async function fetchMonthSummary(origin: string, month: string, oneWay: boolean, token: string | undefined): Promise<V3Answer> {
  const r = await fetchV3({ origin, departure_at: month, one_way: String(oneWay), unique: 'true', limit: '1000', sorting: 'price' }, token)
  if (!r.ok) return r
  return { ok: true, rows: r.rows.length, tickets: normalizeV3(r.rows, origin, month, oneWay, 'month-cheapest', new Date().toISOString()) }
}

/** One route for a month: the cheapest ticket per day (one way) or per departure and return day (round trip). */
export async function fetchRouteMonth(origin: string, destination: string, month: string, oneWay: boolean, token: string | undefined, source: TicketSource = 'route-month'): Promise<V3Answer> {
  const r = await fetchV3({ origin, destination, departure_at: month, one_way: String(oneWay), limit: '1000', sorting: 'price' }, token)
  if (!r.ok) return r
  return { ok: true, rows: r.rows.length, tickets: normalizeV3(r.rows, origin, month, oneWay, source, new Date().toISOString()) }
}
