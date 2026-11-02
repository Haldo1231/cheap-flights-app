'use client'

import { useState } from 'react'
import Flag from '../../components/Flag'
import { airportCountryCode } from '../../airportsList'
import Breadcrumbs, { type Crumb } from '../../components/Breadcrumbs'
import SearchSummary from '../../components/SearchSummary'
import ScrollTopOnArrive from '../../components/ScrollTopOnArrive'
import TripSummary from '../../components/TripSummary'
import DrillLink from '../../components/DrillLink'
import { CostSidebar, CostMobileBar, type DestInfo } from '../../components/CostOfStay'
import { FareListSkeleton, Skeleton } from '../../components/Skeleton'
import { useJson } from '../../lib/useJson'
import { withParams } from '../../lib/resultsUrl'
import { snapshotFromFare, snapshotFromLegs } from '../../lib/trip'
import { backHref, tripHref } from '../../lib/tripUrl'
import { formatShortDate, nightsBetweenDates } from '../../lib/format'
import { AIRPORTS } from '../../airportsList'
import type { CompareResponse } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'
import { useMonthTrip } from './useMonthTrip'
import WeekdayFilterBox from '../WeekdayFilterBox'
import ReturnAirportSwitch from '../../components/ReturnAirportSwitch'
import MonthContent from './MonthContent'
import FareListContent, { arrangeFares } from './FareListContent'
import OpenJawContent, { arrangeCombos } from './OpenJawContent'
import BudgetBox from '../BudgetBox'

type PlaceResponse = { city: { code: string; name: string } | null; country: { code: string; name: string } | null }
type InfoResponse = { destination: DestInfo | null }

const ERROR_BOX = 'rounded-sm border border-danger-line bg-danger-bg px-5 py-4'

function originLabel(codes: string[]) {
  const first = codes[0]
  const name = AIRPORTS.find((a) => a.code === first)?.city ?? first
  return `${name}${codes.length > 1 ? ` +${codes.length - 1}` : ''}`
}

