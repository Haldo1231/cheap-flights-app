'use client'

import WeekdayFilterPanel from '../components/WeekdayFilterPanel'
import FilterDisclosure from '../components/FilterDisclosure'
import { describeFilters } from '../lib/searchSummary'
import type { ResultsParams } from './useResultsParams'

/** The weekday filters above the results, for Whole Month AND date-range searches (one component,
 * so both modes look and behave the same). Folded away on phones, with a one-line summary. Exact
 * dates have no weekday filter: the person picked the day. */
export default function WeekdayFilterBox({ p }: { p: ResultsParams }) {
  const isMonth = p.dateMode === 'month'
  if (!isMonth && p.dateMode !== 'range') return null
  return (
    <FilterDisclosure summary={describeFilters(new URLSearchParams(p.filterString))}>
      <WeekdayFilterPanel
        bare
        showNights={isMonth}
        outDays={p.outDays}
        backDays={p.backDays}
        oneWay={p.oneWay}
        minNights={p.minNights}
        maxNights={p.maxNights}
        onChangeOutDays={p.setOutDays}
        onChangeBackDays={p.setBackDays}
        onChangeMinNights={(v) => p.setParams({ minNights: v })}
        onChangeMaxNights={(v) => p.setParams({ maxNights: v })}
      />
    </FilterDisclosure>
  )
}
