import type { Metadata } from 'next'
import Link from 'next/link'
import { getCheapestDestinations } from '../cheapDestinations'
import FareCard from '../components/FareCard'

// Prices come from 1-hour cached data, so refresh this page about as often.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Where can I fly cheaply?',
  description:
    'The cheapest cached flights right now to popular city breaks from Bratislava, Vienna, Budapest, Košice and Prague, sorted by price.',
}

export default async function AnywherePage() {
  const results = await getCheapestDestinations()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Where can I fly cheaply?</h1>
      <p className="mb-2 text-slate">
        The cheapest cached fare to each popular city break from Bratislava, Vienna, Budapest, Košice and Prague, sorted by
        price. Prices are cached and may change on the booking site.
      </p>
      <p className="mb-6 text-sm text-slate">
        Have dates in mind?{' '}
        <Link
          href="/search?to=ANYWHERE"
          className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4 hover:text-amber-ink"
        >
          Search anywhere with your own dates →
        </Link>
      </p>

      {results.length === 0 && (
        <div className="rounded-sm border border-line bg-white px-5 py-6">
          <p className="mb-1 font-semibold">No cached destination prices right now</p>
          <p className="text-sm text-slate">The price data refreshes through the day. Try again in a little while.</p>
        </div>
      )}

      {results.length > 0 && (
        <ol className="space-y-4">
          {results.map(({ destination, fare }, i) => (
            <FareCard
              key={destination.code}
              fare={fare}
              isCheapest={i === 0}
              heading={
                <Link href={`/destinations/${destination.slug}`} className="hover:underline">
                  {i + 1}. {destination.name}
                </Link>
              }
            />
          ))}
        </ol>
      )}
    </div>
  )
}
