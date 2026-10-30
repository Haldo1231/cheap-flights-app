import type { Fare } from '../tripTypes'
import { formatDay } from '../lib/format'
import { olderOf } from '../lib/priceAge'
import FlightLeg from './FlightLeg'
import DrillLink from './DrillLink'
import PriceAge from './PriceAge'

type Props = {
  oneWay: boolean
  /** Chosen outbound flight, as a fare whose `outbound` leg is the flight. */
  outbound: Fare | null
  /** Chosen return flight (a fare from the destination back to a home airport). */
  inbound: Fare | null
  outDate: string | null
  backDate: string | null
  /** True while the flights of a chosen day are still loading. */
  outLoading?: boolean
  backLoading?: boolean
  detailsHref: string | null
  /** The trip's total from the one-price rule (monthTripPrice); null = no exact total. */
  total: number | null
  /** True when the outbound fare is a round-trip fare that already pays for the picked return day. */
  returnIncluded: boolean
}

/** Why two picked flights have no exact total, or null when there is nothing to explain. */
function noTotalReason(outbound: Fare | null, inbound: Fare | null): string | null {
  if (outbound?.kind === 'round-trip' && outbound.inbound) {
    return `The cached fare for ${formatDay(outbound.outbound.date)} is a round-trip fare that returns on ${formatDay(outbound.inbound.date)}, so it cannot be added to a separate return flight. Pick ${formatDay(outbound.inbound.date)} as the return day, or another outbound day.`
  }
  if (inbound?.kind === 'round-trip') {
    return 'The cached fare for the return day is a round-trip fare, so it cannot be used as a single return flight.'
  }
  return null
}

/** The flights picked so far in Whole Month mode, with what is still missing. */
export default function TripSummary({
  oneWay,
  outbound,
  inbound,
  outDate,
  backDate,
  outLoading,
  backLoading,
  detailsHref,
  total,
  returnIncluded,
}: Props) {
  // A round-trip fare that covers the picked return day: its own return flight is the "Back" flight.
  const backLeg = returnIncluded ? outbound?.inbound ?? null : inbound?.outbound ?? null
  const reason = total === null && !oneWay && outbound && inbound ? noTotalReason(outbound, inbound) : null
  const foundAt = oneWay || returnIncluded ? outbound?.foundAt ?? null : olderOf(outbound?.foundAt, inbound?.foundAt)
  const outdated = !!(outbound?.outdated || (!returnIncluded && inbound?.outdated))

  return (
    <section aria-label="Your trip" className="mb-4 border-b border-line pb-4">
      <p className="mb-1 font-semibold text-ink">Your trip</p>
      <div className="divide-y divide-line">
        {outbound ? (
          <FlightLeg compact label="Out" leg={outbound.outbound} price={returnIncluded ? null : outbound.price} />
        ) : (
          <p className="py-2 text-xs text-slate">
            {outLoading ? `Loading flights on ${formatDay(outDate)}…` : 'Outbound: pick a departure day in the calendar.'}
          </p>
        )}
        {!oneWay &&
          (backLeg ? (
            <FlightLeg compact label="Back" leg={backLeg} price={returnIncluded ? null : inbound?.price ?? null} />
          ) : (
            <p className={`py-2 text-xs ${backDate && !backLoading ? 'text-danger' : 'text-slate'}`}>
              {backLoading
                ? `Loading flights on ${formatDay(backDate)}…`
                : backDate
                ? `No cached return price for ${formatDay(backDate)} — this is not a complete round trip.`
                : 'Return: pick a return day in the calendar.'}
            </p>
          ))}
      </div>
      {total !== null ? (
        <>
          <p className="mt-2 text-sm font-semibold">
            Flights total <span className="font-mono tabular-nums">€{total}</span>
            {returnIncluded && <span className="font-normal text-slate"> · one price for both flights</span>}
          </p>
          <p className="mt-0.5 text-xs">
            <PriceAge foundAt={foundAt} outdated={outdated} />
          </p>
        </>
      ) : reason ? (
        <p className="mt-2 text-xs text-danger">{reason}</p>
      ) : (
        !oneWay && <p className="mt-2 text-xs text-slate">The total appears once both flights have a cached price.</p>
      )}
      {detailsHref && (
        <DrillLink
          href={detailsHref}
          className="btn btn-primary mt-3"
        >
          Trip details →
        </DrillLink>
      )}
    </section>
  )
}
