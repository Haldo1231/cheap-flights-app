import type { Metadata } from 'next'
import { Suspense } from 'react'
import ResultsRouter from './ResultsRouter'
import { PageHeaderSkeleton, FareListSkeleton } from '../components/Skeleton'
import { pageMetadata } from '../lib/seo'
import type { OgCard } from '../lib/ogCard'
import { countryShareCard, destinationShareCard } from '../lib/shareData'
import { filtersOnly } from '../lib/resultsUrl'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value[0] : value
    if (v !== undefined) params.set(key, v)
  }
  const anywhere = params.get('anywhere') === 'true'
  const where = anywhere ? 'Anywhere' : params.get('destination')

  // A shared link to one country or one city: the preview shows its name and cached price.
  let card: OgCard | null = null
  try {
    if (anywhere && params.get('country')) card = await countryShareCard(params)
    else if (!anywhere && params.get('destination')) card = await destinationShareCard(params)
  } catch {
    card = null // the preview falls back to the plain brand picture
  }

  const price = card?.price != null ? ` from €${card.price}` : ''
  return pageMetadata({
    title: card ? `${card.title}${price}` : where ? `Flights to ${where}` : 'Flight results',
    previewTitle: card ? `${card.title}${price}${card.line ? ` · ${card.line}` : ''}` : undefined,
    description: card
      ? `Cheap flights to ${card.title}${price} (${card.eyebrow}). Cached prices with airlines, times and the total trip cost.`
      : 'Cached flight prices from Bratislava, Vienna, Budapest, Košice and Prague, with airlines, times and the total cost of the trip.',
    card,
    noindex: true,
  })
}

/** The price data an Anywhere screen will ask for, so the browser can start loading it as soon as
 * the page arrives instead of after the page's scripts have started. Must be the exact address
 * the screen requests (see AnywhereView and CountryView), or the early copy is simply not used. */
function dataAddressFor(params: URLSearchParams): string | null {
  if (params.get('anywhere') !== 'true' || params.get('destination')) return null
  const filters = filtersOnly(params)
  const country = params.get('country')
  if (country) {
    filters.set('country', country)
    return `/api/anywhere-country?${filters.toString()}`
  }
  return `/api/anywhere-by-country?${filters.toString()}`
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value[0] : value
    if (v !== undefined) params.set(key, v)
  }
  const address = dataAddressFor(params)
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 pb-28 lg:pb-12">
      {/* React moves this hint into <head>. */}
      {address && <link rel="preload" href={address} as="fetch" crossOrigin="anonymous" />}
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <FareListSkeleton count={3} />
          </>
        }
      >
        <ResultsRouter />
      </Suspense>
    </div>
  )
}
