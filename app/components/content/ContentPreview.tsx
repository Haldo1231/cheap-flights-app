import Link from 'next/link'
import { getGuides, getTrips } from '../../lib/content/load'
import GuideCard from './GuideCard'
import TripCard from './TripCard'

/** A small block for the home page with the newest trip reports and guides. It shows only when
 * something is published, so the home page never has an empty "coming soon" box. */
export default function ContentPreview() {
  const trips = getTrips().slice(0, 3)
  const guides = getGuides().slice(0, 2)
  if (trips.length === 0 && guides.length === 0) return null

  return (
    <section className="border-y border-line bg-surface" aria-labelledby="stories">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <p className="eyebrow mb-2">From the blog</p>
        <h2 id="stories" className="h-section mb-6">
          {trips.length > 0 && guides.length > 0 ? 'Real trips and guides' : trips.length > 0 ? 'Real trips, real costs' : 'Guides for cheaper trips'}
        </h2>
        {trips.length > 0 && (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <TripCard key={trip.slug} trip={trip} />
              ))}
            </ul>
            <p className="mt-2">
              <Link href="/trips" className="inline-flex min-h-11 items-center font-medium text-ink underline decoration-amber decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                All trip reports →
              </Link>
            </p>
          </>
        )}
        {guides.length > 0 && (
          <>
            <ul className="mt-8 space-y-4">
              {guides.map((guide) => (
                <GuideCard key={guide.slug} guide={guide} />
              ))}
            </ul>
            <p className="mt-2">
              <Link href="/guides" className="inline-flex min-h-11 items-center font-medium text-ink underline decoration-amber decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                All guides →
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  )
}
