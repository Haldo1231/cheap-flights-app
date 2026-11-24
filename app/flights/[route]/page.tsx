import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import Breadcrumbs from '../../components/Breadcrumbs'
import Flag from '../../components/Flag'
import PriceAge from '../../components/PriceAge'
import SaveButton from '../../components/SaveButton'
import { cleanSearch } from '../../lib/saved/search'
import RouteMonthCalendar from '../../components/route/RouteMonthCalendar'
import { buildBookingLink } from '../../aviasalesLink'
import { formatDay, formatMonth, formatShortDate, formatStops, nightsBetweenDates } from '../../lib/format'
import { breadcrumbJsonLd } from '../../lib/content/seo'
import { formatMinutes, getRouteFacts, type RouteFacts, type RouteFare } from '../../lib/routeFacts'
import { ROUTE_PAGES, routeBySlug, sameDestination, sameOrigin, type RoutePage } from '../../lib/routePages'
import { pageMetadata } from '../../lib/seo'
import { makeSubId } from '../../lib/subId'

// The prices are read from the store when the page is drawn, and the page is kept for an hour. The nightly job writes new
// prices once a night, so an hour is far finer than the data itself changes, and it keeps these 47 pages off the database
// on every single visit. The addresses come from the committed list (app/lib/routePages.ts), so a route never silently
// appears or disappears; an address that is not in that list is a 404 (`dynamicParams = false`).
export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return ROUTE_PAGES.map((r) => ({ route: r.slug }))
}

const factsFor = cache((origin: string, destination: string) => getRouteFacts(origin, destination))

const FULL_WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function title(route: RoutePage): string {
  return `${route.originCity} to ${route.destinationCity} flights`
}

export async function generateMetadata({ params }: { params: Promise<{ route: string }> }): Promise<Metadata> {
  const { route: slug } = await params
  const route = routeBySlug(slug)
  if (!route) return { title: 'Route not found' }
  const facts = await factsFor(route.origin, route.destination)
  const from = facts.cheapestRoundTrip?.price ?? facts.cheapestOneWay?.price ?? null
  const kind = facts.cheapestRoundTrip ? 'round trip' : 'one way'
  // Every route gets its own title and description: the two city names, the airport codes and this route's own price, so
  // no two of the 47 pages read the same.
  return pageMetadata({
    title: from !== null ? `${title(route)} from €${from} (${route.origin} → ${route.destination})` : `${title(route)} (${route.origin} → ${route.destination})`,
    previewTitle: from !== null ? `${route.originCity} → ${route.destinationCity} from €${from}` : `${route.originCity} → ${route.destinationCity}`,
    description:
      from !== null
        ? `Cheapest cached ${route.originCity} (${route.origin}) to ${route.destinationCity} (${route.destination}) flights: from €${from} ${kind}, month by month prices, which airlines fly the route and the cheapest day of the week.`
        : `${route.originCity} (${route.origin}) to ${route.destinationCity} (${route.destination}) flights: month by month cached prices, airlines on the route and the cheapest day of the week.`,
    path: `/flights/${slug}`,
    card: {
      title: `${route.originCity} → ${route.destinationCity}`,
      eyebrow: `${route.origin} → ${route.destination}`,
      price: from,
      note: from !== null ? kind : '',
      line: facts.cheapestRoundTrip
        ? `${formatShortDate(facts.cheapestRoundTrip.departureDate)} → ${formatShortDate(facts.cheapestRoundTrip.returnDate)}`
        : facts.cheapestOneWay
          ? formatShortDate(facts.cheapestOneWay.departureDate)
          : 'Cached prices for the next months',
      cc: route.countryCode,
    },
  })
}

/** One booking button for a stored ticket. The deep link opens that exact ticket when the store has one. */
function BookLink({ route, fare, label }: { route: RoutePage; fare: RouteFare; label: string }) {
  const href = buildBookingLink(
    route.origin,
    route.destination,
    fare.departureDate,
    fare.returnDate ?? undefined,
    fare.link ?? undefined,
    makeSubId('route', fare.oneWay ? 'ow' : 'rt', route.origin)
  )
  return (
    <a href={href} target="_blank" rel="nofollow sponsored noopener" className="btn btn-amber">
      {label}
    </a>
  )
}

function FareBlock({ route, fare, heading }: { route: RoutePage; fare: RouteFare | null; heading: string }) {
  if (!fare) {
    return (
      <div className="surface p-4">
        <p className="eyebrow mb-1">{heading}</p>
        <p className="text-sm text-slate">Nothing cached for this kind of ticket right now.</p>
      </div>
    )
  }
  const stops = formatStops(fare.transfers)
  const nights = fare.returnDate ? nightsBetweenDates(fare.departureDate, fare.returnDate) : 0
  return (
    <div className="surface p-4">
      <p className="eyebrow mb-1">{heading}</p>
      <p className="font-mono text-3xl font-semibold tracking-tight text-ink">€{fare.price}</p>
      <p className="mt-1 text-sm text-ink">
        {formatDay(fare.departureDate)}
        {fare.returnDate && ` → ${formatDay(fare.returnDate)}`}
        {nights > 0 && <span className="text-slate"> · {nights} nights</span>}
      </p>
      <p className="mt-1 text-sm text-slate">
        {fare.airlineName || fare.airlineCode || 'Airline not in data'}
        {stops && ` · ${stops}`}
      </p>
      <p className="mt-1 text-xs text-faint">
        <PriceAge seenAt={fare.seenAt} />
      </p>
      <div className="mt-3">
        <BookLink route={route} fare={fare} label="See this fare" />
      </div>
    </div>
  )
}

