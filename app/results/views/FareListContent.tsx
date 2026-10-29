'use client'

import FareCard from '../../components/FareCard'
import BudgetBadge from '../../components/BudgetBadge'
import type { DestInfo } from '../../components/CostOfStay'
import { affordableText, compareEstimates, estimateTrip, type TripEstimate } from '../../lib/budget'
import { levelLabel } from '../../lib/budget'
import { formatDay, nightsBetweenDates } from '../../lib/format'
import { snapshotFromFare } from '../../lib/trip'
import { tripHref } from '../../lib/tripUrl'
import type { Fare } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'
import BudgetEmpty from '../BudgetEmpty'

type Props = {
  fares: Fare[]
  total: number
  p: ResultsParams
  requestedReturn: string | null
  info: DestInfo | null
  previewedId: string | null
  onPreview: (id: string) => void
}

/** Splits fares into "what you asked for" and "other return dates / round-trip
 * only", so a fare is never shown under a label that does not fit it. */
export function splitFares(fares: Fare[], oneWay: boolean) {
  const primary = oneWay ? fares.filter((f) => f.kind === 'one-way') : fares.filter((f) => f.returnMatchesRequest !== false)
  const secondary = oneWay ? fares.filter((f) => f.kind === 'round-trip') : fares.filter((f) => f.returnMatchesRequest === false)
  return { primary, secondary }
}

/** Nights the stay estimate counts for a fare (a one-way fare, or a same-day return, counts 1 day). */
function fareNights(fare: Fare): number {
  return fare.inbound ? nightsBetweenDates(fare.outbound.date, fare.inbound.date) : 1
}

/** Everything the list and the cost panel need to agree on: the two groups of fares in the order they
 * are shown, each fare's estimate, and the fare the cost panel shows by default. With a budget the
 * order is "within budget first, cheapest total first"; without one it is cheapest flight first. */
export function arrangeFares(fares: Fare[], p: ResultsParams, info: DestInfo | null) {
  const { oneWay, budget, level, withinOnly } = p
  const estimates = new Map<string, TripEstimate>()
  for (const f of fares) estimates.set(f.id, estimateTrip({ flight: f.price, nights: fareNights(f), info, level, budget }))
  const est = (f: Fare) => estimates.get(f.id) as TripEstimate

  const { primary, secondary } = splitFares(fares, oneWay)
  const order = (group: Fare[]) => (budget === null ? group : [...group].sort((a, b) => compareEstimates(est(a), est(b))))
  const keep = (group: Fare[]) => (withinOnly ? group.filter((f) => est(f).status === 'within') : group)

  const shownPrimary = keep(order(primary))
  const shownSecondary = keep(order(secondary))
  const cheapestId = (primary[0] ?? secondary[0])?.id ?? null
  const defaultFare = shownPrimary[0] ?? shownSecondary[0] ?? null
  const withinCount = fares.filter((f) => est(f).status === 'within').length
  return { estimates, shownPrimary, shownSecondary, cheapestId, defaultFare, withinCount, primaryCount: primary.length }
}