export default function DestinationView({ p }: { p: ResultsParams }) {
  const { destination, dateMode, oneWay, openJaw } = p
  const isMonth = dateMode === 'month'
  const [retry, setRetry] = useState(0)
  const [previewedId, setPreviewedId] = useState<string | null>(null)

  const month = useMonthTrip(p, isMonth)

  const missing =
    (isMonth && !p.departMonth && 'a month') ||
    (dateMode === 'exact' && !p.departDate && 'a departure date') ||
    (dateMode === 'range' && !p.searchParams.get('rangeStart') && 'a start date') ||
    null

  // Ordinary round-trip fares (back to the airport you left from) ...
  const listParams = new URLSearchParams(p.dataString)
  listParams.set('destination', destination)
  listParams.set('openJaw', 'false')
  const compare = useJson<CompareResponse>(!isMonth && !missing ? `/api/compare?${listParams}` : null, retry)
  // ... and, next to them, trips that fly back to a DIFFERENT home airport (exact dates and date range; Whole Month
  // already mixes airports in its calendars).
  const openJawOn = openJaw && !oneWay && (dateMode === 'exact' || dateMode === 'range')
  const jawParams = new URLSearchParams(listParams)
  jawParams.set('openJaw', 'true')
  const jaw = useJson<CompareResponse>(!isMonth && !missing && openJawOn ? `/api/compare?${jawParams}` : null, retry)
  const place = useJson<PlaceResponse>(`/api/place?city=${encodeURIComponent(destination)}`)
  const infoState = useJson<InfoResponse>(`/api/destination-info?code=${encodeURIComponent(destination)}`)

  // While the name loads we show a placeholder, never the bare airport code.
  const cityName = place.loading ? '…' : place.data?.city?.name ?? destination
  const info = infoState.data?.destination ?? null
  const infoReady = !infoState.loading

  // ---- breadcrumbs: where this screen sits in the drill-down ----------------
  const crumbs: Crumb[] = [{ label: 'Search', href: '/search' }]
  const base = { out: null, of: null, back: null, bf: null, destination: null, fromCountry: null }
  if (p.fromCountry) {
    crumbs.push({ label: 'Anywhere', href: withParams(p.searchString, { ...base, anywhere: 'true', country: null }) })
    crumbs.push({
      label: place.loading ? '…' : place.data?.country?.name ?? p.fromCountry,
      href: withParams(p.searchString, { ...base, anywhere: 'true', country: p.fromCountry }),
    })
  }
  crumbs.push({ label: cityName })

  // ---- what the cost panel is about ----------------------------------------
  const compareData = compare.data
  const fares = compareData && !compareData.openJaw ? compareData.results : []
  const openJawData = jaw.data && jaw.data.openJaw ? jaw.data : null

  let flightPrice: number | null = null
  let departDate: string | null = null
  let returnDate: string | null = null
  let flightNote = oneWay ? 'one way' : 'round trip, both flights'

  if (isMonth) {
    flightPrice = month.total
    departDate = month.selectedOutFare?.outbound.date ?? null
    returnDate = oneWay ? null : month.selection.backLeg?.date ?? month.selectedBackFare?.outbound.date ?? null
    flightNote = oneWay ? 'one way' : month.selection.backIncluded ? 'round trip, both flights' : 'outbound + return'
  } else {
    // The fare the panel shows: the one under the pointer, otherwise the first one in the list (the
    // cheapest flight, or with a budget the best one within it), so panel and list always agree.
    const arranged = arrangeFares(fares, p, info)
    const visible = [...arranged.shownPrimary, ...arranged.shownSecondary]
    const shown = visible.find((f) => f.id === previewedId) ?? arranged.defaultFare
    if (shown) {
      flightPrice = shown.price
      departDate = shown.outbound.date
      returnDate = shown.inbound?.date ?? null
      flightNote = `${shown.kind === 'round-trip' ? 'round trip, both flights' : 'one way'}${shown.id === arranged.cheapestId ? ' · cheapest shown' : ''}`
    } else if (openJawOn && openJawData?.results[0]) {
      // No ordinary round trip: the panel shows the best trip back to a different airport.
      const first = arrangeCombos(openJawData.results, p, info).shown[0]?.combo ?? openJawData.results[0]
      flightPrice = first.total
      departDate = first.outbound.date
      returnDate = first.inbound.date
      flightNote = 'two one-way tickets, back to a different airport'
    }
  }

  const stayDays = departDate ? Math.max(1, nightsBetweenDates(departDate, returnDate)) : 1

  const monthDetailsHref =
    isMonth && month.complete && month.selectedOutFare
      ? tripHref(
          p.searchString,
          destination,
          // One round-trip fare (it already includes the way back) opens as one fare; two one-way flights as two priced legs.
          month.selection.backIncluded || (oneWay && month.selectedOutFare.inbound)
            ? snapshotFromFare(month.selectedOutFare)
            : snapshotFromLegs(
                { ...month.selectedOutFare.outbound, price: month.selectedOutFare.price },
                !oneWay && month.selectedBackFare
                  ? { ...month.selectedBackFare.outbound, price: month.selectedBackFare.price }
                  : null
              )
        )
      : null

  // A picked one-way flight (Whole month, one way) can look for a flight back to any home airport.
  const monthBackHref =
    isMonth && oneWay && month.complete && month.selectedOutFare && !month.selectedOutFare.inbound
      ? backHref(p.searchString, destination, snapshotFromFare(month.selectedOutFare))
      : null

  const costProps = {
    destinationName: info?.name ?? cityName,
    info,
    flightPrice,
    flightNote,
    flightPlaceholder: isMonth
      ? !month.selectedOutFare
        ? 'pick a day'
        : !oneWay && !month.selectedBackFare
        ? 'pick a return day'
        : undefined
      : undefined,
    days: stayDays,
    level: p.level,
    budget: p.budget,
    oneWay,
    dates: departDate ? `${formatShortDate(departDate)}${returnDate ? ` → ${formatShortDate(returnDate)}` : ''}` : null,
    summary: isMonth ? (
      <TripSummary
        oneWay={oneWay}
        outbound={month.selectedOutFare}
        inbound={month.selectedBackFare}
        outDate={month.outDate}
        backDate={month.backDate}
        outLoading={month.outLoading}
        backLoading={month.backLoading}
        detailsHref={monthDetailsHref}
        findBackHref={monthBackHref}
        selection={month.selection}
      />
    ) : undefined,
  }

  const listLoading = !isMonth && !missing && (compare.loading || (p.budget !== null && !infoReady))
  const showCost = infoReady && !missing && !(compare.error && !isMonth)

  return (
    <div className="view-in">
      <ScrollTopOnArrive />
      <Breadcrumbs items={crumbs} />
      <h1 className="h-page mb-2">
        {originLabel(p.originList)} →{' '}
        {place.loading ? (
          <Skeleton className="inline-block h-6 w-28 align-middle" />
        ) : (
          <>
            <Flag code={p.fromCountry || airportCountryCode(destination)} size="md" className="mr-2 -translate-y-0.5" eager />
            {cityName}
          </>
        )}
        <span className="ml-2 font-mono text-base font-normal text-slate">{destination}</span>
      </h1>
      <SearchSummary params={new URLSearchParams(p.filterString)} />

      {missing && (
        <div className="surface px-5 py-6">
          <p className="mb-2 font-semibold">Your search is missing {missing}</p>
          <p className="mb-3 text-sm text-slate">Pick it on the search page and we will look up the prices.</p>
          <DrillLink href="/search" className="text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            Back to search →
          </DrillLink>
        </div>
      )}

      {!missing && (
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* No items-start on this row: the cost column must stretch to the full
              height of the results so the sticky card has room to travel. */}
          <div className="min-w-0 flex-1">
            {isMonth && <MonthContent p={p} m={month} info={info} infoReady={infoReady} />}
            {!oneWay && !isMonth && (
              <ReturnAirportSwitch className="mb-4" on={p.openJaw} onChange={(on) => p.setParams({ openJaw: on ? 'true' : null })} />
            )}
            {dateMode === 'range' && <WeekdayFilterBox p={p} />}
            {!isMonth && <BudgetBox p={p} />}

            {listLoading && <FareListSkeleton count={4} label="Searching cached flights" />}

            {!isMonth && !listLoading && compare.error && (
              <div role="alert" className={ERROR_BOX}>
                <p className="mb-3 text-ink">Something went wrong loading results.</p>
                <button
                  type="button"
                  onClick={() => setRetry((n) => n + 1)}
                  className="btn btn-primary"
                >
                  Try again
                </button>
              </div>
            )}

            {!isMonth && !listLoading && !compare.error && fares.length === 0 && !(openJawOn && (jaw.loading || (openJawData?.results.length ?? 0) > 0)) && (
              <div className="surface px-5 py-6">
                <p className="mb-2 font-semibold">No cached prices found for this search</p>
                <p className="mb-3 text-sm text-slate">
                  Cached data is thin for small routes and exact days. Things that usually help:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate">
                  {dateMode === 'range' && (p.outDays.length < 7 || (!oneWay && p.backDays.length < 7)) && (
                    <li>allow more weekdays (your day limits may be hiding cached fares)</li>
                  )}
                  <li>use Whole month or a wider date range instead of one exact day</li>
                  <li>add more home airports (Vienna and Budapest have the most data)</li>
                  <li>try a more popular destination</li>
                </ul>
                <DrillLink href="/search" className="mt-4 inline-block text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
                  Change my search →
                </DrillLink>
              </div>
            )}

            {!isMonth && !listLoading && !compare.error && fares.length > 0 && (
              <FareListContent
                fares={fares}
                total={compareData && !compareData.openJaw ? compareData.total : fares.length}
                p={p}
                requestedReturn={compareData && !compareData.openJaw ? compareData.requestedReturn : null}
                info={info}
                previewedId={previewedId}
                onPreview={setPreviewedId}
              />
            )}

            {openJawOn && !listLoading && (
              <section className="mt-10" aria-labelledby="jaw-title">
                <h2 id="jaw-title" className="mb-1 text-lg font-semibold">
                  Fly back to a different airport
                </h2>
                <p className="mb-3 text-sm text-slate">
                  Out from one of your airports, back to a different one of BTS, VIE, BUD, KSC or PRG (for example out from Bratislava,
                  back to Prague): two separate one-way tickets, each at its own cached price.
                </p>
                {jaw.loading && <FareListSkeleton count={2} label="Looking for trips back to another airport" />}
                {!jaw.loading && jaw.error && (
                  <div role="alert" className={ERROR_BOX}>
                    <p className="mb-3 text-ink">Something went wrong loading these trips.</p>
                    <button type="button" onClick={() => setRetry((n) => n + 1)} className="btn btn-primary">
                      Try again
                    </button>
                  </div>
                )}
                {!jaw.loading && !jaw.error && openJawData && <OpenJawContent data={openJawData} p={p} info={info} />}
              </section>
            )}
          </div>

          {showCost && (
            <div className="hidden lg:block lg:w-72 lg:flex-shrink-0">
              <CostSidebar {...costProps} />
            </div>
          )}
        </div>
      )}

      {showCost && <CostMobileBar {...costProps} />}
    </div>
  )
}