function MonthTable({ facts }: { facts: RouteFacts }) {
  const rows = facts.byMonth.filter((m) => m.roundTrip || m.oneWay)
  if (rows.length === 0) return null
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Cheapest cached price per month on this route</caption>
        <thead>
          <tr className="border-b border-line text-left font-mono text-xs uppercase tracking-wider text-faint">
            <th scope="col" className="px-4 py-3">Month</th>
            <th scope="col" className="px-4 py-3">Round trip</th>
            <th scope="col" className="px-4 py-3">One way</th>
            <th scope="col" className="px-4 py-3">Cheapest day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.month} className="border-b border-line last:border-0">
              <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-ink">{formatMonth(m.month)}</th>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{m.roundTrip ? `€${m.roundTrip.price}` : <span className="text-faint">—</span>}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{m.oneWay ? `€${m.oneWay.price}` : <span className="text-faint">—</span>}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate">
                {m.roundTrip ? formatShortDate(m.roundTrip.departureDate) : m.oneWay ? formatShortDate(m.oneWay.departureDate) : <span className="text-faint">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function RoutePageView({ params }: { params: Promise<{ route: string }> }) {
  const { route: slug } = await params
  const route = routeBySlug(slug)
  if (!route) notFound()

  const facts = await factsFor(route.origin, route.destination)
  const today = new Date().toISOString().slice(0, 10)
  const name = `${route.originCity} to ${route.destinationCity}`
  const cheapest = facts.cheapestRoundTrip ?? facts.cheapestOneWay
  const bestWeekday = facts.weekdays[0] ?? null
  const otherAirports = sameDestination(route)
  const more = sameOrigin(route).slice(0, 6)
  const directTime = formatMinutes(facts.direct.typicalDirectMinutes)

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Flight routes', path: '/flights' },
    { name: name, path: `/flights/${slug}` },
  ]

  return (
    <>
      {/* Breadcrumbs only: there is no search-engine result type for a flight price, and marking these cached prices up as
          firm offers would claim more than the data says. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <Breadcrumbs
          items={[{ label: 'Home', href: '/' }, { label: 'Flight routes', href: '/flights' }, { label: name, flag: route.countryCode }]}
        />

        <h1 className="h-page mb-2 sm:text-4xl">
          <Flag code={route.countryCode} size="md" className="mr-3 -translate-y-0.5" eager />
          {route.originCity} to {route.destinationCity} flights
        </h1>
        <p className="mb-2 font-mono text-sm text-slate">
          {route.origin} → {route.destination} · {route.destinationCountry}
        </p>
        <p className="mb-8 max-w-2xl text-slate">
          {cheapest ? (
            <>
              The cheapest cached fare we hold for this route is <strong className="font-semibold text-ink">€{cheapest.price}</strong>{' '}
              {cheapest.oneWay ? 'one way' : 'round trip'}, and prices below cover {facts.months.length} months.{' '}
            </>
          ) : (
            <>We hold no cached price for this route right now. </>
          )}
          Every price here comes from our own store of fares the price service has shown, so each one says when it was seen.
        </p>

        <section className="mb-10" aria-labelledby="cheapest">
          <h2 id="cheapest" className="h-section mb-3">Cheapest right now</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FareBlock route={route} fare={facts.cheapestRoundTrip} heading="Round trip" />
            <FareBlock route={route} fare={facts.cheapestOneWay} heading="One way" />
          </div>
          <div className="mt-4 flex flex-wrap items-start gap-2">
            <Link href={`/search?from=${route.origin}&to=${route.destination}`} className="btn btn-outline">
              Search {route.destinationCity} with my own dates →
            </Link>
            <SaveButton search={cleanSearch({ origins: [route.origin], destination: route.destination, oneWay: false, dateMode: 'any' })} />
          </div>
        </section>

        <section className="mb-10" aria-labelledby="by-month">
          <h2 id="by-month" className="h-section mb-1">Month by month</h2>
          <p className="mb-3 text-sm text-slate">The cheapest cached fare of each month we cover.</p>
          <MonthTable facts={facts} />
        </section>

        {Object.keys(facts.roundTripByDay).length + Object.keys(facts.oneWayByDay).length > 0 && (
          <section className="mb-10" aria-labelledby="calendar">
            <h2 id="calendar" className="h-section mb-1">Price calendar</h2>
            <p className="mb-3 text-sm text-slate">
              The cheapest cached round-trip fare per departure day; the cheapest day of each month is marked. Where we hold no
              round-trip fare the one-way price is shown instead.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {facts.months.map((month) => {
                const rt = Object.keys(facts.roundTripByDay).some((d) => d.startsWith(month))
                return (
                  <RouteMonthCalendar
                    key={month}
                    month={month}
                    today={today}
                    prices={rt ? facts.roundTripByDay : facts.oneWayByDay}
                    caption={rt ? 'round trip' : 'one way'}
                  />
                )
              })}
            </div>
          </section>
        )}

        {bestWeekday && facts.weekdays.length > 1 && (
          <section className="mb-10" aria-labelledby="weekdays">
            <h2 id="weekdays" className="h-section mb-1">Cheapest day of the week to fly out</h2>
            <p className="mb-3 text-sm text-slate">
              The cheapest cached one-way fare for each weekday it departs. Round-trip fares are left out here: their price
              belongs to a pair of days, so it says nothing about one weekday.
            </p>
            <ol className="surface divide-y divide-line">
              {facts.weekdays.map((w, i) => (
                <li key={w.day} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <span className={`text-sm ${i === 0 ? 'font-semibold text-ink' : 'text-ink'}`}>
                    {FULL_WEEKDAY[w.day]}
                    {i === 0 && <span className="pill ml-2 align-middle">cheapest</span>}
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="font-mono text-sm text-ink">€{w.cheapest}</span>
                    <span className="ml-2 text-xs text-faint">{w.days === 1 ? '1 day' : `${w.days} days`}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mb-10" aria-labelledby="airlines">
          <h2 id="airlines" className="h-section mb-1">Airlines and direct flights</h2>
          {facts.direct.hasDirect === null ? (
            <p className="mb-3 text-sm text-slate">The cached data does not say how many stops these fares have, so we cannot tell you whether the route is direct.</p>
          ) : facts.direct.hasDirect ? (
            <p className="mb-3 text-sm text-slate">
              This route has direct flights in our store{directTime && <> — a non-stop flight takes about {directTime}</>}
              {facts.direct.cheapestDirect !== null && <>, from €{facts.direct.cheapestDirect} one way or round trip</>}.
              {facts.direct.cheapestWithStops !== null && facts.direct.cheapestDirect !== null && facts.direct.cheapestWithStops < facts.direct.cheapestDirect && (
                <> Fares with a stop start lower, at €{facts.direct.cheapestWithStops}.</>
              )}
            </p>
          ) : (
            <p className="mb-3 text-sm text-slate">
              Every fare we hold for this route has at least one stop
              {facts.direct.cheapestWithStops !== null && <>, from €{facts.direct.cheapestWithStops}</>}. That does not prove no
              airline flies it non-stop, only that our store has no such fare.
            </p>
          )}
          {facts.airlines.length > 0 ? (
            <ul className="surface divide-y divide-line">
              {facts.airlines.map((a) => (
                <li key={a.code} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <span className="text-sm text-ink">
                    {a.name ?? a.code}
                    {a.name && <span className="ml-2 font-mono text-xs text-faint">{a.code}</span>}
                    {a.fliesDirect && <span className="pill ml-2 align-middle">direct</span>}
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-slate">
                    {a.cheapestOneWay !== null && <>one way from €{a.cheapestOneWay}</>}
                    {a.cheapestOneWay !== null && a.cheapestRoundTrip !== null && ' · '}
                    {a.cheapestRoundTrip !== null && <>round trip from €{a.cheapestRoundTrip}</>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate">The cached fares for this route name no airline.</p>
          )}
        </section>

        {otherAirports.length > 0 && (
          <section className="mb-10" aria-labelledby="other-airports">
            <h2 id="other-airports" className="h-section mb-1">{route.destinationCity} from another airport</h2>
            <p className="mb-3 text-sm text-slate">The same city from the other home airports.</p>
            <ul className="flex flex-wrap gap-2">
              {otherAirports.map((r) => (
                <li key={r.slug}>
                  <Link href={`/flights/${r.slug}`} className="btn btn-outline">
                    {r.originCity} → {r.destinationCity}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {more.length > 0 && (
          <section className="mb-10" aria-labelledby="more-routes">
            <h2 id="more-routes" className="h-section mb-3">More routes from {route.originCity}</h2>
            <ul className="flex flex-wrap gap-2">
              {more.map((r) => (
                <li key={r.slug}>
                  <Link href={`/flights/${r.slug}`} className="btn btn-outline">
                    {r.destinationCity}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-sm text-slate">
          {route.destinationSlug && (
            <>
              Planning the trip itself?{' '}
              <Link href={`/destinations/${route.destinationSlug}`} className="underline decoration-line decoration-2 underline-offset-4 hover:decoration-amber">
                {route.destinationCity}: daily costs and hostels
              </Link>
              .{' '}
            </>
          )}
          Prices are cached fares, not live quotes: always check the final price on the booking site. We may earn a commission
          from bookings made through our links.
        </p>
      </div>
    </>
  )
}
