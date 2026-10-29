import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '../components/PageHero'
import TripCard from '../components/content/TripCard'
import { getTrips } from '../lib/content/load'
import { pageMetadata } from '../lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Trip reports',
  description: 'Trips with what the flights, the stay and the food really cost, per person.',
  path: '/trips',
})

export default function TripsPage() {
  const trips = getTrips()

  return (
    <div>
      <PageHero eyebrow="Trips" title="Real trips, real costs">
        <p>What the flights, the stay and the food really cost, written down after the trip.</p>
      </PageHero>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {trips.length === 0 ? (
          <div className="surface px-5 py-10 text-center sm:px-8">
            <h2 className="text-xl font-semibold">First trips coming soon</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate">
              Trip reports will show up here. In the meantime you can search flights and see what a stay is estimated to cost.
            </p>
            <Link href="/search" className="btn btn-primary mt-5">
              Search flights
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {trips.map((trip, i) => (
              <TripCard key={trip.slug} trip={trip} eager={i < 3} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
