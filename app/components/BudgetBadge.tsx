import type { BudgetStatus, TripEstimate } from '../lib/budget'

/** Says in words (not only colour) whether a trip fits the budget. Nothing is shown without a budget. */
export default function BudgetBadge({ estimate, className = '' }: { estimate: TripEstimate; className?: string }) {
  const base = `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`
  const status: BudgetStatus = estimate.status
  if (status === 'none') return null
  if (status === 'within') {
    return (
      <span className={`${base} border-ok-line bg-ok-bg text-ink`}>
        <span aria-hidden="true">✓</span> Within budget{estimate.difference ? ` · €${estimate.difference} left` : ''}
      </span>
    )
  }
  if (status === 'over') {
    return (
      <span className={`${base} border-danger-line bg-danger-bg text-ink`}>
        <span aria-hidden="true">!</span> Over budget by €{Math.abs(estimate.difference ?? 0)}
      </span>
    )
  }
  return <span className={`${base} border-line bg-sand text-slate`}>No cost data</span>
}
