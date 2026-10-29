import Link from 'next/link'
import { DESTINATIONS } from '../../destinationsList'
import { HOME_AIRPORTS } from '../../homeAirports'
import { AIRPORTS } from '../../airportsList'
import { getCheapestFare } from '../../flightSources'
import Flag from '../Flag'
import { airportCountryCode } from '../../airportsList'

/** The destinations a guide is about, each with the cheapest cached fare we have right now.
 * The numbers come from the same cached data as the rest of the site (never typed by hand);
 * when there is none, the destination is still listed without a price. */
export default async function RelatedDestinations({ slugs }: { slugs: string[] }) {
  const items = slugs.map((slug) => DESTINATIONS.find((d) => d.slug === slug)).filter((d): d is (typeof DESTINATIONS)[number] => !!d)
  if (items.length === 0) return null

  const token = process.env.TRAVELPAYOUTS_TOKEN
  const fares = await Promise.all(
    items.map(async (d) => {
      try {
        return await getCheapestFare(HOME_AIRPORTS, d.code, token)
      } catch {
        return null
      }
    })
  )

  return (
    <section aria-labelledby="related" className="mt-12">
      <h2 id="related" className="h-section mb-1">
        Related destinations
      </h2>
      <p className="mb-4 text-sm text-slate">The cheapest cached fare we have right now. Prices change, so check the booking site.</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((d, i) => {
          const fare = fares[i]
          const from = fare ? AIRPORTS.find((a) => a.code === fare.outbound.origin)?.city ?? fare.outbound.origin : null
          return (
            <li key={d.slug} className="surface flex flex-col p-4">
              <p className="flex items-center gap-2 text-lg font-semibold">
                <Flag code={airportCountryCode(d.code)} size="sm" />
                {d.name}
              </p>
              <p className="mt-1 text-sm text-slate">
                {fare ? (
                  <>
                    from <span className="num text-base font-semibold text-ink">€{fare.price}</span> ({fare.inbound ? 'round trip' : 'one way'}, from {from})
                  </>
                ) : (
                  'No cached fare right now.'
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/destinations/${d.slug}`} className="btn btn-outline">
                  {d.name} page
                </Link>
                <Link href={`/search?to=${d.code}`} className="btn btn-amber">
                  Search flights
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
