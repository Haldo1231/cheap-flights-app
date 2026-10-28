'use client'

import Link from 'next/link'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="eyebrow mb-4">Oops</p>
      <h1 className="h-page mb-4 sm:text-4xl">Something went wrong</h1>
      <p className="mb-8 text-slate">This page hit an unexpected error. Try again, or head back home.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-primary btn-lg"
        >
          Try again
        </button>
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
