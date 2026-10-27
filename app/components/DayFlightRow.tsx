import type { Fare } from '../tripTypes'
import { formatDay, formatShortDate } from '../lib/format'
import { isLowCostCarrier } from '../lib/lowCost'

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
      className={`flex w-full items-center justify-between gap-3 rounded-sm border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14213D] ${
        isSelected ? 'border-2 border-[#14213D] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white hover:bg-[#FBF9F4]'
      }`}
    >
      <div className="min-w-0">
        {rank === 0 && <span className="block font-mono text-[10px] font-semibold uppercase tracking-wide text-[#b86e00]">Cheapest</span>}
        <p className="text-sm">
          <span className="font-semibold text-[#14213D]">{formatDay(leg.date)}</span>
          {leg.time ? (
            <span className="font-mono tabular-nums text-[#14213D]"> · {leg.time}</span>
          ) : (
            <span className="text-[#5B6472]"> · time not in cached data</span>
          )}
          <span className="font-mono text-[#5B6472]"> · {leg.origin} → {leg.destination}</span>
        </p>
        <p className="text-xs text-[#5B6472]">
          {airline ? <span className="text-[#14213D]">{airline}</span> : 'airline not in cached data'}
          {isLowCostCarrier(leg.airlineCode) ? ' · Low-cost' : ''}
          {stops ? ` · ${stops}` : ''}
          {fare.inbound ? ` · priced with a return on ${formatShortDate(fare.inbound.date)}` : ''}
        </p>
      </div>
      <p className="shrink-0 font-mono text-lg font-semibold tabular-nums text-[#14213D]">€{fare.price}</p>
    </button>
  )
}
