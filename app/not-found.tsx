import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="num mb-4 text-sm text-slate">404</p>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mb-8 text-slate">That page doesn&apos;t exist. Try searching for a flight instead.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/search"
          className="inline-flex min-h-12 items-center rounded-sm bg-ink px-6 font-medium text-white transition-colors hover:bg-ink-hover"
        >
          Search flights
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-sm border border-ink px-6 font-medium text-ink transition-colors hover:bg-ink hover:text-white"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
