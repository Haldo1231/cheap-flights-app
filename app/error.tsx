'use client'

import Link from 'next/link'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="num mb-4 text-sm text-slate">Oops</p>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mb-8 text-slate">This page hit an unexpected error. Try again, or head back home.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-12 items-center rounded-sm bg-ink px-6 font-medium text-white transition-colors hover:bg-ink-hover"
        >
          Try again
        </button>
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
