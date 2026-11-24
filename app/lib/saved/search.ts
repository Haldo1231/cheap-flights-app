// A saved search = a ROUTE and its DATES (never a ticket): home airport(s), destination, one way / round trip, how the dates
// were chosen and the dates. Pure helpers shared by the browser and the server: cleaning, the database row shape, the
// search link and the words shown on screen. Table: supabase/saved_routes.sql.

import { HOME_AIRPORTS } from '../../homeAirports'
import { airportCity } from '../../airportsList'
import { formatMonth, formatShortDate } from '../format'

export type DateMode = 'exact' | 'range' | 'month' | 'any'

export type SavedSearch = {
  /** Sorted, unique, 1 to 6 codes. */
  origins: string[]
  destination: string
  oneWay: boolean
  dateMode: DateMode
  /** exact: departure day; range: first day; month: YYYY-MM-01; any: null. */
  dateFrom: string | null
  /** exact: return day (round trip); range: last day; month: YYYY-MM-01 of the return month (round trip); else null. */
  dateTo: string | null
  /** range + round trip only. */
  minNights: number | null
  maxNights: number | null
}

/** One row of saved_routes as the screens use it. */
export type SavedRow = SavedSearch & {
  id: number
  savedPrice: number | null
  savedPriceSeenAt: string | null
  createdAt: string
}

