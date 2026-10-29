import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageHero from '../components/PageHero'
import { Skeleton } from '../components/Skeleton'
import SearchForm from './SearchForm'
import { pageMetadata } from '../lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Search cheap flights',
  description:
    'Compare cached flight prices from Bratislava, Vienna, Budapest, Košice and Prague. Search one city, or anywhere, with exact dates, a whole month, or a date range.',
  path: '/search',
})

/** Same footprint as the first form cards, so the page does not jump when the form arrives. */
function FormPlaceholder() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-8 sm:px-6" role="status" aria-live="polite">
      <span className="sr-only">Loading the search form…</span>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="surface mb-5 p-4 sm:p-5">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-36 !rounded-full" />
            <Skeleton className="h-11 w-32 !rounded-full" />
            <Skeleton className="h-11 w-36 !rounded-full" />
          </div>
          <Skeleton className="mt-4 h-11 w-full" />
        </div>
      ))}
    </div>
  )
}

export default function SearchPage() {
  return (
    <div>
      <PageHero eyebrow="Plan it" title="Compare cheap flights">
        <p>Pick your airports, pick a place (or anywhere), pick your dates. We do the boring part.</p>
      </PageHero>
      <Suspense fallback={<FormPlaceholder />}>
        <SearchForm />
      </Suspense>
    </div>
  )
}
