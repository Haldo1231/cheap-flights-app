import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="eyebrow mb-4">404</p>
      <h1 className="h-page mb-4 sm:text-4xl">Page not found</h1>
      <p className="mb-8 text-slate">That page doesn&apos;t exist. Try searching for a flight instead.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/search"
          className="btn btn-primary btn-lg"
        >
          Search flights
        </Link>
        <Link
          href="/"
          className="btn btn-outline btn-lg"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
