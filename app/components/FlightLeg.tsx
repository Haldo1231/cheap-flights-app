import type { Leg } from '../tripTypes'
import { formatDay, formatStops } from '../lib/format'
import { isLowCostCarrier } from '../lib/lowCost'

function LowCostBadge() {
  return (
    <span className="inline-block rounded-full border border-line bg-paper px-2 py-px align-middle font-mono text-[10px] uppercase tracking-wide text-slate">
      Low-cost
    </span>
  )
}

type Props = {
  label: string
  leg: Leg
  /** Price of this flight on its own (only when the leg really has its own price). */
  price?: number | null
  /** Text for a small secondary link that searches just this flight. */
  searchLinkLabel?: string
  /** One tight row instead of the roomy two-line layout (for lists of combos). */
  compact?: boolean
  /** Do not repeat "not in cached data" on this leg (the card says it once for all legs). */
  hideMissing?: boolean
}

/** One flight (one direction): date, departure time, route, airline, stops.
 * Anything the cache does not have is said out loud instead of left blank. */
export default function FlightLeg({ label, leg, price = null, searchLinkLabel, compact = false, hideMissing = false }: Props) {
  const airline = leg.airlineName || leg.airlineCode
  const stops = formatStops(leg.stops)
  const lowCost = isLowCostCarrier(leg.airlineCode)

  if (compact) {
    return (
      <div className="flex items-start gap-3 py-1.5">
        <span className="mt-0.5 w-10 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate">
          {label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-semibold text-ink">{formatDay(leg.date)}</span>
            {leg.time ? (
              <span className="font-mono font-semibold tabular-nums text-ink">{leg.time}</span>
            ) : (
              <span className="text-slate">time n/a</span>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate">
            <span className="font-mono">
              {leg.origin}→{leg.destination}
            </span>
            {airline ? <span className="font-medium text-ink">{airline}</span> : <span>airline n/a</span>}
            {lowCost && <LowCostBadge />}
            {stops && <span>{stops}</span>}
          </p>
        </div>
        {price !== null && (
          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink">€{price}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-1 w-16 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {leg.time && <span className="font-mono text-lg font-semibold tabular-nums text-ink">{leg.time}</span>}
          <span className="font-semibold text-ink">{formatDay(leg.date)}</span>
          {!leg.time && !hideMissing && <span className="text-xs text-slate">time not in cached data</span>}
          <span className="font-mono text-sm text-slate">
            {leg.origin} → {leg.destination}
          </span>
        </p>
        {(airline || stops || !hideMissing) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate">
            {airline ? (
              <span className="font-medium text-ink">{airline}</span>
            ) : (
              !hideMissing && <span>airline not in cached data</span>
            )}
            {lowCost && <LowCostBadge />}
            {stops && <span>{stops}</span>}
          </p>
        )}
        {searchLinkLabel && (
          <a
            href={leg.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex min-h-9 items-center text-xs font-medium text-ink underline decoration-amber decoration-2 underline-offset-2 hover:text-amber-ink"
          >
            {searchLinkLabel}
          </a>
        )}
      </div>
      {price !== null && (
        <p className="shrink-0 font-mono text-base font-semibold tabular-nums text-ink">€{price}</p>
      )}
    </div>
  )
}
