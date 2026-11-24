'use client'

import { useMemo, useState } from 'react'
import { preconnect } from 'react-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import SearchSummary from '../../components/SearchSummary'
import WeekdayFilterBox from '../WeekdayFilterBox'
import BudgetBox from '../BudgetBox'
import ReturnAirportSwitch from '../../components/ReturnAirportSwitch'
import JawStatus from '../../components/JawStatus'
import { mixJawIntoCountries, useAnywhereJaw } from '../../lib/anywhereJaw'
import BudgetEmpty from '../BudgetEmpty'
import CountryCard from '../../components/CountryCard'
import DrillLink from '../../components/DrillLink'
import ScrollTopOnArrive from '../../components/ScrollTopOnArrive'
import { CountryGridSkeleton } from '../../components/Skeleton'
import { useJson } from '../../lib/useJson'
import Flag from '../../components/Flag'
import { CompassIcon } from '../../components/Icons'
import { withParams } from '../../lib/resultsUrl'
import { useDestinationCosts } from '../../lib/useDestinationCosts'
import { estimateTrip, groupByBudget, levelLabel, tripNights, type TripEstimate } from '../../lib/budget'
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
  // Country photos come from Unsplash's image server: open that connection while the prices load.
  preconnect('https://images.unsplash.com')
  const [retry, setRetry] = useState(0)
  const { data, loading: pricesLoading, error } = useJson<AnywhereResponse>(`/api/anywhere-by-country?${p.dataString}`, retry)
  // Cost numbers are only needed (and only requested) when a budget is set.
  const { costs, loading: costsLoading } = useDestinationCosts(p.budget !== null)
  const loading = pricesLoading || (p.budget !== null && costsLoading)
  const { budget, level, withinOnly } = p

  // "Fly back to a different airport": asked for in a second request, so the round trips never wait for it. When it
  // arrives, the trips back to another airport are MIXED INTO the same list: each card shows the cheaper of its round
  // trip and its different-airport trip, "from €X" and the order use that price, and the card says which kind of trip it
  // is. Off = no second request and nothing changes. `p.openJaw` is already false for one way and for Anywhere over a
  // whole month, which never asks for it.
  const jawOn = p.openJaw
  const jaw = useAnywhereJaw(p.dataString, jawOn)
  const jawReady = jawOn && !jaw.loading && !jaw.error
  const mixed = useMemo(
    () => (jawReady ? mixJawIntoCountries(data?.countries ?? [], data?.unmatchedCountries ?? [], jaw.trips) : null),
    [jawReady, data, jaw.trips]
  )
  const countries = mixed ? mixed.countries : data?.countries ?? []
  const unmatched = mixed ? mixed.unmatched : data?.unmatchedCountries ?? []
  const first = p.originList[0]

  // With a budget: each country's trip (its cheapest-looking city, checked against your filters) gets a
  // total of flight + stay at the chosen style. A country whose city has no cost data cannot be checked.
  const estimateOf = (c: AnywhereCountry): TripEstimate => {
    const trip = c.verifiedCity?.trip
    return estimateTrip({
      flight: c.price ?? 0,
      nights: trip && !p.oneWay ? tripNights(trip) : null,
      info: c.verifiedCity ? costs[c.verifiedCity.code] : null,
      level,
      budget,
    })
  }
  const groups = budget !== null ? groupByBudget(countries, estimateOf) : null
  const totals = groups ? countries.flatMap((c) => (estimateOf(c).total !== null ? [estimateOf(c).total as number] : [])) : []
  const cheapestTotal = totals.length > 0 ? Math.min(...totals) : null
  const ultraHelps =
    groups !== null &&
    countries.some((c) => {
      const trip = c.verifiedCity?.trip
      return estimateTrip({ flight: c.price ?? 0, nights: trip && !p.oneWay ? tripNights(trip) : null, info: c.verifiedCity ? costs[c.verifiedCity.code] : null, level: 'ultra', budget }).status === 'within'
    })
  const card = (country: AnywhereCountry, i: number, cheapest: boolean) => (
    <CountryCard
      key={country.code}
      country={country}
      href={withParams(p.searchString, { country: country.code })}
      cheapest={cheapest}
      eager={i < 3}
      index={i}
      estimate={budget !== null ? estimateOf(country) : null}
      routeLabel={jawOn}
    />
  )

  return (
    <div className="view-in">
      <ScrollTopOnArrive />
      <Breadcrumbs items={[{ label: 'Search', href: '/search' }, { label: 'Anywhere' }]} />
      <h1 className="h-page mb-2">
        Anywhere from {first}
        {p.originList.length > 1 ? ` +${p.originList.length - 1}` : ''}
      </h1>
      <SearchSummary params={new URLSearchParams(p.filterString)} />

      {p.openJawAllowed && (
        <ReturnAirportSwitch
          className="mb-4"
          on={p.openJaw}
          onChange={(on) => p.setParams({ openJaw: on ? 'true' : null })}
          description="Also look at trips that leave from one of your airports and come back to another of BTS, VIE, BUD, KSC or PRG (two one-way tickets). Each country shows its cheaper trip, round trip or not, and says which it is."
        />
      )}
      {jawOn && <JawStatus loading={jaw.loading} error={jaw.error} found={jaw.found} used={mixed?.used ?? 0} noun="countries" />}
      <WeekdayFilterBox p={p} />
      <BudgetBox p={p} />

      {loading && (
        <>
          <p className="mb-4 text-sm text-slate">Looking at every destination we have cached prices for…</p>
          <CountryGridSkeleton count={6} label="Searching destinations" />
        </>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-sm border border-danger-line bg-danger-bg px-5 py-4">
          <p className="mb-3 text-ink">Something went wrong loading destinations.</p>
          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="btn btn-primary"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && countries.length === 0 && unmatched.length === 0 && (
        <div className="rounded-lg border border-line bg-surface px-5 py-8 text-center sm:px-8">
          <CompassIcon className="mx-auto mb-3 h-10 w-10 text-amber-ink" />
          <p className="mb-2 text-lg font-semibold">No cached destinations for this search</p>
          <p className="mx-auto mb-4 max-w-md text-sm text-slate">
            We have no cached prices from your selected airports yet. Cached data is thin for small airports — loosening
            the search usually helps:
          </p>
          <ul className="mx-auto mb-5 max-w-sm list-disc space-y-1 pl-5 text-left text-sm text-slate">
            <li>add another home airport (Vienna and Budapest have the most data)</li>
            <li>switch to Whole month or a wider date range</li>
          </ul>
          <DrillLink
            href="/search"
            className="btn btn-primary"
          >
            Change my search
          </DrillLink>
        </div>
      )}

      {!loading && !error && countries.length === 0 && unmatched.length > 0 && (
        <div className="mb-6 rounded-lg border border-line bg-surface px-5 py-6 sm:px-8">
          <p className="mb-1 text-lg font-semibold">No country has a day that fits your filters</p>
          <p className="text-sm text-slate">
            Try loosening them: allow more weekdays, a wider range of nights, or another month. The countries below do
            have cached flights, just not on your days.
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

          {countries.length > 0 && !groups && (
            <section aria-labelledby="country-grid-title">
              <h2 id="country-grid-title" className="sr-only">
                Countries, cheapest first
              </h2>
              <ol className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{countries.map((country, i) => card(country, i, i === 0))}</ol>
            </section>
          )}

          {countries.length > 0 && groups && (
            <>
              <p className="mb-4 text-sm text-slate" aria-live="polite">
                <span className="font-semibold text-ink">
                  {groups.within.length} of {countries.length}
                </span>{' '}
                countr{countries.length === 1 ? 'y has' : 'ies have'} a trip within your €{budget} budget ({levelLabel(level)} style: flight plus stay,
                an estimate). Ranked by total cost.
              </p>

              {groups.within.length === 0 && (
                <BudgetEmpty p={p} cheapestTotal={cheapestTotal} ultraHelps={ultraHelps} noData={groups.over.length === 0 && groups.nodata.length > 0} noun="countries" />
              )}

              {groups.within.length > 0 && (
                <section aria-labelledby="within-title">
                  <h2 id="within-title" className="mb-3 text-base font-semibold">
                    Within your budget
                  </h2>
                  <ol className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{groups.within.map((country, i) => card(country, i, i === 0))}</ol>
                </section>
              )}

              {!withinOnly && groups.over.length > 0 && (
                <section className="mt-8" aria-labelledby="over-title">
                  <h2 id="over-title" className="mb-1 text-base font-semibold">
                    Over your budget
                  </h2>
                  <p className="mb-3 text-xs text-slate">These cost more than €{budget} in total, cheapest first.</p>
                  <ol className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{groups.over.map((country, i) => card(country, i + groups.within.length, false))}</ol>
                </section>
              )}

              {!withinOnly && groups.nodata.length > 0 && (
                <section className="mt-8" aria-labelledby="nodata-title">
                  <h2 id="nodata-title" className="mb-1 text-base font-semibold">
                    No cost data
                  </h2>
                  <p className="mb-3 text-xs text-slate">
                    We have no cost-of-stay numbers for these cities, so only the flight price is shown and they are not counted as within budget.
                  </p>
                  <ol className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                    {groups.nodata.map((country, i) => card(country, i + groups.within.length + groups.over.length, false))}
                  </ol>
                </section>
              )}
            </>
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
                      className="block rounded-sm border border-line bg-paper px-4 py-3 text-sm text-slate transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-medium text-ink">
                          <Flag code={c.code} className="mr-2" />
                          {c.name}
                        </span>
                        <span>
                          {c.candidateCityCount} destination{c.candidateCityCount === 1 ? '' : 's'} · check all →
                        </span>
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
