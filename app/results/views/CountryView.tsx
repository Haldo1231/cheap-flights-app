'use client'

import { useState } from 'react'
import Breadcrumbs from '../../components/Breadcrumbs'
import SearchSummary from '../../components/SearchSummary'
import AnywhereCityRow from '../../components/AnywhereCityRow'
import ScrollTopOnArrive from '../../components/ScrollTopOnArrive'
import DrillLink from '../../components/DrillLink'
import { RowListSkeleton } from '../../components/Skeleton'
import { useJson } from '../../lib/useJson'
import { withParams } from '../../lib/resultsUrl'
import type { AnywhereCity } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

type CountryResponse = {
  country: { code: string; name: string } | null
  cities: AnywhereCity[]
  unmatchedCities: AnywhereCity[]
  totalCities: number
  checkedCities: number
}

export default function CountryView({ p }: { p: ResultsParams }) {
  const [retry, setRetry] = useState(0)
  const params = new URLSearchParams(p.filterString)
  params.set('country', p.country)
  const { data, loading, error } = useJson<CountryResponse>(`/api/anywhere-country?${params.toString()}`, retry)

  const countryName = data?.country?.name ?? p.country
  const anywhereHref = withParams(p.searchString, { country: null })
  const cityHref = (code: string) => withParams(p.searchString, { anywhere: null, country: null, destination: code, fromCountry: p.country })

  return (
    <div className="view-in">
      <ScrollTopOnArrive />
      <Breadcrumbs
        items={[
          { label: 'Search', href: '/search' },
          { label: 'Anywhere', href: anywhereHref },
          { label: loading ? 'Country' : countryName },
        ]}
      />
      <h1 className="mb-2 text-2xl font-semibold">{loading ? 'Checking every city…' : countryName}</h1>
      <SearchSummary params={new URLSearchParams(p.filterString)} from={p.originList.join(', ')} />

      {loading && <RowListSkeleton count={4} label="Checking the cities in this country" />}

      {!loading && error && (
        <div role="alert" className="rounded-sm border border-danger-line bg-danger-bg px-5 py-4">
          <p className="mb-3 text-ink">Something went wrong loading this country.</p>
          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !data?.country && (
        <div className="rounded-sm border border-line bg-white px-5 py-6">
          <p className="mb-2 font-semibold">We have no cached prices for this country right now</p>
          <p className="mb-3 text-sm text-slate">The cache changes over time, so it may have dropped out of the list.</p>
          <DrillLink href={anywhereHref} className="text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            ← Back to all countries
          </DrillLink>
        </div>
      )}

      {!loading && !error && data?.country && (
        <>
          <p className="mb-4 text-xs text-slate">
            Checked {data.checkedCities} of {data.totalCities} destination{data.totalCities === 1 ? '' : 's'} against your
            filters, cheapest first. Prices are cached and may change on the booking site.
          </p>

          {data.cities.length === 0 && (
            <div className="mb-6 rounded-sm border border-line bg-white px-5 py-4">
              <p className="mb-1 font-semibold">No day matches your filters in {countryName}</p>
              <p className="text-sm text-slate">
                Try more weekdays, a wider range of nights, another month, or another home airport.
              </p>
            </div>
          )}

          {data.cities.length > 0 && (
            <ol className="space-y-3">
              {data.cities.map((city, i) => (
                <li key={city.code}>
                  <AnywhereCityRow city={city} href={cityHref(city.code)} highlight={i === 0} />
                </li>
              ))}
            </ol>
          )}

          {data.unmatchedCities.length > 0 && (
            <section className="mt-8" aria-labelledby="no-match-cities">
              <h2 id="no-match-cities" className="mb-1 text-sm font-semibold">
                No matching day in these cities
              </h2>
              <p className="mb-3 text-xs text-slate">They have cached flights, just not on your days. You can still open them.</p>
              <ul className="space-y-2">
                {data.unmatchedCities.map((city) => (
                  <li key={city.code}>
                    <AnywhereCityRow city={city} href={cityHref(city.code)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
