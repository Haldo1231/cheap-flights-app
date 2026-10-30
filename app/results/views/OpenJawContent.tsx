'use client'

import FlightLeg from '../../components/FlightLeg'
import DrillLink from '../../components/DrillLink'
import BudgetBadge from '../../components/BudgetBadge'
import PriceAge from '../../components/PriceAge'
import type { DestInfo } from '../../components/CostOfStay'
import { affordableText, compareEstimates, estimateTrip, levelLabel, type TripEstimate } from '../../lib/budget'
import { nightsBetweenDates } from '../../lib/format'
import { snapshotFromLegs } from '../../lib/trip'
import { tripHref } from '../../lib/tripUrl'
import type { CompareResponse, OpenJawCombo } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'
import BudgetEmpty from '../BudgetEmpty'

export type OpenJawResponse = Extract<CompareResponse, { openJaw: true }>

const BOOK_BUTTON = 'btn btn-amber'

/** The combinations in the order they are shown, with each one's budget estimate. With a budget:
 * within budget first (cheapest total first); without one: cheapest flights first (as delivered). */
export function arrangeCombos(combos: OpenJawCombo[], p: ResultsParams, info: DestInfo | null) {
  const { budget, level, withinOnly } = p
  const estimate = (c: OpenJawCombo): TripEstimate =>
    estimateTrip({ flight: c.total, nights: nightsBetweenDates(c.outbound.date, c.inbound.date), info, level, budget })
  const rows = combos.map((combo) => ({ combo, estimate: estimate(combo) }))
  if (budget !== null) rows.sort((a, b) => compareEstimates(a.estimate, b.estimate))
  const shown = withinOnly ? rows.filter((r) => r.estimate.status === 'within') : rows
  return { rows, shown, withinCount: rows.filter((r) => r.estimate.status === 'within').length }
}

/** Fly out from one airport and back to another. Each flight has its own cached
 * price; a trip with a missing leg is never shown as a complete round trip. */
export default function OpenJawContent({ data, p, info }: { data: OpenJawResponse; p: ResultsParams; info: DestInfo | null }) {
  const { destination, budget, level } = p
  const { rows, shown, withinCount } = arrangeCombos(data.results, p, info)
  const totals = rows.flatMap((r) => (r.estimate.total !== null ? [r.estimate.total] : []))
  const cheapestTotal = totals.length > 0 ? Math.min(...totals) : null
  const noData = budget !== null && rows.length > 0 && totals.length === 0
  const ultraHelps = budget !== null && data.results.some((c) => estimateTrip({ flight: c.total, nights: nightsBetweenDates(c.outbound.date, c.inbound.date), info, level: 'ultra', budget }).status === 'within')
  const nothing = data.results.length === 0 && !data.missingOutbound && !data.missingReturn

  return (
    <div>
      {nothing && (
        <p className="rounded-sm border border-line bg-surface px-4 py-3 text-sm text-slate">
          No cached prices found for this search.
        </p>
      )}
      {data.missingOutbound && (
        <p className="mb-3 rounded-sm border border-line bg-surface px-4 py-3 text-sm text-slate">
          No cached one-way outbound price found from your airports to {destination}, so no complete trip can be built.
        </p>
      )}
      {data.missingReturn && !data.missingOutbound && (
        <div role="status" className="mb-3 rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-sm text-ink">
          No cached one-way return price found from {destination} to your airports — these are NOT complete round trips. Outbound
          flights we did find:
        </div>
      )}

      {data.outboundOnly.length > 0 && (
        <ul className="mb-4 space-y-3">
          {data.outboundOnly.map((leg) => (
            <li key={`${leg.origin}-${leg.date}-${leg.price}`} className="surface px-4 py-2">
              <FlightLeg label="Outbound" leg={leg} price={leg.price} />
              <a href={leg.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={`${BOOK_BUTTON} mb-2`}>
                Book outbound →
              </a>
            </li>
          ))}
        </ul>
      )}

      {budget !== null && data.results.length > 0 && (
        <p className="mb-3 text-sm text-slate" aria-live="polite">
          {noData ? (
            <>No cost data for {info?.name ?? 'this destination'}: flight prices only, nothing is counted as within your €{budget} budget.</>
          ) : (
            <>
              <span className="font-semibold text-ink">
                {withinCount} of {rows.length}
              </span>{' '}
              combination{rows.length === 1 ? '' : 's'} fit your €{budget} budget ({levelLabel(level)} style, flights plus stay).
            </>
          )}
        </p>
      )}
      {budget !== null && data.results.length > 0 && shown.length === 0 && (
        <BudgetEmpty p={p} cheapestTotal={cheapestTotal} ultraHelps={ultraHelps} noData={noData} noun="combinations" />
      )}

      {shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map(({ combo, estimate }, i) => (
            <li
              key={`${combo.outbound.origin}-${combo.inbound.destination}-${combo.total}-${i}`}
              className={`rounded-lg border bg-surface shadow-card transition-shadow duration-200 hover:shadow-lift motion-reduce:transition-none ${i === 0 ? 'border-amber ring-1 ring-amber' : 'border-line'}`}
            >
              <DrillLink
                href={tripHref(p.searchString, destination, snapshotFromLegs(combo.outbound, combo.inbound))}
                className="block rounded-t-lg px-4 pb-1 pt-4 transition-colors hover:bg-paper/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink sm:px-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {i === 0 && (
                      <span className="mb-1 inline-block rounded-full bg-amber px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-deep">
                        Cheapest combo
                      </span>
                    )}
                    <p className="font-mono text-sm text-slate">
                      {combo.outbound.origin} → {destination} → {combo.inbound.destination}
                    </p>
                  </div>
                  <p className="font-mono text-3xl font-semibold leading-none tabular-nums">€{combo.total}</p>
                </div>
                {budget !== null && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <BudgetBadge estimate={estimate} />
                    {estimate.total !== null && <span className="text-slate">≈ €{estimate.total} with {estimate.days} day{estimate.days === 1 ? '' : 's'} of stay</span>}
                    {affordableText(estimate, info?.name ?? destination, false, budget) && <span className="text-slate">{affordableText(estimate, info?.name ?? destination, false, budget)}</span>}
                  </div>
                )}
                <div className="mt-2 divide-y divide-line">
                  <FlightLeg label="Outbound" leg={combo.outbound} price={combo.outbound.price} />
                  <FlightLeg label="Return" leg={combo.inbound} price={combo.inbound.price} />
                </div>
                <p className="mt-1 text-xs text-slate">
                  Two one-way prices added together. Outbound: <PriceAge seenAt={combo.outbound.seenAt} />. Return: <PriceAge seenAt={combo.inbound.seenAt} />.
                </p>
              </DrillLink>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-2 sm:px-5">
                <a href={combo.outbound.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={BOOK_BUTTON}>
                  Book outbound →
                </a>
                <a href={combo.inbound.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={BOOK_BUTTON}>
                  Book return →
                </a>
                <DrillLink
                  href={tripHref(p.searchString, destination, snapshotFromLegs(combo.outbound, combo.inbound))}
                  className="btn btn-outline"
                >
                  Trip details →
                </DrillLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
