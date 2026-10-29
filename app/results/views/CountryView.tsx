'use client'

import { useState } from 'react'
import { preconnect } from 'react-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import SearchSummary from '../../components/SearchSummary'
import AnywhereCityRow from '../../components/AnywhereCityRow'
import ScrollTopOnArrive from '../../components/ScrollTopOnArrive'
import DrillLink from '../../components/DrillLink'
import CountryPhoto, { PhotoCredit } from '../../components/CountryPhoto'
import ShareButton from '../../components/ShareButton'
import { RowListSkeleton } from '../../components/Skeleton'
import { useJson } from '../../lib/useJson'
import { withParams } from '../../lib/resultsUrl'
import type { CountryImage } from '../../lib/countryImage'
import type { AnywhereCity } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

type CountryResponse = {
  country: { code: string; name: string; image?: CountryImage | null } | null
  cities: AnywhereCity[]
  unmatchedCities: AnywhereCity[]
  totalCities: number
  checkedCities: number
}

export default function CountryView({ p }: { p: ResultsParams }) {
  preconnect('https://images.unsplash.com')
  const [retry, setRetry] = useState(0)
  const [photoFailed, setPhotoFailed] = useState(false)
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
          { label: loading ? 'Country' : countryName, flag: p.country },
        ]}
      />
      <div className="relative mb-4 h-40 overflow-hidden rounded-lg bg-deep sm:h-52">
        <CountryPhoto
          code={p.country}
          image={data?.country?.image}
          failed={photoFailed}
          onFail={() => setPhotoFailed(true)}
          sizes="(min-width: 1024px) 960px, 100vw"
          eager
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        <h1 className="absolute inset-x-0 bottom-0 p-4 text-2xl font-semibold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.45)] sm:p-6 sm:text-3xl">
          {loading ? 'Checking every city…' : countryName}
        </h1>
        {data?.country && (
          <ShareButton
            title={countryName}
            text={`${countryName} — cheap flights found on cheapflights`}
            variant="round"
            className="absolute bottom-3 right-3 z-10"
          />
        )}
        {data?.country?.image && !photoFailed && (
          <PhotoCredit
            image={data.country.image}
            className="absolute right-2 top-2 max-w-[calc(100%-1rem)] rounded-full bg-black/55 px-2.5 text-white backdrop-blur-sm"
          />
        )}
      </div>
      <SearchSummary params={new URLSearchParams(p.filterString)} from={p.originList.join(', ')} />

      {loading && <RowListSkeleton count={4} label="Checking the cities in this country" />}

      {!loading && error && (
        <div role="alert" className="rounded-sm border border-danger-line bg-danger-bg px-5 py-4">
          <p className="mb-3 text-ink">Something went wrong loading this country.</p>
          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="btn btn-primary"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !data?.country && (
        <div className="surface px-5 py-6">
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
            <div className="surface mb-6 px-5 py-4">
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
