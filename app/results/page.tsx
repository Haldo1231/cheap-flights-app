import type { Metadata } from 'next'
import { Suspense } from 'react'
import ResultsRouter from './ResultsRouter'
import { PageHeaderSkeleton, FareListSkeleton } from '../components/Skeleton'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const sp = await searchParams
  const one = (key: string) => (Array.isArray(sp[key]) ? sp[key][0] : sp[key])
  const where = one('anywhere') === 'true' ? 'Anywhere' : one('destination')
  return {
    title: where ? `Flights to ${where} — cheapflights` : 'Flight results — cheapflights',
    description:
      'Cached flight prices from Bratislava, Vienna, Budapest, Košice and Prague, with airlines, times and the total cost of the trip.',
    robots: { index: false },
  }
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
