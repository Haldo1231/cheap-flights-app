'use client'

import FareCard from '../../components/FareCard'
import { costOfStayNumbers, type DestInfo } from '../../components/CostOfStay'
import { formatDay, nightsBetweenDates } from '../../lib/format'
import { snapshotFromFare } from '../../lib/trip'
import { tripHref } from '../../lib/tripUrl'
import type { Fare } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

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

export default function FareListContent({ fares, total, p, requestedReturn, info, previewedId, onPreview }: Props) {
  const { oneWay, dateMode } = p
  const { primary, secondary } = splitFares(fares, oneWay)
  const cheapestId = (primary[0] ?? secondary[0])?.id ?? null
  const shownId = previewedId && fares.some((f) => f.id === previewedId) ? previewedId : cheapestId

  function card(fare: Fare, isCheapest: boolean) {
    const nights = fare.inbound ? Math.max(1, nightsBetweenDates(fare.outbound.date, fare.inbound.date)) : 1
    const stay = info ? costOfStayNumbers(info, fare.price, nights) : null
    return (
      <FareCard
        key={fare.id}
        fare={fare}
        isCheapest={isCheapest}
        isPreviewed={fare.id === shownId}
        onPreview={() => onPreview(fare.id)}
        detailsHref={tripHref(p.searchString, p.destination, snapshotFromFare(fare))}
        shareTitle={info?.name}
        stayLine={
          stay && stay.tripTotal !== null
            ? `≈ €${stay.tripTotal} with ${nights} day${nights === 1 ? '' : 's'} of stay costs in ${info?.name}`
            : null
        }
      />
    )
  }

  return (
    <>
      {primary.length === 0 && oneWay && (
        <p className="mb-3 rounded-sm border border-line bg-surface px-4 py-3 text-sm text-slate">
          No one-way fare is cached for this search. Only round-trip fares (which include a return flight) were found,
          shown below.
        </p>
      )}
      {primary.length === 0 && !oneWay && requestedReturn && (
        <p className="mb-3 rounded-sm border border-line bg-surface px-4 py-3 text-sm text-slate">
          No cached fare found for your exact return date ({formatDay(requestedReturn)}). These fares leave on your
          departure day with a different return date:
        </p>
      )}
      {dateMode === 'range' && primary.length > 0 && (
        <p className="mb-3 text-xs text-slate">
          Cached fares found in your date range, cheapest first
          {total > fares.length ? ` (the cheapest ${fares.length} of ${total})` : ''}. Prices are cached and may change —
          always confirm on the booking site.
        </p>
      )}
      {dateMode === 'exact' && primary.length > 1 && (
        <p className="mb-3 text-xs text-slate">
          All cached fares found for this day across your chosen airports, cheapest first. Prices are cached and may
          change on the booking site.
        </p>
      )}

      {primary.length > 0 && <ul className="space-y-3">{primary.map((f, i) => card(f, i === 0))}</ul>}

      {secondary.length > 0 && (
        <section className={primary.length > 0 ? 'mt-8' : ''}>
          {primary.length > 0 && (
            <>
              <h2 className="mb-1 text-sm font-semibold">{oneWay ? 'Round-trip fares (include a return flight)' : 'Other return dates'}</h2>
              <p className="mb-3 text-xs text-slate">
                {oneWay
                  ? 'There is no one-way price for these — the price covers a return flight too.'
                  : `No cached fare for ${requestedReturn ? formatDay(requestedReturn) : 'your return date'} — these leave on your departure day with another return date.`}
              </p>
            </>
          )}
          <ul className="space-y-3">{secondary.map((f, i) => card(f, primary.length === 0 && i === 0))}</ul>
        </section>
      )}
    </>
  )
}
