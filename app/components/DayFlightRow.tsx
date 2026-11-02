import type { Fare } from '../tripTypes'
import { formatDay, formatShortDate } from '../lib/format'
import { isLowCostCarrier } from '../lib/lowCost'
import { priceAgeText } from '../lib/priceAge'

type Props = {
  fare: Fare
  rank: number
  isSelected: boolean
  onSelect: () => void
}

/** One cached flight on a chosen calendar day, as a pickable row. */
export default function DayFlightRow({ fare, rank, isSelected, onSelect }: Props) {
  const leg = fare.outbound
  const airline = leg.airlineName || leg.airlineCode
  const stops = leg.stops === 0 ? 'Direct' : leg.stops ? `${leg.stops} stop${leg.stops === 1 ? '' : 's'}` : null

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink motion-reduce:transition-none ${
        isSelected ? 'border-ink bg-amber-soft shadow-card ring-1 ring-ink' : 'border-line bg-surface hover:border-ink/40 hover:bg-paper'
      }`}
    >
      <div className="min-w-0">
        {rank === 0 && <span className="mb-0.5 inline-block rounded-full bg-amber px-2 py-px font-mono text-[10px] font-semibold uppercase tracking-wide text-deep">Cheapest</span>}
        <p className="text-sm">
          {leg.time && <span className="font-mono text-base font-semibold tabular-nums text-ink">{leg.time} </span>}
          <span className="font-semibold text-ink">{formatDay(leg.date)}</span>
          {!leg.time && <span className="text-slate"> · time not in cached data</span>}
          <span className="font-mono text-slate"> · {leg.origin} → {leg.destination}</span>
        </p>
        <p className="text-xs text-slate">
          {airline ? <span className="font-medium text-ink">{airline}</span> : 'airline not in cached data'}
          {isLowCostCarrier(leg.airlineCode) ? ' · Low-cost' : ''}
          {stops ? ` · ${stops}` : ''}
          {fare.inbound ? ` · round-trip fare, one price for both flights (returns ${formatShortDate(fare.inbound.date)})` : ''}
          <span suppressHydrationWarning>{` · ${priceAgeText(fare.seenAt)}`}</span>
        </p>
      </div>
      <p className="shrink-0 font-mono text-lg font-semibold tabular-nums text-ink">€{fare.price}</p>
    </button>
  )
}
