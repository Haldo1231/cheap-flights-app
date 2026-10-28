'use client'

import FlightLeg from '../../components/FlightLeg'
import DrillLink from '../../components/DrillLink'
import { snapshotFromLegs } from '../../lib/trip'
import { tripHref } from '../../lib/tripUrl'
import type { CompareResponse } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

export type OpenJawResponse = Extract<CompareResponse, { openJaw: true }>

const BOOK_BUTTON = 'btn btn-amber'

/** Fly out from one airport and back to another. Each flight has its own cached
 * price; a trip with a missing leg is never shown as a complete round trip. */
export default function OpenJawContent({ data, p }: { data: OpenJawResponse; p: ResultsParams }) {
  const { destination } = p
  const nothing = data.results.length === 0 && !data.missingOutbound && !data.missingReturn

  return (
    <div>
      {nothing && (
        <p className="rounded-sm border border-line bg-white px-4 py-3 text-sm text-slate">
          No cached prices found for this search.
        </p>
      )}
      {data.missingOutbound && (
        <p className="mb-3 rounded-sm border border-line bg-white px-4 py-3 text-sm text-slate">
          No cached outbound price found from your airports to {destination}, so no complete trip can be built.
        </p>
      )}
      {data.missingReturn && !data.missingOutbound && (
        <div role="status" className="mb-3 rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-sm text-ink">
          No cached return price found from {destination} to your airports — these are NOT complete round trips. Outbound
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

      {data.results.length > 0 && (
        <ul className="space-y-3">
          {data.results.map((combo, i) => (
            <li
              key={`${combo.outbound.origin}-${combo.inbound.destination}-${combo.total}-${i}`}
              className={`rounded-lg border bg-white shadow-card transition-shadow duration-200 hover:shadow-lift motion-reduce:transition-none ${i === 0 ? 'border-amber ring-1 ring-amber' : 'border-line'}`}
            >
              <DrillLink
                href={tripHref(p.searchString, destination, snapshotFromLegs(combo.outbound, combo.inbound))}
                className="block rounded-t-lg px-4 pb-1 pt-4 transition-colors hover:bg-paper/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink sm:px-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {i === 0 && (
                      <span className="mb-1 inline-block rounded-full bg-amber px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide">
                        Cheapest combo
                      </span>
                    )}
                    <p className="font-mono text-sm text-slate">
                      {combo.outbound.origin} → {destination} → {combo.inbound.destination}
                    </p>
                  </div>
                  <p className="font-mono text-3xl font-semibold leading-none tabular-nums">€{combo.total}</p>
                </div>
                <div className="mt-2 divide-y divide-line">
                  <FlightLeg label="Outbound" leg={combo.outbound} price={combo.outbound.price} />
                  <FlightLeg label="Return" leg={combo.inbound} price={combo.inbound.price} />
                </div>
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