const CODE = /^[A-Z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

function realDate(s: unknown): string | null {
  if (typeof s !== 'string' || !DATE.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null
}

function nights(n: unknown): number | null {
  const v = typeof n === 'string' ? Number(n) : n
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 30 ? v : null
}

/** A saved search from untrusted input (a request body, an address); null when anything does not add up. The same rules as
 * the table's checks, so a search that passes here is never refused by the database for its shape. */
export function cleanSearch(raw: unknown): SavedSearch | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const originsRaw = Array.isArray(r.origins) ? r.origins : typeof r.origins === 'string' ? r.origins.split(',') : []
  const origins = Array.from(new Set(originsRaw.map((o) => String(o).trim().toUpperCase()).filter((o) => CODE.test(o)))).sort()
  if (origins.length === 0 || origins.length > 6) return null
  const destination = typeof r.destination === 'string' ? r.destination.trim().toUpperCase() : ''
  if (!CODE.test(destination) || origins.includes(destination)) return null
  const oneWay = r.oneWay === true || r.oneWay === 'true'
  const mode = r.dateMode
  const base = { origins, destination, oneWay, dateFrom: null, dateTo: null, minNights: null, maxNights: null }

  if (mode === 'any') return { ...base, dateMode: 'any' }
  if (mode === 'exact') {
    const from = realDate(r.dateFrom)
    const to = oneWay ? null : realDate(r.dateTo)
    if (!from || (!oneWay && (!to || to < from))) return null
    return { ...base, dateMode: 'exact', dateFrom: from, dateTo: to }
  }
  if (mode === 'range') {
    const from = realDate(r.dateFrom)
    const to = realDate(r.dateTo)
    if (!from || !to || to < from) return null
    if (oneWay) return { ...base, dateMode: 'range', dateFrom: from, dateTo: to }
    const min = nights(r.minNights)
    const max = nights(r.maxNights)
    if (min === null || max === null || max < min) return null
    return { ...base, dateMode: 'range', dateFrom: from, dateTo: to, minNights: min, maxNights: max }
  }
  if (mode === 'month') {
    const from = realDate(r.dateFrom)
    if (!from || !from.endsWith('-01')) return null
    if (oneWay) return { ...base, dateMode: 'month', dateFrom: from }
    const to = realDate(r.dateTo) ?? from
    if (!to.endsWith('-01') || to < from) return null
    return { ...base, dateMode: 'month', dateFrom: from, dateTo: to }
  }
  return null
}

/** The search shown on a /results screen, or null when the address does not describe one saveable search. */
export function searchFromResults(params: URLSearchParams): SavedSearch | null {
  const destination = params.get('destination')
  if (!destination) return null
  const oneWay = params.get('oneWay') === 'true'
  const origins = (params.get('origins') || '').split(',').filter(Boolean)
  const mode = params.get('dateMode') || 'exact'
  const common = { origins: origins.length > 0 ? origins : HOME_AIRPORTS, destination, oneWay }
  if (mode === 'month') {
    const month = params.get('month') || ''
    const back = params.get('returnMonth') || month
    if (!MONTH.test(month)) return null
    return cleanSearch({ ...common, dateMode: 'month', dateFrom: `${month}-01`, dateTo: MONTH.test(back) ? `${back}-01` : null })
  }
  if (mode === 'range') {
    return cleanSearch({
      ...common,
      dateMode: 'range',
      dateFrom: params.get('rangeStart'),
      dateTo: params.get('rangeEnd'),
      minNights: params.get('minDays') ?? '2',
      maxNights: params.get('maxDays') ?? '10',
    })
  }
  return cleanSearch({ ...common, dateMode: 'exact', dateFrom: params.get('departDate'), dateTo: params.get('returnDate') })
}

/** The database row (snake_case) for a search. */
export function toRow(s: SavedSearch) {
  return {
    origins: s.origins.join(','),
    destination: s.destination,
    one_way: s.oneWay,
    date_mode: s.dateMode,
    date_from: s.dateFrom,
    date_to: s.dateTo,
    min_nights: s.minNights,
    max_nights: s.maxNights,
  }
}

type DbRow = ReturnType<typeof toRow> & {
  id: number
  saved_price: number | null
  saved_price_seen_at: string | null
  created_at: string
}

export function fromRow(row: DbRow): SavedRow {
  return {
    id: row.id,
    origins: row.origins.split(','),
    destination: row.destination,
    oneWay: row.one_way,
    dateMode: row.date_mode as DateMode,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    minNights: row.min_nights,
    maxNights: row.max_nights,
    savedPrice: row.saved_price,
    savedPriceSeenAt: row.saved_price_seen_at,
    createdAt: row.created_at,
  }
}

/** The search as query keys (the status request of the heart button). */
export function searchQuery(s: SavedSearch): string {
  const q = new URLSearchParams({ origins: s.origins.join(','), destination: s.destination, oneWay: String(s.oneWay), dateMode: s.dateMode })
  if (s.dateFrom) q.set('dateFrom', s.dateFrom)
  if (s.dateTo) q.set('dateTo', s.dateTo)
  if (s.minNights !== null) q.set('minNights', String(s.minNights))
  if (s.maxNights !== null) q.set('maxNights', String(s.maxNights))
  return q.toString()
}

/** Where "Search again" goes: the same search on /results (no date picked: the search form with the destination filled in). */
export function searchHref(s: SavedSearch): string {
  if (s.dateMode === 'any') return `/search?to=${s.destination}`
  const q = new URLSearchParams({ origins: s.origins.join(','), destination: s.destination, dateMode: s.dateMode })
  if (s.oneWay) q.set('oneWay', 'true')
  if (s.dateMode === 'exact') {
    q.set('departDate', s.dateFrom ?? '')
    if (!s.oneWay && s.dateTo) q.set('returnDate', s.dateTo)
  } else if (s.dateMode === 'month') {
    q.set('month', (s.dateFrom ?? '').slice(0, 7))
    if (!s.oneWay) q.set('returnMonth', (s.dateTo ?? s.dateFrom ?? '').slice(0, 7))
  } else {
    q.set('rangeStart', s.dateFrom ?? '')
    q.set('rangeEnd', s.dateTo ?? '')
    if (!s.oneWay) {
      q.set('minDays', String(s.minNights ?? 2))
      q.set('maxDays', String(s.maxNights ?? 10))
    }
  }
  return `/results?${q.toString()}`
}

/** "Bratislava, Vienna → Rome" */
export function routeLabel(s: SavedSearch): string {
  const from = s.origins.length === HOME_AIRPORTS.length && HOME_AIRPORTS.every((a) => s.origins.includes(a))
    ? 'All 5 home airports'
    : s.origins.map(airportCity).join(', ')
  return `${from} → ${airportCity(s.destination)}`
}

/** "Round trip · 12 Dec → 15 Dec" and the like. */
export function datesLabel(s: SavedSearch): string {
  const kind = s.oneWay ? 'One way' : 'Round trip'
  switch (s.dateMode) {
    case 'exact':
      return `${kind} · ${formatShortDate(s.dateFrom)}${s.dateTo ? ` → ${formatShortDate(s.dateTo)}` : ''}`
    case 'range':
      return `${kind} · leaving ${formatShortDate(s.dateFrom)} – ${formatShortDate(s.dateTo)}${
        s.minNights !== null ? ` · ${s.minNights}–${s.maxNights} nights` : ''
      }`
    case 'month': {
      const out = formatMonth(s.dateFrom)
      const back = s.dateTo ? formatMonth(s.dateTo) : null
      return `${kind} · whole month, ${out}${back && back !== out ? ` → back in ${back}` : ''}`
    }
    default:
      return `${kind} · any date in the next months`
  }
}
