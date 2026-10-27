import type { Metadata } from 'next'
import { Suspense } from 'react'
import SearchForm from './SearchForm'

export const metadata: Metadata = {
  title: 'Search cheap flights',
  description:
    'Compare cached flight prices from Bratislava, Vienna, Budapest, Košice and Prague. Search one city, or anywhere, with exact dates, a whole month, or a date range.',
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-6 py-12 text-slate">Loading the search form…</div>}>
      <SearchForm />
    </Suspense>
  )
}