export default function FareListContent({ fares, total, p, requestedReturn, info, previewedId, onPreview }: Props) {
  const { oneWay, dateMode, budget, level } = p
  const { estimates, shownPrimary, shownSecondary, cheapestId, defaultFare, withinCount, primaryCount } = arrangeFares(fares, p, info)
  const shownId = previewedId && [...shownPrimary, ...shownSecondary].some((f) => f.id === previewedId) ? previewedId : defaultFare?.id ?? null
  const nothingVisible = shownPrimary.length === 0 && shownSecondary.length === 0

  function card(fare: Fare) {
    const stay = estimates.get(fare.id) as TripEstimate
    const days = stay.days
    const place = info?.name ?? 'this city'
    return (
      <FareCard
        key={fare.id}
        fare={fare}
        isCheapest={fare.id === cheapestId}
        isPreviewed={fare.id === shownId}
        onPreview={() => onPreview(fare.id)}
        detailsHref={tripHref(p.searchString, p.destination, snapshotFromFare(fare))}
        shareTitle={info?.name}
        stayLine={
          stay.total !== null
            ? `≈ €${stay.total} with ${days} day${days === 1 ? '' : 's'} of stay costs in ${place}${level !== 'middle' ? ` (${levelLabel(level)})` : ''}`
            : null
        }
        budgetNote={
          budget !== null ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              <BudgetBadge estimate={stay} />
              {affordableText(stay, place, fare.kind === 'one-way', budget) && (
                <span className="font-normal text-slate">{affordableText(stay, place, fare.kind === 'one-way', budget)}</span>
              )}
            </span>
          ) : null
        }
      />
    )
  }

  // Cheapest total among the fares that have cost data (for the "raise your budget" advice).
  const totals = Array.from(estimates.values()).flatMap((e) => (e.total !== null ? [e.total] : []))
  const cheapestTotal = totals.length > 0 ? Math.min(...totals) : null
  const noData = budget !== null && fares.length > 0 && totals.length === 0
  const ultraHelps =
    budget !== null &&
    fares.some((f) => estimateTrip({ flight: f.price, nights: fareNights(f), info, level: 'ultra', budget }).status === 'within')

  return (
    <>
      {budget !== null && (
        <p className="mb-3 text-sm text-slate" aria-live="polite">
          {noData ? (
            <>No cost data for {info?.name ?? 'this destination'}: flight prices only, nothing is counted as within your €{budget} budget.</>
          ) : (
            <>
              <span className="font-semibold text-ink">
                {withinCount} of {fares.length}
              </span>{' '}
              fare{fares.length === 1 ? '' : 's'} fit your €{budget} budget ({levelLabel(level)} style, flights plus stay).
            </>
          )}
        </p>
      )}

      {budget !== null && nothingVisible && <BudgetEmpty p={p} cheapestTotal={cheapestTotal} ultraHelps={ultraHelps} noData={noData} noun="fares" />}

      {shownPrimary.length === 0 && primaryCount === 0 && oneWay && !nothingVisible && (
        <p className="mb-3 rounded-sm border border-line bg-surface px-4 py-3 text-sm text-slate">
          No one-way fare is cached for this search. Only round-trip fares (which include a return flight) were found,
          shown below.
        </p>
      )}
      {primaryCount === 0 && !oneWay && requestedReturn && !nothingVisible && (
        <p className="mb-3 rounded-sm border border-line bg-surface px-4 py-3 text-sm text-slate">
          No cached fare found for your exact return date ({formatDay(requestedReturn)}). These fares leave on your
          departure day with a different return date:
        </p>
      )}
      {dateMode === 'range' && shownPrimary.length > 0 && (
        <p className="mb-3 text-xs text-slate">
          Cached fares found in your date range, {budget !== null ? 'within-budget ones first, then cheapest total' : 'cheapest first'}
          {total > fares.length ? ` (the cheapest ${fares.length} of ${total})` : ''}. Prices are cached and may change —
          always confirm on the booking site.
        </p>
      )}
      {dateMode === 'exact' && shownPrimary.length > 1 && (
        <p className="mb-3 text-xs text-slate">
          All cached fares found for this day across your chosen airports, {budget !== null ? 'within-budget ones first, then cheapest total' : 'cheapest first'}.
          Prices are cached and may change on the booking site.
        </p>
      )}

      {shownPrimary.length > 0 && <ul className="space-y-3">{shownPrimary.map((f) => card(f))}</ul>}

      {shownSecondary.length > 0 && (
        <section className={shownPrimary.length > 0 ? 'mt-8' : ''}>
          {primaryCount > 0 && (
            <>
              <h2 className="mb-1 text-sm font-semibold">{oneWay ? 'Round-trip fares (include a return flight)' : 'Other return dates'}</h2>
              <p className="mb-3 text-xs text-slate">
                {oneWay
                  ? 'There is no one-way price for these — the price covers a return flight too.'
                  : `No cached fare for ${requestedReturn ? formatDay(requestedReturn) : 'your return date'} — these leave on your departure day with another return date.`}
              </p>
            </>
          )}
          <ul className="space-y-3">{shownSecondary.map((f) => card(f))}</ul>
        </section>
      )}
    </>
  )
}
