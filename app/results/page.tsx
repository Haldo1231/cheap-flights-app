import type { Metadata } from 'next'
import { Suspense } from 'react'
import ResultsRouter from './ResultsRouter'
import { PageHeaderSkeleton, FareListSkeleton } from '../components/Skeleton'
import { pageMetadata } from '../lib/seo'
import type { OgCard } from '../lib/ogCard'
import { countryShareCard, destinationShareCard } from '../lib/shareData'

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

export default function ResultsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 pb-28 lg:pb-12">
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
