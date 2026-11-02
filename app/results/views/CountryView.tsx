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
import WeekdayFilterBox from '../WeekdayFilterBox'
import BudgetBox from '../BudgetBox'
import ReturnAirportSwitch from '../../components/ReturnAirportSwitch'
import JawStatus from '../../components/JawStatus'
import { jawCityRows, useAnywhereJaw } from '../../lib/anywhereJaw'
import { vsRoundTrip } from '../../components/DifferentAirportLine'
import BudgetEmpty from '../BudgetEmpty'
import { RowListSkeleton } from '../../components/Skeleton'
import { useJson } from '../../lib/useJson'
import { withParams } from '../../lib/resultsUrl'
import { useDestinationCosts } from '../../lib/useDestinationCosts'
import { estimateTrip, groupByBudget, levelLabel, tripNights, type TripEstimate } from '../../lib/budget'
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
  const params = new URLSearchParams(p.dataString)
  params.set('country', p.country)
  const { data, loading: pricesLoading, error } = useJson<CountryResponse>(`/api/anywhere-country?${params.toString()}`, retry)
  const { costs, loading: costsLoading } = useDestinationCosts(p.budget !== null)
  const loading = pricesLoading || (p.budget !== null && costsLoading)
  const { budget, level, withinOnly } = p

  const estimateOf = (city: AnywhereCity, forLevel = level): TripEstimate =>
    estimateTrip({
      flight: city.trip?.price ?? 0,
      nights: city.trip && !p.oneWay ? tripNights(city.trip) : null,
      info: costs[city.code],
      level: forLevel,
      budget,
    })
  // "Fly back to a different airport": a second request. The round-trip lists stay exactly as they are (same airport,
  // cheapest first); the cities that have a trip back to ANOTHER home airport get their own list below them, cheapest
  // trip first. A city with only a different-airport trip is listed there, not under "no matching day".
  const jawOn = p.openJaw
  const jaw = useAnywhereJaw(p.dataString, jawOn, p.country)
  const jawReady = jawOn && !jaw.loading && !jaw.error
  const cities = data?.cities ?? []
  const allJawRows = jawReady ? jawCityRows([...cities, ...(data?.unmatchedCities ?? [])], jaw.trips) : []
  const jawCodes = new Set(allJawRows.map((r) => r.city.code))
  const unmatchedCities = (data?.unmatchedCities ?? []).filter((c) => !jawCodes.has(c.code))
  // The same city, but with the different-airport trip as its trip (what its row and its budget estimate are about).
  const jawRows = allJawRows
    .map(({ city, extra }) => ({ extra, city: { ...city, origin: extra.trip.outbound.origin, trip: extra.trip } as AnywhereCity, roundTripPrice: city.trip?.price ?? null }))
    .filter((row) => !withinOnly || estimateOf(row.city).status === 'within')
  const groups = budget !== null ? groupByBudget(cities, (c) => estimateOf(c)) : null
  const totals = groups ? cities.flatMap((c) => (estimateOf(c).total !== null ? [estimateOf(c).total as number] : [])) : []
  const cheapestTotal = totals.length > 0 ? Math.min(...totals) : null
  const ultraHelps = groups !== null && cities.some((c) => estimateOf(c, 'ultra').status === 'within')

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
      {p.openJawAllowed && (
        <ReturnAirportSwitch
          className="mb-4"
          on={p.openJaw}
          onChange={(on) => p.setParams({ openJaw: on ? 'true' : null })}
          description="Keep the round trips, and list the trips that leave from one of your airports and come back to another of BTS, VIE, BUD, KSC or PRG (two one-way tickets) below them."
        />
      )}
      {jawOn && <JawStatus loading={jaw.loading} error={jaw.error} found={jaw.found} noun="cities" />}
      <WeekdayFilterBox p={p} />
      <BudgetBox p={p} />

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

          {cities.length === 0 && (
            <div className="surface mb-6 px-5 py-4">
              <p className="mb-1 font-semibold">
                {allJawRows.length > 0 ? `No round trip from one airport matches your filters in ${countryName}` : `No day matches your filters in ${countryName}`}
              </p>
              <p className="text-sm text-slate">
                {allJawRows.length > 0
                  ? 'The trips that come back to a different airport are listed below.'
                  : 'Try more weekdays, a wider range of nights, another month, or another home airport.'}
              </p>
            </div>
          )}

          {cities.length > 0 && !groups && (
            <ol className="space-y-3">
              {cities.map((city, i) => (
                <li key={city.code}>
                  <AnywhereCityRow city={city} href={cityHref(city.code)} highlight={i === 0} />
                </li>
              ))}
            </ol>
          )}

          {cities.length > 0 && groups && (
            <>
              <p className="mb-4 text-sm text-slate" aria-live="polite">
                <span className="font-semibold text-ink">
                  {groups.within.length} of {cities.length}
                </span>{' '}
                cit{cities.length === 1 ? 'y fits' : 'ies fit'} your €{budget} budget ({levelLabel(level)} style: flight plus stay, an estimate). Ranked by total cost.
              </p>
              {groups.within.length === 0 && (
                <BudgetEmpty p={p} cheapestTotal={cheapestTotal} ultraHelps={ultraHelps} noData={groups.over.length === 0 && groups.nodata.length > 0} noun="cities" />
              )}
              {groups.within.length > 0 && (
                <section aria-labelledby="within-cities">
                  <h2 id="within-cities" className="mb-2 text-base font-semibold">
                    Within your budget
                  </h2>
                  <ol className="space-y-3">
                    {groups.within.map((city, i) => (
                      <li key={city.code}>
                        <AnywhereCityRow city={city} href={cityHref(city.code)} highlight={i === 0} estimate={estimateOf(city)} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {!withinOnly && groups.over.length > 0 && (
                <section className="mt-8" aria-labelledby="over-cities">
                  <h2 id="over-cities" className="mb-1 text-base font-semibold">
                    Over your budget
                  </h2>
                  <p className="mb-3 text-xs text-slate">These cost more than €{budget} in total, cheapest first.</p>
                  <ol className="space-y-3">
                    {groups.over.map((city) => (
                      <li key={city.code}>
                        <AnywhereCityRow city={city} href={cityHref(city.code)} estimate={estimateOf(city)} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {!withinOnly && groups.nodata.length > 0 && (
                <section className="mt-8" aria-labelledby="nodata-cities">
                  <h2 id="nodata-cities" className="mb-1 text-base font-semibold">
                    No cost data
                  </h2>
                  <p className="mb-3 text-xs text-slate">
                    We have no cost-of-stay numbers for these cities, so only the flight price is shown and they are not counted as within budget.
                  </p>
                  <ol className="space-y-3">
                    {groups.nodata.map((city) => (
                      <li key={city.code}>
                        <AnywhereCityRow city={city} href={cityHref(city.code)} estimate={estimateOf(city)} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}

          {jawRows.length > 0 && (
            <section className="mt-8" aria-labelledby="jaw-cities">
              <h2 id="jaw-cities" className="mb-1 text-base font-semibold">
                Fly back to a different airport
              </h2>
              <p className="mb-3 text-xs text-slate">
                Out from one of your airports, back to another of BTS, VIE, BUD, KSC or PRG: two separate one-way tickets, each at its own cached
                price. Cheapest first. The round trips above are not changed.
              </p>
              <ol className="space-y-3">
                {jawRows.map(({ city, extra, roundTripPrice }, i) => (
                  <li key={city.code}>
                    <AnywhereCityRow
                      city={city}
                      href={cityHref(city.code)}
                      highlight={i === 0}
                      estimate={budget !== null ? estimateOf(city) : null}
                      note={extra.difference !== null && roundTripPrice !== null ? `${vsRoundTrip(extra.difference)} (round trip from the same airport: €${roundTripPrice})` : 'No round trip from the same airport on your days to compare with.'}
                    />
                  </li>
                ))}
              </ol>
            </section>
          )}

          {unmatchedCities.length > 0 && (
            <section className="mt-8" aria-labelledby="no-match-cities">
              <h2 id="no-match-cities" className="mb-1 text-sm font-semibold">
                No matching day in these cities
              </h2>
              <p className="mb-3 text-xs text-slate">They have cached flights, just not on your days. You can still open them.</p>
              <ul className="space-y-2">
                {unmatchedCities.map((city) => (
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
