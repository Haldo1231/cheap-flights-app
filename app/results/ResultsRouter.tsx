'use client'

import Link from 'next/link'
import { useResultsParams } from './useResultsParams'
import AnywhereView from './views/AnywhereView'
import CountryView from './views/CountryView'
import DestinationView from './views/DestinationView'

/** Picks the screen from the URL:
 *   destination set          -> flights to one city
 *   anywhere + country       -> the cities of one country
 *   anywhere                 -> the list of countries */
export default function ResultsRouter() {
  const p = useResultsParams()

  if (p.destination) return <DestinationView key={p.destination} p={p} />
  if (p.isAnywhere && p.country) return <CountryView key={p.country} p={p} />
  if (p.isAnywhere) return <AnywhereView p={p} />

  return (
    <div className="rounded-sm border border-line bg-white px-5 py-6">
      <p className="mb-2 font-semibold">Where do you want to go?</p>
      <p className="mb-3 text-sm text-slate">This link has no destination. Pick one on the search page.</p>
      <Link href="/search" className="text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
        Go to search →
      </Link>
    </div>
  )
}
