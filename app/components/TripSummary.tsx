'use client'

import { useId } from 'react'
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
  /** One-way trip: where "Find a flight back" opens. */
  findBackHref?: string | null
  /** What the picked flights cost together (never counts a flight twice), see monthSelection. */
  selection: MonthSelection
  /** Round trip: the button "Fly back to a different airport". `href` is where it opens (the month calendar of flights back to the
   * other home airports); `note` says what it is based on, or why it can not be offered (no one-way outbound cached). */
  jawBack?: { href: string | null; note: string } | null
  /** Round trip: a round-trip fare for the same two days that costs less than the two one-way tickets picked. Shown next to the total. */
  roundTripAlt?: { fare: Fare; price: number; difference: number } | null
}

/** The flights picked so far in Whole Month mode, with what is still missing. */
export default function TripSummary({ oneWay, outbound, inbound, outDate, backDate, outLoading, backLoading, detailsHref, findBackHref, selection, jawBack, roundTripAlt }: Props) {
  const noteId = useId()
  const total = selection.total
  // The outbound flight shown: the picked fare, or (a flight back that is a ticket of its own) the one-way fare standing in for a round-trip one.
  const shownOut = selection.outFare ?? outbound
  const roundTripFare = !oneWay && !!shownOut?.inbound

  return (
    <section aria-label="Your trip" className="mb-4 border-b border-line pb-4">
      <p className="mb-1 font-semibold text-ink">Your trip</p>
      <div className="divide-y divide-line">
        {shownOut ? (
          <FlightLeg compact label="Out" leg={shownOut.outbound} price={roundTripFare ? null : shownOut.price} searchLinkLabel={roundTripFare ? undefined : 'Book this one-way ticket'} />
        ) : (
          <p className="py-2 text-xs text-slate">
            {outLoading ? `Loading flights on ${formatDay(outDate)}…` : 'Outbound: pick a departure day in the calendar.'}
          </p>
        )}
        {!oneWay &&
          (selection.backLeg ? (
            <FlightLeg compact label="Back" leg={selection.backLeg} price={selection.backIncluded ? null : inbound?.price ?? null} searchLinkLabel={selection.backIncluded ? undefined : 'Book this one-way ticket'} />
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
          {!oneWay && !selection.backIncluded && selection.backLeg && (
            <span className="block text-xs font-normal text-slate">2 one-way tickets, each with its own booking link.</span>
          )}
        </p>
      ) : (
        !oneWay && !selection.problem && <p className="mt-2 text-xs text-slate">The total appears once both flights have a cached price.</p>
      )}
      {roundTripAlt && (
        <p className="mt-2 rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink">
          <span className="font-semibold">Alternative: round-trip fare from {roundTripAlt.fare.outbound.origin}</span>{' '}
          <span className="font-mono tabular-nums">€{roundTripAlt.price}</span>, €{roundTripAlt.difference} less than the two one-way tickets.{' '}
          <a
            href={roundTripAlt.fare.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex min-h-9 items-center font-medium underline decoration-amber decoration-2 underline-offset-2 hover:text-amber-ink"
          >
            Book the round-trip fare →
          </a>
        </p>
      )}
      {detailsHref && (
        <DrillLink
          href={detailsHref}
          className="btn btn-primary mt-3"
        >
          Trip details →
        </DrillLink>
      )}
      {findBackHref && (
        <DrillLink href={findBackHref} className="btn btn-outline mt-2 ml-2">
          Find a flight back →
        </DrillLink>
      )}
      {jawBack && (
        <div className="mt-3 border-t border-line pt-3">
          {jawBack.href ? (
            <DrillLink href={jawBack.href} className="btn btn-outline" aria-describedby={noteId}>
              Fly back to a different airport →
            </DrillLink>
          ) : (
            <button type="button" disabled aria-describedby={noteId} className="btn btn-outline cursor-not-allowed opacity-60">
              Fly back to a different airport →
            </button>
          )}
          <p id={noteId} className="mt-1 text-xs text-slate">
            {jawBack.note}
          </p>
        </div>
      )}
    </section>
  )
}
