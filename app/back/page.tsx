import { Suspense } from 'react'
import BackClient from './BackClient'
import { FareListSkeleton, PageHeaderSkeleton } from '../components/Skeleton'
import { pageMetadata } from '../lib/seo'

export const metadata = pageMetadata({
  title: 'Find a flight back',
  description: 'Cached one-way flights back from your destination to your home airports, with the combined trip price.',
  path: '/back',
  noindex: true,
})

export default function BackPage() {
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
        <BackClient />
      </Suspense>
    </div>
  )
}
