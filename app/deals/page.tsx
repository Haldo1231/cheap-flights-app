import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '../supabase'
import { buildBookingLink } from '../aviasalesLink'
import { getDayFlights, flightToFare } from '../flightSources'
import { mapWithLimit } from '../lib/pool'
import FareCard from '../components/FareCard'
import type { Fare } from '../tripTypes'

// The daily job refreshes the table, so rebuild this page at least hourly
// instead of freezing whatever was in the table when the site was last deployed.
export const revalidate = 3600

export const metadata: Metadata = {
  title: "This week's cheap flight deals",
  description:
    'The cheapest cached flights this week from Bratislava, Vienna, Budapest, Košice and Prague, with airlines and times where the data has them.',
}

type Deal = {
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
 * fare (same return day, same price) we also get its airline and times. */
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
  }
  try {
    const flights = await getDayFlights(deal.origin, deal.destination, deal.departure_date, process.env.TRAVELPAYOUTS_TOKEN)
    const same = flights.find((f) => f.returnDate === deal.return_date && Math.abs(f.price - deal.price) <= 1)
    return flightToFare(same ?? base)
  } catch {
    return flightToFare(base)
  }
}

export default async function DealsPage() {
  const { data, error } = await supabase.from('weekly_deals').select('*').order('price', { ascending: true })

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="mb-2 text-2xl font-semibold">We couldn&apos;t load the deals</h1>
        <p className="mb-6 text-slate">Something went wrong on our side. Please try again in a moment.</p>
        <Link href="/search" className="inline-flex min-h-11 items-center rounded-sm bg-ink px-5 font-medium text-white hover:bg-ink-hover">
          Search flights instead
        </Link>
      </div>
    )
  }

  const deals = (data as Deal[] | null) ?? []
  const fares = await mapWithLimit(deals, 3, dealToFare)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Top cheap flights this week</h1>
      <p className="mb-6 text-slate">
        The cheapest cached fares from Bratislava, Vienna, Budapest, Košice and Prague. Prices are cached and may change on
        the booking site.
      </p>

      {deals.length === 0 && (
        <div className="rounded-sm border border-line bg-white px-5 py-6">
          <p className="mb-1 font-semibold">No deals yet</p>
          <p className="text-sm text-slate">They are refreshed once a day — check back soon, or search your own dates now.</p>
          <Link href="/search" className="mt-3 inline-block text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            Search flights →
          </Link>
        </div>
      )}

      {deals.length > 0 && (
        <ul className="space-y-4">
          {deals.map((deal, i) => (
            <FareCard
              key={deal.id}
              fare={fares[i]}
              isCheapest={i === 0}
              heading={
                <Link href={`/destinations/${deal.destination_slug}`} className="hover:underline">
                  {deal.destination_city}
                </Link>
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
