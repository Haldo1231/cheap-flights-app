// Where the screens get their prices: the price store first, the live price service only as a fallback.
//  - A route-month (one airport, one city, one month, one way or round trip) comes from the store when the store has it
//    and it is younger than FRESH_HOURS. Otherwise it is fetched live from the price service, written to the store (so the
//    next visitor reads it from there) and logged. If the live call fails too, the stored rows are shown with their real
//    age rather than nothing, and that is logged as well.
//  - The month summaries (every destination of an airport) work the same way.
// Every screen reads through these functions, so the overview, a country, a city's calendar and a search agree.
// Server code only.

import { fetchMonthSummary, fetchRouteMonth } from './tpV3'
import { mapWithLimit } from './pool'
import { readCoverage, readOverview, readTickets, setCoverage, upsertTickets, SUMMARY_DESTINATION, type Coverage, type StoreTicket } from './priceStore'

/** A stored route-month older than this is refreshed live before it is shown. */
export const FRESH_HOURS = 48
const FRESH_MS = FRESH_HOURS * 3600e3
/** This month and the next MONTHS_AHEAD months are kept in the store. */
export const MONTHS_AHEAD = 3
const LIVE_AT_ONCE = 5

export type RoutePair = { origin: string; destination: string }

function monthOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** The months the store covers: this month and the next MONTHS_AHEAD (YYYY-MM). */
export function coveredMonths(now = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i <= MONTHS_AHEAD; i++) out.push(monthOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1))))
  return out
}

const hoursOld = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 3600e3)
const kindOf = (oneWay: boolean) => (oneWay ? 'one way' : 'round trip')
const samePair = (c: { origin: string; destination: string }, p: RoutePair) => c.origin === p.origin && c.destination === p.destination

/** What the store says about one route-month: fresh, stale (older than FRESH_HOURS) or missing. */
function stateOf(c: Coverage | undefined): 'fresh' | 'stale' | 'missing' {
  if (!c) return 'missing'
  return Date.now() - Date.parse(c.fetched_at) < FRESH_MS ? 'fresh' : 'stale'
}

/** The tickets of several routes for one month. Store first; live (then stored) for a route that is missing or stale. */
export async function routePairTickets(pairs: RoutePair[], month: string, oneWay: boolean, token: string | undefined): Promise<StoreTicket[]> {
  if (pairs.length === 0) return []
  const [coverage, stored] = await Promise.all([readCoverage(pairs, month, oneWay), readTickets(pairs, month, oneWay)])
  const out: StoreTicket[] = []
  const toFetch: { pair: RoutePair; state: string }[] = []
  for (const pair of pairs) {
    const c = coverage.find((x) => samePair(x, pair))
    const state = stateOf(c)
    if (state === 'fresh') out.push(...stored.filter((t) => samePair(t, pair)))
    else toFetch.push({ pair, state: state === 'stale' && c ? `stale, ${hoursOld(c.fetched_at)} h old` : 'missing' })
  }
  const live = await mapWithLimit(toFetch, LIVE_AT_ONCE, async ({ pair, state }) => {
    const answer = await fetchRouteMonth(pair.origin, pair.destination, month, oneWay, token, 'live')
    const route = `${pair.origin}-${pair.destination} ${month} ${kindOf(oneWay)}`
    if (answer.ok) {
      const written = await upsertTickets(answer.tickets)
      if (written.error) console.error(`[prices] could not store ${route}: ${written.error}`)
      else await setCoverage(pair.origin, pair.destination, month, oneWay, answer.tickets.length, 'live')
      console.warn(`[prices] live fallback for ${route}: store ${state}; ${answer.tickets.length} tickets`)
      return answer.tickets
    }
    const stale = stored.filter((t) => samePair(t, pair))
    console.error(`[prices] live fallback FAILED for ${route} (${answer.error}); store ${state}; showing ${stale.length} stored tickets`)
    return stale
  })
  return [...out, ...live.flat()]
}

/** The tickets between several home airports and one city for a month. `direction` "out" = airport to city, "back" = city to airport. */
export function routeMonthTickets(origins: string[], city: string, month: string, oneWay: boolean, token: string | undefined, direction: 'out' | 'back' = 'out'): Promise<StoreTicket[]> {
  const pairs = origins.map((o) => (direction === 'back' ? { origin: city, destination: o } : { origin: o, destination: city }))
  return routePairTickets(pairs, month, oneWay, token)
}

// The overview of a month is asked for by several routes of one search within seconds: remember it briefly.
const overviewMemo = new Map<string, { at: number; tickets: StoreTicket[] }>()
const OVERVIEW_MEMO_MS = 60e3

/** For every home airport and destination the cheapest stored ticket of a month (the overview of Anywhere, the "from EUR X"
 * of a destination). The month summaries of the store are refreshed live when missing or stale. */
export async function overviewTickets(origins: string[], month: string, oneWay: boolean, token: string | undefined): Promise<StoreTicket[]> {
  const key = `${origins.slice().sort().join(',')}|${month}|${oneWay}`
  const memo = overviewMemo.get(key)
  if (memo && Date.now() - memo.at < OVERVIEW_MEMO_MS) return memo.tickets

  const summaryPairs = origins.map((o) => ({ origin: o, destination: SUMMARY_DESTINATION }))
  const coverage = await readCoverage(summaryPairs, month, oneWay)
  const missing = origins.filter((o) => stateOf(coverage.find((c) => c.origin === o)) !== 'fresh')
  await mapWithLimit(missing, LIVE_AT_ONCE, async (origin) => {
    const c = coverage.find((x) => x.origin === origin)
    const state = c ? `stale, ${hoursOld(c.fetched_at)} h old` : 'missing'
    const answer = await fetchMonthSummary(origin, month, oneWay, token)
    if (!answer.ok) {
      console.error(`[prices] live summary FAILED for ${origin} ${month} ${kindOf(oneWay)} (${answer.error}); store ${state}`)
      return
    }
    const written = await upsertTickets(answer.tickets)
    if (written.error) console.error(`[prices] could not store the summary ${origin} ${month}: ${written.error}`)
    else await setCoverage(origin, SUMMARY_DESTINATION, month, oneWay, answer.tickets.length, 'live')
    console.warn(`[prices] live summary for ${origin} ${month} ${kindOf(oneWay)}: store ${state}; ${answer.tickets.length} destinations`)
  })
  const tickets = await readOverview(origins, month, oneWay)
  overviewMemo.set(key, { at: Date.now(), tickets })
  return tickets
}

/** Forgets the remembered overviews (tests). */
export function forgetOverviews(): void {
  overviewMemo.clear()
}
