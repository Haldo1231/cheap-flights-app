// A trip is passed to the trip page inside the URL (a snapshot of what was
// shown when it was clicked), so the page can be shared and survives a refresh
// without any database. The values are validated when read back because anyone
// can edit a URL.

import { SELECTION_KEYS, withParams } from './resultsUrl'

export type TripLegSnapshot = {
  origin: string
  destination: string
  date: string
  time: string | null
  airlineCode: string | null
  stops: number | null
  /** Price of this leg alone; null when the whole fare has one price. */
  price: number | null
}

export type TripSnapshot = {
  /** "fare": one cached fare (round trip = one price). "legs": two separately priced flights. */
  kind: 'fare' | 'legs'
  outbound: TripLegSnapshot
  inbound: TripLegSnapshot | null
  /** Total price of the flights. */
  price: number
  gate: string | null
}

const TRIP_KEYS = ['tk', 'o1', 'd1', 't1', 'a1', 's1', 'p1', 'h2', 'd2', 't2', 'a2', 'p2', 'tp', 'tg']

/** URL of the trip page for a trip, keeping all the current search params. */
export function tripHref(current: URLSearchParams | string, destination: string, trip: TripSnapshot): string {
  const changes: Record<string, string | null> = {
    destination,
    tk: trip.kind,
    o1: trip.outbound.origin,
    d1: trip.outbound.date,
    t1: trip.outbound.time,
    a1: trip.outbound.airlineCode,
    s1: trip.outbound.stops === null ? null : String(trip.outbound.stops),
    p1: trip.outbound.price === null ? null : String(trip.outbound.price),
    h2: trip.inbound ? trip.inbound.destination : null,
    d2: trip.inbound ? trip.inbound.date : null,
    t2: trip.inbound ? trip.inbound.time : null,
    a2: trip.inbound ? trip.inbound.airlineCode : null,
    p2: trip.inbound && trip.inbound.price !== null ? String(trip.inbound.price) : null,
    tp: String(trip.price),
    tg: trip.gate,
  }
  return withParams(current, changes, '/trip')
}

/** The results-screen URL a trip page came from (trip data removed). */
export function resultsHrefFromTrip(current: URLSearchParams | string): string {
  const params = new URLSearchParams(typeof current === 'string' ? current : current.toString())
  for (const key of TRIP_KEYS) params.delete(key)
  const qs = params.toString()
  return qs ? `/results?${qs}` : '/results'
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/
const CODE = /^[A-Z0-9]{2,4}$/

function code(value: string | null | undefined): string | null {
  const v = (value || '').toUpperCase()
  return CODE.test(v) ? v : null
}
function date(value: string | null | undefined): string | null {
  return value && DATE.test(value) ? value : null
}
function time(value: string | null | undefined): string | null {
  return value && TIME.test(value) ? value : null
}
function money(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n) : null
}
function small(value: string | null | undefined): number | null {
  const n = money(value)
  return n !== null && n <= 9 ? n : null
}

/** Reads and validates a trip from URL params; null when it is missing or broken. */
export function parseTrip(get: (key: string) => string | null | undefined): TripSnapshot | null {
  const destination = code(get('destination'))
  const origin = code(get('o1'))
  const outDate = date(get('d1'))
  const price = money(get('tp'))
  const kindParam = get('tk')
  if (!destination || !origin || !outDate || price === null || (kindParam !== 'fare' && kindParam !== 'legs')) return null

  const outbound: TripLegSnapshot = {
    origin,
    destination,
    date: outDate,
    time: time(get('t1')),
    airlineCode: code(get('a1')),
    stops: small(get('s1')),
    price: money(get('p1')),
  }

  let inbound: TripLegSnapshot | null = null
  const backDate = date(get('d2'))
  const backAirport = code(get('h2'))
  if (backDate && backAirport) {
    inbound = {
      origin: destination,
      destination: backAirport,
      date: backDate,
      time: time(get('t2')),
      // A round-trip fare lists one carrier for the whole ticket.
      airlineCode: code(get('a2')) ?? (kindParam === 'fare' ? outbound.airlineCode : null),
      stops: null,
      price: money(get('p2')),
    }
  }

  const gate = (get('tg') || '').slice(0, 40)
  return { kind: kindParam, outbound, inbound, price, gate: gate || null }
}

export { SELECTION_KEYS }
