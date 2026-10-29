'use client'

import { useId, useState } from 'react'
import { DEFAULT_LEVEL, INCLUDED, LEVELS, NOT_INCLUDED, type LevelKey } from '../budgetConfig'
import { affordableText, dailyCosts, estimateTrip, hasCostData, type DestCosts } from '../lib/budget'

// Cost-of-stay estimate for a destination, shown next to the flight price.
// Desktop: a card that stays on screen while the page scrolls.
// Mobile: a compact bar fixed to the bottom that opens into the full breakdown.
// The numbers come from lib/budget.ts, the same maths the result lists use, so a total here is the
// same total as on the card it belongs to.

export type DestInfo = DestCosts & {
  name: string
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
  /** What to say while there is no flight price yet, e.g. "pick a return day". */
  flightPlaceholder?: string
  /** Days of stay the estimate is for. */
  days: number
  /** Human-readable dates the stay is based on, e.g. "10 Nov → 15 Nov". */
  dates?: string | null
  /** Optional block shown above the numbers (e.g. the flights picked so far). */
  summary?: React.ReactNode
  /** Spending style (default: middle, the destination's usual estimate). */
  level?: LevelKey
  /** The traveller's maximum total budget in euro, if they set one. */
  budget?: number | null
  /** One-way trip: the stay counts as 1 day and the hint says "days", not "nights". */
  oneWay?: boolean
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold text-ink' : 'text-slate'}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums text-ink">{value}</span>
    </div>
  )
}

/** The estimate for what the panel is showing, or null while there is no flight or no cost data. */
function panelEstimate({ info, flightPrice, days, level = DEFAULT_LEVEL, budget = null }: CostProps) {
  if (flightPrice === null || !hasCostData(info)) return null
  return estimateTrip({ flight: flightPrice, nights: days, info, level, budget })
}

function BudgetLines({ props }: { props: CostProps }) {
  const { budget = null, destinationName, oneWay = false, info } = props
  const estimate = panelEstimate(props)
  if (budget === null) return null
  if (!estimate || estimate.difference === null) {
    return (
      <div className="mt-3 space-y-1 border-t border-line pt-3">
        <Row label="Your budget" value={`€${budget}`} strong />
        <p className="text-xs text-slate">
          {hasCostData(info) ? 'Pick a flight to see how much of it is left.' : 'No cost data for this destination, so it is not counted as within budget.'}
        </p>
      </div>
    )
  }
  const left = estimate.difference >= 0
  const hint = affordableText(estimate, destinationName, oneWay, budget)
  return (
    <div className="mt-3 space-y-1 border-t border-line pt-3" aria-live="polite">
      <Row label="Your budget" value={`€${budget}`} />
      <div className={`flex items-baseline justify-between gap-3 font-semibold ${left ? 'text-ink' : 'text-danger'}`}>
        <span>{left ? 'Left in budget' : 'Over budget by'}</span>
        <span className="font-mono tabular-nums">
          €{Math.abs(estimate.difference)}
          <span className="sr-only">{left ? ' left' : ' over'}</span>
        </span>
      </div>
      {hint && <p className="pt-1 text-xs text-slate">{hint}</p>}
    </div>
  )
}

