import type { Fare } from '../tripTypes'
import type { MonthSelection } from '../lib/trip'
import { formatDay } from '../lib/format'
import FlightLeg from './FlightLeg'
import DrillLink from './DrillLink'

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
  /** What the picked flights cost together (never counts a flight twice), see monthSelection. */
  selection: MonthSelection
}

/** The flights picked so far in Whole Month mode, with what is still missing. */
export default function TripSummary({ oneWay, outbound, inbound, outDate, backDate, outLoading, backLoading, detailsHref, selection }: Props) {
  const total = selection.total
  const roundTripFare = !oneWay && !!outbound?.inbound

  return (
    <section aria-label="Your trip" className="mb-4 border-b border-line pb-4">
      <p className="mb-1 font-semibold text-ink">Your trip</p>
      <div className="divide-y divide-line">
        {outbound ? (
          <FlightLeg compact label="Out" leg={outbound.outbound} price={roundTripFare ? null : outbound.price} />
        ) : (
          <p className="py-2 text-xs text-slate">
            {outLoading ? `Loading flights on ${formatDay(outDate)}…` : 'Outbound: pick a departure day in the calendar.'}
          </p>
        )}
        {!oneWay &&
          (selection.backLeg ? (
            <FlightLeg compact label="Back" leg={selection.backLeg} price={selection.backIncluded ? null : inbound?.price ?? null} />
          ) : selection.problem ? (
            <p className="py-2 text-xs text-danger">{selection.problem}</p>
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
        <p className="mt-2 text-sm font-semibold">
          Flights total <span className="font-mono tabular-nums">€{total}</span>
          {selection.backIncluded && <span className="block text-xs font-normal text-slate">One round-trip price for both flights.</span>}
        </p>
      ) : (
        !oneWay && !selection.problem && <p className="mt-2 text-xs text-slate">The total appears once both flights have a cached price.</p>
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
