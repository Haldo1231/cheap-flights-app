'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseDays, serializeDays } from '../weekdays'
import { dataFilters, filtersOnly, withParams } from '../lib/resultsUrl'
import { budgetParams, parseBudget, parseLevel } from '../lib/budget'
import { DEFAULT_LEVEL, type LevelKey } from '../budgetConfig'

/** Everything the results screens read from the URL, parsed once. */
export function useResultsParams() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const searchString = searchParams.toString()

  const origins = searchParams.get('origins') || ''
  const originList = useMemo(() => origins.split(',').filter(Boolean), [origins])
  const outDaysParam = searchParams.get('outDays')
  const backDaysParam = searchParams.get('backDays')
  const outDays = useMemo(() => parseDays(outDaysParam), [outDaysParam])
  const backDays = useMemo(() => parseDays(backDaysParam), [backDaysParam])

  const filterString = useMemo(() => filtersOnly(searchString).toString(), [searchString])
  /** The same without the budget settings: the address price requests use (see dataFilters). */
  const dataString = useMemo(() => dataFilters(searchString).toString(), [searchString])

  // A budget only makes sense for a trip with a return. For a one-way search any budget, spending style or
  // "only within budget" in the address (an old or hand-edited link) is ignored, so it can never filter results.
  const oneWay = searchParams.get('oneWay') === 'true'
  const budget = oneWay ? null : parseBudget(searchParams.get('budget'))
  const level = oneWay ? DEFAULT_LEVEL : parseLevel(searchParams.get('level'))
  // "Only within budget" means nothing without a budget.
  const withinOnly = budget !== null && searchParams.get('within') === 'true'

  /** The address we have asked for but the router has not shown yet. Two quick taps (for
   * example Thursday, then Tuesday) must both survive, so the second change builds on the
   * first instead of on the older address that is still on screen. */
  const pending = useRef<string | null>(null)
  useEffect(() => {
    pending.current = null
  }, [searchString])

  /** Change params without leaving the screen (filters, selections). Does not
   * touch scroll, and replaces the history entry so Back is not a pile of filter clicks. */
  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = withParams(pending.current ?? searchString, changes)
      pending.current = next.includes('?') ? next.slice(next.indexOf('?') + 1) : ''
      router.replace(next, { scroll: false })
    },
    [router, searchString]
  )

  /** Allow only these departure days. All seven (or none) means no restriction, so the
   * parameter disappears from the address. */
  const setOutDays = useCallback(
    (days: number[]) => setParams({ outDays: days.length === 0 || days.length === 7 ? null : serializeDays(days) }),
    [setParams]
  )

  const setBackDays = useCallback(
    (days: number[]) => setParams({ backDays: days.length === 0 || days.length === 7 ? null : serializeDays(days) }),
    [setParams]
  )

  /** Change the budget and/or the spending style. A cleared budget also clears "only within budget". */
  const setBudget = useCallback(
    (nextBudget: number | null, nextLevel: LevelKey) =>
      setParams({ ...budgetParams(nextBudget, nextLevel), ...(nextBudget === null ? { within: null } : {}) }),
    [setParams]
  )
  const setWithinOnly = useCallback((on: boolean) => setParams({ within: on ? 'true' : null }), [setParams])

  return {
    searchParams,
    searchString,
    filterString,
    dataString,
    budget,
    level,
    withinOnly,
    isAnywhere: searchParams.get('anywhere') === 'true',
    country: searchParams.get('country') || '',
    destination: searchParams.get('destination') || '',
    fromCountry: searchParams.get('fromCountry') || '',
    origins,
    originList,
    oneWay,
    dateMode: searchParams.get('dateMode') || 'exact',
    openJaw: searchParams.get('openJaw') === 'true',
    departMonth: searchParams.get('month') || '',
    returnMonth: searchParams.get('returnMonth') || searchParams.get('month') || '',
    departDate: searchParams.get('departDate'),
    returnDate: searchParams.get('returnDate'),
    outDays,
    backDays,
    minNights: parseInt(searchParams.get('minNights') || '1', 10),
    maxNights: parseInt(searchParams.get('maxNights') || '14', 10),
    setParams,
    setOutDays,
    setBackDays,
    setBudget,
    setWithinOnly,
  }
}

export type ResultsParams = ReturnType<typeof useResultsParams>