export function CostBreakdown(props: CostProps) {
  const { destinationName, info, flightPrice, flightNote, flightPlaceholder, days, dates, summary, level = DEFAULT_LEVEL, budget = null } = props
  const dayLabel = `${days} day${days === 1 ? '' : 's'}`
  const costs = dailyCosts(info, level)

  if (!info || !costs) {
    return (
      <div className="text-sm">
        {summary}
        <p className="mb-1 font-semibold text-ink">Trip cost</p>
        <p className="mb-3 text-slate">
          We don&apos;t have cost-of-stay numbers for {destinationName} yet, so only the flights can be shown.
          {budget !== null && ' It is not counted as within your budget.'}
        </p>
        <Row label="Flights" value={flightPrice !== null ? `€${flightPrice}` : flightPlaceholder ?? 'pick a flight'} strong />
        {flightNote && flightPrice !== null && <p className="mt-1 text-xs text-slate">{flightNote}</p>}
      </div>
    )
  }

  const stayTotal = costs.perDay * days
  const tripTotal = flightPrice !== null ? flightPrice + stayTotal : null

  return (
    <div className="text-sm">
      {summary}
      <p className="font-semibold text-ink">Trip cost in {info.name}</p>
      <p className="mb-3 text-xs text-slate">
        {dayLabel}
        {dates ? ` · ${dates}` : ''}
        {' · '}
        {LEVELS[level].label} style
      </p>

      <div className="space-y-1">
        <Row label={LEVELS[level].accommodationLabel} value={`€${costs.accommodation}`} />
        <Row label="Food / day" value={`€${costs.food}`} />
        <Row label="Transport / day" value={`€${costs.transport}`} />
        <Row label="Other / day" value={`€${costs.other}`} />
      </div>

      <div className="mt-3 space-y-1 border-t border-line pt-3">
        <Row label="Per day" value={`€${costs.perDay}`} />
        <Row label={`Stay · ${dayLabel}`} value={`€${stayTotal}`} strong />
        <Row label="Flights" value={flightPrice !== null ? `€${flightPrice}` : flightPlaceholder ?? 'pick a flight'} strong />
        {flightNote && flightPrice !== null && <p className="text-xs text-slate">{flightNote}</p>}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-ink pt-3">
        <span className="font-semibold text-ink">Flights + stay</span>
        <span className="font-mono text-xl font-semibold tabular-nums text-ink">
          {tripTotal !== null ? `€${tripTotal}` : '—'}
        </span>
      </div>

      <BudgetLines props={props} />

      <p className="mt-2 text-xs text-slate">Rough daily averages and cached flight prices — estimates, not quotes.</p>
      <details className="mt-2 text-xs text-slate">
        <summary className="inline-flex min-h-8 cursor-pointer items-center font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          What is included?
        </summary>
        <div className="mt-1 space-y-1">
          <p>
            <span className="font-semibold text-ink">Included:</span> {INCLUDED.join(', ')}.
          </p>
          <p>
            <span className="font-semibold text-ink">Not included:</span> {NOT_INCLUDED.join(', ')}.
          </p>
          <p>Flight prices are cached and can differ on the booking site. {LEVELS[level].blurb}</p>
        </div>
      </details>
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
      className="hidden lg:block lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto surface p-4"
    >
      <CostBreakdown {...props} />
    </aside>
  )
}

/** Mobile bar fixed to the bottom of the screen; tap to open the breakdown. */
export function CostMobileBar(props: CostProps) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const { info, flightPrice, days, flightPlaceholder } = props
  const estimate = panelEstimate(props)
  const total = hasCostData(info) ? estimate?.total ?? null : flightPrice
  const difference = estimate?.difference ?? null

  return (
    <div data-mobile-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-[0_-4px_12px_rgba(20,33,61,0.10)] lg:hidden">
      {expanded && (
        <div id={panelId} className="max-h-[60vh] overflow-y-auto border-b border-line px-4 py-4">
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
        <span className="text-sm text-slate">
          {hasCostData(info) ? `Flights + stay · ${days} day${days === 1 ? '' : 's'}` : 'Flights total'} {expanded ? '▾' : '▴'}
        </span>
        <span className="text-right">
          <span className="block font-mono text-lg font-semibold tabular-nums text-ink">
            {total !== null ? `€${total}` : flightPlaceholder ? flightPlaceholder.charAt(0).toUpperCase() + flightPlaceholder.slice(1) : 'Pick a flight'}
          </span>
          {difference !== null && (
            <span className={`block text-xs font-medium ${difference >= 0 ? 'text-slate' : 'text-danger'}`}>
              {difference >= 0 ? `€${difference} left in budget` : `€${Math.abs(difference)} over budget`}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
