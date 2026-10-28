import type { Metadata } from 'next'
import Link from 'next/link'
import { getCheapestDestinations } from '../cheapDestinations'
import FareCard from '../components/FareCard'
import PageHero from '../components/PageHero'

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
    <div>
      <PageHero
        eyebrow="Anywhere"
        title="Where can I fly cheaply?"
        actions={
          <Link href="/search?to=ANYWHERE" className="btn btn-amber btn-lg">
            Search anywhere with your own dates
          </Link>
        }
      >
        <p>
          The cheapest cached fare to each popular city break from Bratislava, Vienna, Budapest, Košice and Prague, sorted
          by price. Prices are cached and may change on the booking site.
        </p>
      </PageHero>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {results.length === 0 && (
          <div className="surface px-5 py-6">
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
    </div>
  )
}
