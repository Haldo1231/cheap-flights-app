'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** Filters that sit above the results: open on wide screens, folded away on
 * phones so the results are not pushed below the fold. A one-line summary
 * shows what is active either way. */
export default function FilterDisclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true
  )

  return (
    <details open={wide} className="surface group mb-6">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="font-semibold text-ink">Weekday filters</span>
          {summary && <span className="ml-2 text-slate">{summary}</span>}
        </span>
        <span aria-hidden="true" className="shrink-0 text-slate transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-line px-4 pb-3 pt-4">{children}</div>
    </details>
  )
}
