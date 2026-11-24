import Link from 'next/link'
import Flag from '../components/Flag'
import PageHero from '../components/PageHero'
import { HOME_AIRPORTS } from '../homeAirports'
import { airportCity } from '../airportsList'
import { ROUTE_PAGES, routesFromAirport } from '../lib/routePages'
import { pageMetadata } from '../lib/seo'

// The list of route pages, grouped by home airport. It is built from the committed route list, so this page needs no
// database and never disagrees with which routes actually have a page.
export const metadata = pageMetadata({
  title: 'Flight routes from Bratislava, Vienna, Budapest, Košice and Prague',
  description: `Cached prices, month by month, for ${ROUTE_PAGES.length} routes from the five home airports: the cheapest fare, a price calendar, the airlines that fly it and the cheapest day of the week.`,
  path: '/flights',
})

export default function FlightsIndexPage() {
  const groups = HOME_AIRPORTS.map((code) => ({ code, city: airportCity(code), routes: routesFromAirport(code) })).filter((g) => g.routes.length > 0)

  return (
    <>
      <PageHero eyebrow="Routes" title="Flight routes, price by price">
        <p>
          One page per route, built only from our own store of cached fares: the cheapest price, how it moves month by month,
          which airlines fly it and which day of the week is cheapest.
        </p>
      </PageHero>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {groups.map((group) => (
          <section key={group.code} className="mb-10" aria-labelledby={`from-${group.code}`}>
            <h2 id={`from-${group.code}`} className="h-section mb-1">
              From {group.city} <span className="font-mono text-base font-normal text-slate">{group.code}</span>
            </h2>
            <p className="mb-3 text-sm text-slate">{group.routes.length === 1 ? '1 route' : `${group.routes.length} routes`}</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.routes.map((r) => (
                <li key={r.slug}>
                  <Link href={`/flights/${r.slug}`} className="surface flex min-h-12 items-center gap-3 px-4 py-3 text-sm text-ink hover:border-ink">
                    <Flag code={r.countryCode} size="xs" />
                    <span>
                      {r.originCity} → {r.destinationCity}
                    </span>
                    <span className="ml-auto font-mono text-xs text-faint">
                      {r.origin}–{r.destination}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-sm text-slate">
          A route only gets a page when our store really holds enough about it: a thin route would make a page that says
          nothing. Košice has the least cached data of the five airports, so it has the fewest routes here. For anything not
          listed, use the{' '}
          <Link href="/search" className="underline decoration-line decoration-2 underline-offset-4 hover:decoration-amber">
            search
          </Link>
          .
        </p>
      </div>
    </>
  )
}
