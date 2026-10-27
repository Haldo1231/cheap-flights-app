'use client'

import { useId, useState } from 'react'

// Cost-of-stay estimate for a destination, shown next to the flight price.
// Desktop: a card that stays on screen while the page scrolls.
// Mobile: a compact bar fixed to the bottom that opens into the full breakdown.

export type DestInfo = {
  name: string
  hostel_avg_price: number | null
  food_avg_price: number | null
  transport_avg_price: number | null
  other_avg_price: number | null
}

export type CostProps = {
  /** City name (or the airport code when we don't know the name). */
  destinationName: string
  /** Budget numbers for the destination; null = we have none for it yet. */
  info: DestInfo | null
  /** Flights total for the chosen trip, null until a flight is chosen. */
  flightPrice: number | null
  /** What the flight price covers, e.g. "round trip, both flights". */
  flightNote?: string
  /** Days of stay the estimate is for. */
  days: number
  /** Human-readable dates the stay is based on, e.g. "10 Nov → 15 Nov". */
  dates?: string | null
}

export function costOfStayNumbers(info: DestInfo, flightPrice: number | null, days: number) {
  const perDay =
    (info.hostel_avg_price || 0) +
    (info.food_avg_price || 0) +
    (info.transport_avg_price || 0) +
    (info.other_avg_price || 0)
  const stayTotal = perDay * days
  const tripTotal = flightPrice !== null ? flightPrice + stayTotal : null
  return { perDay, stayTotal, tripTotal }
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold text-[#14213D]' : 'text-[#5B6472]'}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums text-[#14213D]">{value}</span>
    </div>
  )
}

export function CostBreakdown({ destinationName, info, flightPrice, flightNote, days, dates }: CostProps) {
  const dayLabel = `${days} day${days === 1 ? '' : 's'}`

  if (!info) {
    return (
      <div className="text-sm">
        <p className="mb-1 font-semibold text-[#14213D]">Trip cost</p>
        <p className="mb-3 text-[#5B6472]">
          We don&apos;t have cost-of-stay numbers for {destinationName} yet, so only the flights can be shown.
        </p>
        <Row label="Flights" value={flightPrice !== null ? `€${flightPrice}` : 'pick a flight'} strong />
        {flightNote && flightPrice !== null && <p className="mt-1 text-xs text-[#5B6472]">{flightNote}</p>}
      </div>
    )
  }

  const { perDay, stayTotal, tripTotal } = costOfStayNumbers(info, flightPrice, days)

  return (
    <div className="text-sm">
      <p className="font-semibold text-[#14213D]">Trip cost in {info.name}</p>
      <p className="mb-3 text-xs text-[#5B6472]">
        {dayLabel}
        {dates ? ` · ${dates}` : ''}
      </p>

      <div className="space-y-1">
        <Row label="Hostel / night" value={`€${info.hostel_avg_price ?? 0}`} />
        <Row label="Food / day" value={`€${info.food_avg_price ?? 0}`} />
        <Row label="Transport / day" value={`€${info.transport_avg_price ?? 0}`} />
        <Row label="Other / day" value={`€${info.other_avg_price ?? 0}`} />
      </div>

      <div className="mt-3 space-y-1 border-t border-[#E5E1D8] pt-3">
        <Row label="Per day" value={`€${perDay}`} />
        <Row label={`Stay · ${dayLabel}`} value={`€${stayTotal}`} strong />
        <Row label="Flights" value={flightPrice !== null ? `€${flightPrice}` : 'pick a flight'} strong />
        {flightNote && flightPrice !== null && <p className="text-xs text-[#5B6472]">{flightNote}</p>}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-[#14213D] pt-3">
        <span className="font-semibold text-[#14213D]">Flights + stay</span>
        <span className="font-mono text-xl font-semibold tabular-nums text-[#14213D]">
          {tripTotal !== null ? `€${tripTotal}` : '—'}
        </span>
      </div>
      <p className="mt-2 text-xs text-[#5B6472]">Rough daily averages and cached flight prices — estimates, not quotes.</p>
    </div>
  )
}

/** Desktop card. It must sit inside a parent that is as tall as the page
 * content next to it (a stretched flex/grid child) -- a sticky element can
 * only travel inside its parent. */
export function CostSidebar(props: CostProps) {
  return (
    <aside
      aria-label="Trip cost"
      className="hidden lg:block lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto rounded-sm border border-[#E5E1D8] bg-white p-4 shadow-sm"
    >
      <CostBreakdown {...props} />
    </aside>
  )
}

/** Mobile bar fixed to the bottom of the screen; tap to open the breakdown. */
export function CostMobileBar(props: CostProps) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const { info, flightPrice, days } = props
  const total = info ? costOfStayNumbers(info, flightPrice, days).tripTotal : flightPrice

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E1D8] bg-white shadow-[0_-4px_12px_rgba(20,33,61,0.10)] lg:hidden">
      {expanded && (
        <div id={panelId} className="max-h-[60vh] overflow-y-auto border-b border-[#E5E1D8] px-4 py-4">
          <CostBreakdown {...props} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        className="flex w-full items-center justify-between px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <span className="text-sm text-[#5B6472]">
          {info ? `Flights + stay · ${days} day${days === 1 ? '' : 's'}` : 'Flights total'} {expanded ? '▾' : '▴'}
        </span>
        <span className="font-mono text-lg font-semibold tabular-nums text-[#14213D]">
          {total !== null ? `€${total}` : 'Pick a flight'}
        </span>
      </button>
    </div>
  )
}
