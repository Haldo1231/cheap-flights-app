import Flag from '../components/Flag'
import ShareButton from '../components/ShareButton'
import { airportCountryCode } from '../airportsList'
import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '../supabase'
import { getAirlineNames } from '../airlines'
import { getCityInfo } from '../geoData'
import { getDayFlights } from '../flightSources'
import { buildBookingLink } from '../aviasalesLink'
import { parseTrip, resultsHrefFromTrip, type TripLegSnapshot, type TripSnapshot } from '../lib/tripUrl'
import { withParams, filtersOnly } from '../lib/resultsUrl'
import { formatDay, formatShortDate, formatNights, nightsBetweenDates } from '../lib/format'
import { pageMetadata } from '../lib/seo'
import type { OgCard } from '../lib/ogCard'
import { tripShareCard } from '../lib/shareData'
import { AIRPORTS } from '../airportsList'
import type { Leg } from '../tripTypes'
import Breadcrumbs, { type Crumb } from '../components/Breadcrumbs'
import FlightLeg from '../components/FlightLeg'
import HostelList, { type Hostel } from '../components/HostelList'
import ScrollTopOnArrive from '../components/ScrollTopOnArrive'
import PriceAge from '../components/PriceAge'
import { CostSidebar, CostMobileBar, type DestInfo } from '../components/CostOfStay'
import { parseBudget, parseLevel } from '../lib/budget'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function toUrlParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value[0] : value
    if (v !== undefined) params.set(key, v)
  }
  return params
}

function cityLabel(code: string) {
  return AIRPORTS.find((a) => a.code === code)?.city ?? code
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = toUrlParams(await searchParams)
  const trip = parseTrip((k) => params.get(k))
  if (!trip) return { title: 'Trip details', robots: { index: false } }
  const place = await getCityInfo(trip.outbound.destination)
  const name = place?.name ?? trip.outbound.destination
  const dates = trip.inbound
    ? `${formatShortDate(trip.outbound.date)} – ${formatShortDate(trip.inbound.date)}`
    : formatShortDate(trip.outbound.date)
  let card: OgCard | null = null
  try {
    card = await tripShareCard(trip)
  } catch {
    card = null
  }
  return pageMetadata({
    title: `${name} trip, ${dates}`,
    previewTitle: `${name} from €${trip.price} · ${dates}`,
    description: `Flights, stay costs and total price for a trip from ${cityLabel(trip.outbound.origin)} to ${name}. Prices are cached and may change.`,
    card,
    noindex: true,
  })
}

function legFrom(s: TripLegSnapshot, names: Map<string, string>): Leg {
  return {
    origin: s.origin,
    destination: s.destination,
    date: s.date,
    time: s.time,
    airlineCode: s.airlineCode,
    airlineName: s.airlineCode ? names.get(s.airlineCode) ?? null : null,
    stops: s.stops,
    bookingUrl: buildBookingLink(s.origin, s.destination, s.date),
  }
}

function MissingTrip() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="h-page mb-3">We can&apos;t open this trip</h1>
      <p className="mb-6 text-slate">
        The link is missing some trip details. Start from the search and pick a flight again.
      </p>
      <Link href="/search" className="btn btn-primary btn-lg">
        Go to search
      </Link>
    </div>
  )
}

