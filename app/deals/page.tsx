import type { Metadata } from 'next'
import Link from 'next/link'
import { loadDeals } from '../lib/deals'
import { cheapestIndex } from '../lib/trustOrder'
import FareCard from '../components/FareCard'
import PageHero from '../components/PageHero'
import { pageMetadata } from '../lib/seo'

// The daily job refreshes the table, so rebuild this page at least hourly
// instead of freezing whatever was in the table when the site was last deployed.
export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: "This week's cheap flight deals",
  description:
    'The cheapest cached flights this week from Bratislava, Vienna, Budapest, Košice and Prague, with airlines and times where the data has them.',
  path: '/deals',
})

export default async function DealsPage() {
  const loaded = await loadDeals()

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="h-page mb-2">We couldn&apos;t load the deals</h1>
        <p className="mb-6 text-slate">Something went wrong on our side. Please try again in a moment.</p>
        <Link href="/search" className="btn btn-primary btn-lg">
          Search flights instead
        </Link>
      </div>
    )
  }

  // Fresh, complete fares first (lib/trustOrder.ts): a price older than 72 h, or one without its age or airline, moves down
  // but stays on the page with its own age next to it. The "Cheapest" badge stays on the real cheapest one.
  const order = loaded
  const deals = order.map((o) => o.deal)
  const fares = order.map((o) => o.fare)
  const cheapest = cheapestIndex(fares.map((f) => f.price))

  return (
    <div>
      <PageHero eyebrow="Fresh every day" title="Top cheap flights this week">
        <p>
          The cheapest cached fares from Bratislava, Vienna, Budapest, Košice and Prague. Prices are cached and may change
          on the booking site.
        </p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {deals.length === 0 && (
          <div className="surface px-5 py-6">
            <p className="mb-1 font-semibold">No deals yet</p>
            <p className="text-sm text-slate">They are refreshed once a day — check back soon, or search your own dates now.</p>
            <Link href="/search" className="btn btn-primary mt-4">
              Search flights →
            </Link>
          </div>
        )}

        {deals.length > 0 && (
          <ul className="space-y-4">
            {deals.map((deal, i) => (
              <FareCard
                key={deal.id}
                linkPage="deals"
                fare={fares[i]}
                isCheapest={i === cheapest}
                shareHref={`/destinations/${deal.destination_slug}`}
                shareTitle={deal.destination_city}
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
    </div>
  )
}
