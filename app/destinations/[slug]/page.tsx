import Flag from '../../components/Flag'
import { airportCountryCode } from '../../airportsList'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { supabase } from '../../supabase'
import { getCheapestFare } from '../../flightSources'
import { HOME_AIRPORTS } from '../../homeAirports'
import FareCard from '../../components/FareCard'
import Breadcrumbs from '../../components/Breadcrumbs'
import HostelList, { type Hostel } from '../../components/HostelList'
import { CostSidebar, CostMobileBar, type DestInfo } from '../../components/CostOfStay'
import { pageMetadata } from '../../lib/seo'
import type { OgCard } from '../../lib/ogCard'
import { formatShortDate } from '../../lib/format'

const TRIP_DAYS = 3

type Destination = DestInfo & {
  slug: string
  airport_code: string | null
  description: string | null
}

const getDestination = cache(async (slug: string): Promise<Destination | null> => {
  const { data } = await supabase.from('destinations').select('*').eq('slug', slug).maybeSingle()
  return (data as Destination | null) ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const destination = await getDestination(slug)
  if (!destination) return { title: 'Destination not found' }
  // The preview card shows the cheapest cached fare, when there is one.
  let card: OgCard | null = null
  let price: number | null = null
  try {
    const fare = destination.airport_code
      ? await getCheapestFare(HOME_AIRPORTS, destination.airport_code, process.env.TRAVELPAYOUTS_TOKEN)
      : null
    price = fare?.price ?? null
    card = {
      title: destination.name,
      eyebrow: 'From 5 airports',
      price,
      note: fare ? (fare.inbound ? 'round trip' : 'one way') : '',
      line: fare ? `${formatShortDate(fare.outbound.date)}${fare.inbound ? ` → ${formatShortDate(fare.inbound.date)}` : ''}` : 'Flights, stay costs and hostels',
      cc: airportCountryCode(destination.airport_code) ?? '',
    }
  } catch {
    card = null
  }
  return pageMetadata({
    title: `${destination.name}: cheap flights and trip cost`,
    previewTitle: price !== null ? `${destination.name} from €${price}` : `${destination.name}: cheap flights`,
    description: `Cheapest cached flights to ${destination.name} from Bratislava, Vienna, Budapest, Košice and Prague, plus an estimate of daily costs and hostel picks.`,
    path: `/destinations/${slug}`,
    card,
  })
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const destination = await getDestination(slug)

  if (!destination) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="h-page mb-3">Destination not found</h1>
        <p className="mb-6 text-slate">We don&apos;t have a page for that destination.</p>
        <Link href="/deals" className="btn btn-primary btn-lg">
          See this week&apos;s deals
        </Link>
      </div>
    )
  }

  const { data: hostelRows } = await supabase.from('hostels').select('*').eq('destination_slug', slug)
  const hostels = (hostelRows as Hostel[] | null) ?? []

  const fare = destination.airport_code
    ? await getCheapestFare(HOME_AIRPORTS, destination.airport_code, process.env.TRAVELPAYOUTS_TOKEN)
    : null

  const costProps = {
    destinationName: destination.name,
    info: destination,
    flightPrice: fare ? fare.price : null,
    flightNote: fare?.kind === 'round-trip' ? 'round trip, both flights' : 'one way',
    days: TRIP_DAYS,
    dates: null,
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 pb-24 lg:pb-12">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Deals', href: '/deals' }, { label: destination.name }]} />
      <h1 className="h-page mb-2 sm:text-4xl">
        <Flag code={airportCountryCode(destination.airport_code)} size="md" className="mr-3 -translate-y-0.5" eager />
        {destination.name}
      </h1>
      {destination.description && <p className="mb-8 max-w-2xl text-slate">{destination.description}</p>}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <section className="mb-10">
            <h2 className="h-section mb-1">Cheapest cached flight</h2>
            <p className="mb-3 text-sm text-slate">
              The lowest cached fare to {destination.name} across your five home airports, with no date chosen.
            </p>
            {fare ? (
              <ul>
                <FareCard fare={fare} isCheapest shareHref={`/destinations/${slug}`} shareTitle={destination.name} />
              </ul>
            ) : (
              <div className="surface p-4 text-sm text-slate">
                No cached flight price for this route right now. Cached data is sparse for small routes — try the
                search with your own dates.
              </div>
            )}
            <Link
              href={destination.airport_code ? `/search?to=${destination.airport_code}` : '/search'}
              className="btn btn-outline mt-4"
            >
              Search {destination.name} with my dates →
            </Link>
          </section>

          <section>
            <h2 className="h-section mb-3">Recommended hostels</h2>
            <HostelList hostels={hostels} />
          </section>
        </div>

        <div className="hidden lg:block lg:w-72 lg:flex-shrink-0">
          <CostSidebar {...costProps} />
        </div>
      </div>

      <CostMobileBar {...costProps} />
    </div>
  )
}
