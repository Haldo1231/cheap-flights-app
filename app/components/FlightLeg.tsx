import type { Leg } from '../tripTypes'
import { formatDay, formatStops } from '../lib/format'
import { isLowCostCarrier } from '../lib/lowCost'

function LowCostBadge() {
  return (
    <span className="ml-1.5 inline-block rounded-sm border border-[#E5E1D8] bg-[#FBF9F4] px-1.5 py-px align-middle font-mono text-[10px] uppercase tracking-wide text-[#5B6472]">
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
      <div className="flex items-baseline gap-3 py-1">
        <span className="w-12 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#5B6472]">
          {label}
        </span>
        <p className="min-w-0 flex-1 text-sm text-[#5B6472]">
          <span className="font-semibold text-[#14213D]">{formatDay(leg.date)}</span>
          {leg.time ? (
            <span className="font-mono tabular-nums text-[#14213D]"> · {leg.time}</span>
          ) : (
            <span> · time n/a</span>
          )}
          <span className="font-mono"> · {leg.origin}→{leg.destination}</span>
          {' · '}
          {airline ? <span className="text-[#14213D]">{airline}</span> : <span>airline n/a</span>}
          {lowCost && <LowCostBadge />}
          {stops ? ` · ${stops}` : ''}
        </p>
        {price !== null && (
          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[#14213D]">€{price}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 w-16 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#5B6472]">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-semibold text-[#14213D]">{formatDay(leg.date)}</span>
          {leg.time ? (
            <span className="font-mono text-sm tabular-nums text-[#14213D]">{leg.time}</span>
          ) : (
            !hideMissing && <span className="text-xs text-[#5B6472]">time not in cached data</span>
          )}
          <span className="font-mono text-sm text-[#5B6472]">
            {leg.origin} → {leg.destination}
          </span>
        </p>
        {(airline || stops || !hideMissing) && (
          <p className="mt-0.5 text-sm text-[#5B6472]">
            {airline ? <span className="text-[#14213D]">{airline}</span> : !hideMissing && <span>airline not in cached data</span>}
            {lowCost && <LowCostBadge />}
            {stops ? `${airline || !hideMissing ? ' · ' : ''}${stops}` : ''}
          </p>
        )}
        {searchLinkLabel && (
          <a
            href={leg.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-1 inline-block text-xs font-medium text-[#14213D] underline decoration-[#FCA311] decoration-2 underline-offset-2 hover:text-[#8a5a00]"
          >
            {searchLinkLabel}
          </a>
        )}
      </div>
      {price !== null && (
        <p className="shrink-0 font-mono text-base font-semibold tabular-nums text-[#14213D]">€{price}</p>
      )}
    </div>
  )
}
