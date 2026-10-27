'use client'

import { useState } from 'react'
import Breadcrumbs from '../../components/Breadcrumbs'
import SearchSummary from '../../components/SearchSummary'
import WeekdayFilterPanel from '../../components/WeekdayFilterPanel'
import FilterDisclosure from '../../components/FilterDisclosure'
import { describeFilters } from '../../lib/searchSummary'
import FlightLeg from '../../components/FlightLeg'
import DrillLink from '../../components/DrillLink'
import ScrollTopOnArrive from '../../components/ScrollTopOnArrive'
import { RowListSkeleton } from '../../components/Skeleton'
import { useJson } from '../../lib/useJson'
import { withParams } from '../../lib/resultsUrl'
import type { AnywhereCountry } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

type AnywhereResponse = {
  countries: AnywhereCountry[]
  unmatchedCountries: AnywhereCountry[]
  checkedCount: number
  totalCandidateCities: number
  totalCandidateCountries: number
}

export default function AnywhereView({ p }: { p: ResultsParams }) {
  const [retry, setRetry] = useState(0)
  const { data, loading, error } = useJson<AnywhereResponse>(`/api/anywhere-by-country?${p.filterString}`, retry)

  const countries = data?.countries ?? []
  const unmatched = data?.unmatchedCountries ?? []
  const first = p.originList[0]

  return (
    <div className="view-in">
      <ScrollTopOnArrive />
      <Breadcrumbs items={[{ label: 'Search', href: '/search' }, { label: 'Anywhere' }]} />
      <h1 className="mb-2 text-2xl font-semibold">
        Anywhere from {first}
        {p.originList.length > 1 ? ` +${p.originList.length - 1}` : ''}
      </h1>
      <SearchSummary params={new URLSearchParams(p.filterString)} />

      {p.dateMode === 'month' && (
        <FilterDisclosure summary={describeFilters(new URLSearchParams(p.filterString))}>
          <WeekdayFilterPanel
            bare
            outDays={p.outDays}
            backDays={p.backDays}
            oneWay={p.oneWay}
            minNights={p.minNights}
            maxNights={p.maxNights}
            onToggleOutDay={p.toggleOutDay}
            onToggleBackDay={p.toggleBackDay}
            onChangeMinNights={(v) => p.setParams({ minNights: v })}
            onChangeMaxNights={(v) => p.setParams({ maxNights: v })}
          />
        </FilterDisclosure>
      )}

      {loading && (
        <>
          <p className="mb-4 text-sm text-slate">Looking at every destination we have cached prices for…</p>
          <RowListSkeleton count={6} label="Searching destinations" />
        </>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-sm border border-danger-line bg-danger-bg px-5 py-4">
          <p className="mb-3 text-ink">Something went wrong loading destinations.</p>
          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && countries.length === 0 && unmatched.length === 0 && (
        <div className="rounded-sm border border-line bg-white px-5 py-6">
          <p className="mb-2 font-semibold">No cached destinations found</p>
          <p className="mb-3 text-sm text-slate">
            We have no cached prices from your selected airports for this search. Cached data is thin for small
            airports — try one of these:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate">
            <li>add another home airport (Vienna and Budapest have the most data)</li>
            <li>switch to Whole month or a wider date range</li>
          </ul>
          <DrillLink href="/search" className="mt-4 inline-block text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            Change my search →
          </DrillLink>
        </div>
      )}

      {!loading && !error && countries.length === 0 && unmatched.length > 0 && (
        <div className="mb-6 rounded-sm border border-line bg-white px-5 py-4">
          <p className="mb-1 font-semibold">No country has a day that matches your filters</p>
          <p className="text-sm text-slate">
            Try loosening them: allow more weekdays, a wider range of nights, or another month. Countries below have
            cached flights, just not on your days.
          </p>
        </div>
      )}

      {!loading && !error && (countries.length > 0 || unmatched.length > 0) && (
        <>
          <p className="mb-4 text-xs text-slate">
            We looked at {data?.totalCandidateCountries} countries and checked the {data?.checkedCount} cheapest-looking
            ones against your filters. Open a country to check all of its cities. Prices are cached and may change on
            the booking site.
          </p>

          {countries.length > 0 && (
            <ol className="space-y-3">
              {countries.map((country, i) => {
                const city = country.verifiedCity
                const trip = city?.trip
                return (
                  <li key={country.code}>
                    <DrillLink
                      href={withParams(p.searchString, { country: country.code })}
                      className="block rounded-sm border border-line bg-white px-4 py-4 transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink sm:px-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                            {country.name}
                            {i === 0 && (
                              <span className="rounded-sm bg-amber px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide">
                                Cheapest
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-slate">
                            {country.candidateCityCount} destination{country.candidateCityCount === 1 ? '' : 's'} found
                            {city ? ` · cheapest match: ${city.name} from ${city.origin}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`font-mono text-2xl font-semibold tabular-nums text-ink ${i === 0 ? 'underline decoration-amber decoration-[3px] underline-offset-[6px]' : ''}`}>from €{country.price}</p>
                          <p className="text-xs text-slate">
                            {trip?.inbound ? (trip.kind === 'fare' ? 'round trip' : 'out + back') : 'one way'}
                          </p>
                        </div>
                      </div>
                      {trip && (
                        <div className="mt-2 divide-y divide-line border-t border-line">
                          <FlightLeg compact label="Out" leg={trip.outbound} price={trip.outbound.price} />
                          {trip.inbound && <FlightLeg compact label="Back" leg={trip.inbound} price={trip.inbound.price} />}
                        </div>
                      )}
                      <p className="mt-2 text-xs font-medium text-ink">See all cities in {country.name} →</p>
                    </DrillLink>
                  </li>
                )
              })}
            </ol>
          )}

          {unmatched.length > 0 && (
            <section className="mt-8" aria-labelledby="no-match">
              <h2 id="no-match" className="mb-1 text-sm font-semibold">
                No matching day found for the cheapest-looking city
              </h2>
              <p className="mb-3 text-xs text-slate">
                These countries have cached flights, but none on your days for that one city. Open a country to check its
                other cities.
              </p>
              <ul className="space-y-2">
                {unmatched.map((c) => (
                  <li key={c.code}>
                    <DrillLink
                      href={withParams(p.searchString, { country: c.code })}
                      className="flex items-center justify-between rounded-sm border border-line bg-paper px-4 py-3 text-sm text-slate transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      <span className="font-medium text-ink">{c.name}</span>
                      <span>
                        {c.candidateCityCount} destination{c.candidateCityCount === 1 ? '' : 's'} · check all →
                      </span>
                    </DrillLink>
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
