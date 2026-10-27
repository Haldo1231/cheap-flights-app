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
  return {
    title: `${destination.name}: cheap flights and trip cost`,
    description: `Cheapest cached flights to ${destination.name} from Bratislava, Vienna, Budapest, Košice and Prague, plus an estimate of daily costs and hostel picks.`,
  }
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const destination = await getDestination(slug)

  if (!destination) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="mb-3 text-2xl font-semibold">Destination not found</h1>
        <p className="mb-6 text-slate">We don&apos;t have a page for that destination.</p>
        <Link href="/deals" className="rounded-sm bg-ink px-5 py-3 font-medium text-white hover:bg-ink-hover">
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
      <h1 className="mb-2 text-3xl font-semibold">{destination.name}</h1>
      {destination.description && <p className="mb-8 max-w-2xl text-slate">{destination.description}</p>}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <section className="mb-10">
            <h2 className="mb-1 text-lg font-semibold">Cheapest cached flight</h2>
            <p className="mb-3 text-sm text-slate">
              The lowest cached fare to {destination.name} across your five home airports, with no date chosen.
            </p>
            {fare ? (
              <ul>
                <FareCard fare={fare} isCheapest />
              </ul>
            ) : (
              <div className="rounded-sm border border-line bg-white p-4 text-sm text-slate">
                No cached flight price for this route right now. Cached data is sparse for small routes — try the
                search with your own dates.
              </div>
            )}
            <Link
              href={destination.airport_code ? `/search?to=${destination.airport_code}` : '/search'}
              className="mt-4 inline-block rounded-sm border border-ink px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Search {destination.name} with my dates →
            </Link>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Recommended hostels</h2>
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
