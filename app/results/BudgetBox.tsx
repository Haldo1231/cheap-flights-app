'use client'

import BudgetPanel from '../components/BudgetPanel'
import FilterDisclosure from '../components/FilterDisclosure'
import { levelLabel } from '../lib/budget'
import type { ResultsParams } from './useResultsParams'

/** The budget controls above the results: open on wide screens, folded away on phones, with a
 * one-line summary of what is set. Changing anything updates the address, so the lists and the cost
 * panel follow at once (no new price requests: a budget does not change a flight price). */
export default function BudgetBox({ p }: { p: ResultsParams }) {
  // No budget for one-way trips: the box is not offered at all.
  if (p.oneWay) return null
  const summary = p.budget === null ? `No limit · ${levelLabel(p.level)}` : `Max €${p.budget} · ${levelLabel(p.level)}`
  return (
    <FilterDisclosure title="Budget" summary={summary}>
      <BudgetPanel bare budget={p.budget} level={p.level} onChange={p.setBudget} withinOnly={p.withinOnly} onWithinOnly={p.setWithinOnly} />
    </FilterDisclosure>
  )
}