const BOOK_BUTTON =
  'inline-block rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-deep transition-colors hover:bg-amber-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export default async function TripPage({ searchParams }: { searchParams: SearchParams }) {
  const rawParams = toUrlParams(await searchParams)
  const trip: TripSnapshot | null = parseTrip((k) => rawParams.get(k))
  if (!trip) return <MissingTrip />

  const token = process.env.TRAVELPAYOUTS_TOKEN
  const destination = trip.outbound.destination
  const homeOut = trip.outbound.origin
  const homeBack = trip.inbound?.destination ?? null

  const [names, place, destRow, outAlt, backAlt] = await Promise.all([
    getAirlineNames([trip.outbound.airlineCode, trip.inbound?.airlineCode]),
    getCityInfo(destination),
    supabase
      .from('destinations')
      .select('name, slug, hostel_avg_price, food_avg_price, transport_avg_price, other_avg_price')
      .eq('airport_code', destination)
      .maybeSingle()
      .then((r) => (r.data as (DestInfo & { slug: string }) | null) ?? null),
    getDayFlights(homeOut, destination, trip.outbound.date, token, { oneWay: true }),
    trip.inbound && homeBack
      ? getDayFlights(destination, homeBack, trip.inbound.date, token, { oneWay: true })
      : Promise.resolve([]),
  ])

  const hostels: Hostel[] = destRow
    ? (((await supabase.from('hostels').select('*').eq('destination_slug', destRow.slug)).data as Hostel[] | null) ?? [])
    : []

  const cityName = place?.name ?? destRow?.name ?? destination
  const nights = trip.inbound ? Math.max(1, nightsBetweenDates(trip.outbound.date, trip.inbound.date)) : 1
  const outLeg = legFrom(trip.outbound, names)
  const backLeg = trip.inbound ? legFrom(trip.inbound, names) : null
  const isFare = trip.kind === 'fare'
  const roundTripLink = trip.inbound
    ? buildBookingLink(homeOut, destination, trip.outbound.date, trip.inbound.date)
    : outLeg.bookingUrl

  // Other cached flights on the same two days (the picked one is left out).
  const sameFlight = (f: { price: number; departureTime: string | null }, price: number | null, time: string | null) =>
    price !== null && f.price === price && f.departureTime === time
  const outOthers = outAlt
    .filter((f) => !sameFlight(f, trip.outbound.price ?? (isFare ? trip.price : null), trip.outbound.time))
    .slice(0, 5)
  const backOthers = backAlt
    .filter((f) => !sameFlight(f, trip.inbound?.price ?? null, trip.inbound?.time ?? null))
    .slice(0, 5)

  // ---- breadcrumbs --------------------------------------------------------
  const filters = filtersOnly(rawParams)
  const fromCountry = rawParams.get('fromCountry')
  const crumbs: Crumb[] = [{ label: 'Search', href: '/search' }]
  const clear = { out: null, of: null, back: null, bf: null, destination: null, fromCountry: null }
  if (fromCountry) {
    crumbs.push({ label: 'Anywhere', href: withParams(filters, { anywhere: 'true' }) })
    crumbs.push({
      label: (await getCountryName(destination, fromCountry)) ?? fromCountry,
      href: withParams(filters, { anywhere: 'true', country: fromCountry, ...clear }),
    })
  }
  crumbs.push({ label: cityName, href: resultsHrefFromTrip(rawParams) })
  crumbs.push({
    label: trip.inbound ? `${formatDay(trip.outbound.date)} → ${formatDay(trip.inbound.date)}` : formatDay(trip.outbound.date),
  })

  const costProps = {
    destinationName: cityName,
    info: destRow,
    flightPrice: trip.price,
    flightNote: isFare && trip.inbound ? 'round trip, both flights' : trip.inbound ? 'outbound + return' : 'one way',
    days: nights,
    // The spending style and budget the visitor chose on the results page travel in the address.
    level: parseLevel(rawParams.get('level')),
    budget: parseBudget(rawParams.get('budget')),
    oneWay: !trip.inbound,
    dates: trip.inbound
      ? `${formatShortDate(trip.outbound.date)} → ${formatShortDate(trip.inbound.date)}`
      : formatShortDate(trip.outbound.date),
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 pb-28 lg:pb-12">
      <div className="view-in">
        <ScrollTopOnArrive />
        <Breadcrumbs items={crumbs} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="h-page mb-1">
            <Flag code={fromCountry || airportCountryCode(destination)} size="md" className="mr-2 -translate-y-0.5" eager />
            {cityName}
            <span className="ml-2 font-mono text-base font-normal text-slate">
              {trip.inbound ? `${formatNights(nights)}` : 'one way'}
            </span>
          </h1>
          <ShareButton
            title={cityName}
            text={`${cityName} from €${trip.price}${trip.inbound ? ' round trip' : ''} — found on cheapflights`}
          />
        </div>
        <p className="mb-6 text-sm text-slate">
          {cityLabel(homeOut)} {trip.inbound ? '⇄' : '→'} {cityName}
          {homeBack && homeBack !== homeOut ? ` (back to ${cityLabel(homeBack)})` : ''} · cached prices, they may change on
          the booking site
        </p>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-8">
            <section aria-labelledby="your-flights" className="surface p-4 sm:p-5">
              <h2 id="your-flights" className="mb-1 text-lg font-semibold">
                Your flights
              </h2>
              <div className="divide-y divide-line">
                <FlightLeg label="Outbound" leg={outLeg} price={isFare ? null : trip.outbound.price} searchLinkLabel={!isFare ? 'Book outbound →' : undefined} />
                {backLeg && (
                  <FlightLeg
                    label="Return"
                    leg={backLeg}
                    price={isFare ? null : trip.inbound?.price ?? null}
                    searchLinkLabel={!isFare ? 'Book return →' : 'Return flight only (one-way search)'}
                  />
                )}
              </div>

              <div className="mt-3 rounded-sm bg-paper px-4 py-3">
                {isFare && trip.inbound ? (
                  <p className="text-sm">
                    <span className="font-mono text-2xl font-semibold tabular-nums">€{trip.price}</span>{' '}
                    <span className="text-slate">round trip for both flights</span>
                    <span className="mt-1 block text-xs text-slate">
                      One cached price for the whole round trip{trip.gate ? ` (found via ${trip.gate})` : ''} — it is not
                      split per flight.
                    </span>
                    <span className="mt-1 block text-xs text-slate first-letter:uppercase">
                      <PriceAge seenAt={trip.seenAt} />
                    </span>
                  </p>
                ) : (
                  <p className="text-sm">
                    <span className="font-mono text-2xl font-semibold tabular-nums">€{trip.price}</span>{' '}
                    <span className="text-slate">
                      {trip.inbound
                        ? `flights: €${trip.outbound.price ?? '?'} out + €${trip.inbound.price ?? '?'} back`
                        : 'one way'}
                    </span>
                    <span className="mt-1 block text-xs text-slate first-letter:uppercase">
                      <PriceAge seenAt={trip.seenAt} />
                    </span>
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {isFare ? (
                  <a href={roundTripLink} target="_blank" rel="noopener noreferrer sponsored" className={BOOK_BUTTON}>
                    {trip.inbound ? 'Book round trip →' : 'Book on Aviasales →'}
                  </a>
                ) : (
                  <>
                    <a href={outLeg.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={BOOK_BUTTON}>
                      Book outbound →
                    </a>
                    {backLeg && (
                      <a href={backLeg.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={BOOK_BUTTON}>
                        Book return →
                      </a>
                    )}
                  </>
                )}
              </div>
            </section>

            {(outOthers.length > 0 || backOthers.length > 0) && (
              <section aria-labelledby="other-flights">
                <h2 id="other-flights" className="mb-1 text-lg font-semibold">
                  Other cached flights on these days
                </h2>
                <p className="mb-3 text-sm text-slate">
                  Each has its own cached price. Open the booking site to check what is available.
                </p>
                {outOthers.length > 0 && (
                  <>
                    <h3 className="mb-1 text-sm font-semibold">
                      {cityLabel(homeOut)} → {cityName} · {formatDay(trip.outbound.date)}
                    </h3>
                    <ul className="mb-5 surface divide-y divide-line px-4">
                      {outOthers.map((f) => (
                        <li key={`${f.price}-${f.departureTime}-${f.gate}`}>
                          <FlightLeg
                            compact
                            label="Out"
                            price={f.price}
                            leg={{
                              origin: f.origin,
                              destination: f.destination,
                              date: f.departureDate,
                              time: f.departureTime,
                              airlineCode: f.airlineCode,
                              airlineName: f.airlineName,
                              stops: f.stops,
                              bookingUrl: f.bookingUrl,
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {backOthers.length > 0 && trip.inbound && (
                  <>
                    <h3 className="mb-1 text-sm font-semibold">
                      {cityName} → {cityLabel(homeBack ?? homeOut)} · {formatDay(trip.inbound.date)}
                    </h3>
                    <ul className="surface divide-y divide-line px-4">
                      {backOthers.map((f) => (
                        <li key={`${f.price}-${f.departureTime}-${f.gate}`}>
                          <FlightLeg
                            compact
                            label="Back"
                            price={f.price}
                            leg={{
                              origin: f.origin,
                              destination: f.destination,
                              date: f.departureDate,
                              time: f.departureTime,
                              airlineCode: f.airlineCode,
                              airlineName: f.airlineName,
                              stops: f.stops,
                              bookingUrl: f.bookingUrl,
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            <section aria-labelledby="stay">
              <h2 id="stay" className="mb-3 text-lg font-semibold">
                Where to stay in {cityName}
              </h2>
              <HostelList hostels={hostels} />
            </section>
          </div>

          <div className="hidden lg:block lg:w-72 lg:flex-shrink-0">
            <CostSidebar {...costProps} />
          </div>
        </div>

        <CostMobileBar {...costProps} />
      </div>
    </div>
  )
}

async function getCountryName(cityCode: string, fallbackCountryCode: string): Promise<string | null> {
  const info = await getCityInfo(cityCode)
  return info && info.country.code === fallbackCountryCode ? info.country.name : null
}
