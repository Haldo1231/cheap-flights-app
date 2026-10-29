'use client'

import { LEVELS } from '../budgetConfig'
import { MAX_BUDGET } from '../budgetConfig'
import type { ResultsParams } from './useResultsParams'

/** The next round number above a total, so "raise your budget to €X" is a clean figure. */
function roundUp(total: number): number {
  const step = total <= 300 ? 10 : total <= 1000 ? 50 : 100
  return Math.min(MAX_BUDGET, Math.ceil(total / step) * step)
}

/** What to show when no trip fits the budget (or the budget cannot be checked): why, and one tap
 * to loosen it. Used by every results screen so the advice is the same everywhere. */
export default function BudgetEmpty({
  p,
  cheapestTotal,
  ultraHelps,
  noData = false,
  noun = 'trips',
}: {
  p: ResultsParams
  /** The cheapest total among the options that DO have cost data, if any. */
  cheapestTotal: number | null
  /** Would the Ultra cheap style make at least one option fit? */
  ultraHelps: boolean
  /** The reason is missing cost data, not the price. */
  noData?: boolean
  noun?: string
}) {
  const { budget } = p
  if (budget === null) return null
  const raiseTo = cheapestTotal !== null && cheapestTotal > budget ? roundUp(cheapestTotal) : null
  const BUTTON = 'btn btn-outline'

  return (
    <div role="status" className="surface mb-6 px-5 py-6">
      <p className="mb-1 text-lg font-semibold">{noData ? 'We cannot check this against your budget' : `No ${noun} fit €${budget}`}</p>
      <p className="mb-3 text-sm text-slate">
        {noData
          ? 'There are no cost-of-stay numbers for this destination, so we show flight prices only and cannot count anything as within budget.'
          : cheapestTotal !== null
          ? `The cheapest ${LEVELS[p.level].label.toLowerCase()} option we found is about €${cheapestTotal} in total (flights plus stay).`
          : 'Nothing could be matched with cost data.'}
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate">
        {raiseTo !== null && <li>raise your budget to about €{raiseTo}</li>}
        {ultraHelps && p.level !== 'ultra' && <li>choose the Ultra cheap spending style</li>}
        <li>loosen your dates or weekdays, or add another home airport</li>
        {p.withinOnly && <li>turn off &ldquo;Only show trips within budget&rdquo; to see everything</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        {raiseTo !== null && (
          <button type="button" className={BUTTON} onClick={() => p.setBudget(raiseTo, p.level)}>
            Raise budget to €{raiseTo}
          </button>
        )}
        {ultraHelps && p.level !== 'ultra' && (
          <button type="button" className={BUTTON} onClick={() => p.setBudget(budget, 'ultra')}>
            Use Ultra cheap
          </button>
        )}
        {p.withinOnly && (
          <button type="button" className={BUTTON} onClick={() => p.setWithinOnly(false)}>
            Show everything
          </button>
        )}
      </div>
    </div>
  )
}
