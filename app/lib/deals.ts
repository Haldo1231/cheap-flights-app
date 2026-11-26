// The daily deals (`weekly_deals`, filled by the 06:00 cron) as fares, for the /deals page and the home page.
// Server only: reads Supabase and the price store.

import { supabase } from '../supabase'
import { buildBookingLink } from '../aviasalesLink'
import { getDayFlights, flightToFare } from '../flightSources'
import { mapWithLimit } from './pool'
import { byTrust } from './trustOrder'
import { MAX_PRICE_AGE_MS, priceAgeMs } from './priceAge'
import type { Fare } from '../tripTypes'

export type Deal = {
  id: number
  origin: string
  destination: string
  destination_city: string
  destination_slug: string
  price: number
  departure_date: string
  return_date: string | null
}

/** The deal as a fare. When the cached data for that exact day has the very same
 * fare (same return day, same price) we also get its airline, times and price age. */
async function dealToFare(deal: Deal): Promise<Fare> {
  const base = {
    origin: deal.origin,
    destination: deal.destination,
    price: deal.price,
    departureDate: deal.departure_date,
    departureTime: null,
    returnDate: deal.return_date,
    returnTime: null,
    stops: null,
    airlineCode: null,
    airlineName: null,
    gate: null,
    bookingUrl: buildBookingLink(deal.origin, deal.destination, deal.departure_date, deal.return_date ?? undefined),
    foundAt: null, // the stored deal has no seen-at time
    expiresAt: null,
  }
  try {
    const flights = await getDayFlights(deal.origin, deal.destination, deal.departure_date, process.env.TRAVELPAYOUTS_TOKEN)
    const same = flights.find((f) => f.returnDate === deal.return_date && Math.abs(f.price - deal.price) <= 1)
    return flightToFare(same ?? base)
  } catch {
    return flightToFare(base)
  }
}

export type DealFare = { deal: Deal; fare: Fare }

/** Every stored deal with its fare, in the trust order (lib/trustOrder.ts): fresh, complete fares first, cheapest first
 * inside each group. null when the table could not be read. */
export async function loadDeals(): Promise<DealFare[] | null> {
  const { data, error } = await supabase.from('weekly_deals').select('*').order('price', { ascending: true })
  if (error) return null
  const rows = (data as Deal[] | null) ?? []
  const looked = await mapWithLimit(rows, 3, dealToFare)
  return rows
    .map((deal, i) => ({ deal, fare: looked[i] }))
    .sort(byTrust(({ fare }) => ({ price: fare.price, seenAt: fare.seenAt, airline: fare.outbound.airlineCode ?? fare.outbound.airlineName })))
}

/** The home page's few deals: only fares whose price was seen in the last 72 h and that have not left yet, cheapest
 * first, at most `limit`. An empty list (nothing fresh, or the table unreadable) means the home page shows no deals. */
export async function freshDeals(limit = 4, now = Date.now()): Promise<DealFare[]> {
  const all = await loadDeals().catch(() => null)
  if (!all) return []
  const today = new Date(now).toISOString().slice(0, 10)
  return all
    .filter(({ deal, fare }) => {
      const age = priceAgeMs(fare.seenAt, now)
      return age !== null && age <= MAX_PRICE_AGE_MS && deal.departure_date >= today
    })
    .sort((a, b) => a.fare.price - b.fare.price)
    .slice(0, limit)
}

/** The results page of exactly this deal: that route, that airport, those days. */
export function dealResultsHref(deal: Deal): string {
  const q = new URLSearchParams({ origins: deal.origin, destination: deal.destination, dateMode: 'exact', departDate: deal.departure_date })
  if (deal.return_date) q.set('returnDate', deal.return_date)
  else q.set('oneWay', 'true')
  return `/results?${q.toString()}`
}
