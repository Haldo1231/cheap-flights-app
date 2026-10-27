'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseDays, serializeDays } from '../weekdays'
import { filtersOnly, withParams } from '../lib/resultsUrl'

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

  /** Change params without leaving the screen (filters, selections). Does not
   * touch scroll, and replaces the history entry so Back is not a pile of filter clicks. */
  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      router.replace(withParams(searchString, changes), { scroll: false })
    },
    [router, searchString]
  )

  const toggleOutDay = useCallback(
    (day: number) => {
      const next = outDays.includes(day) ? outDays.filter((d) => d !== day) : [...outDays, day]
      setParams({ outDays: serializeDays(next) })
    },
    [outDays, setParams]
  )

  const toggleBackDay = useCallback(
    (day: number) => {
      const next = backDays.includes(day) ? backDays.filter((d) => d !== day) : [...backDays, day]
      setParams({ backDays: serializeDays(next) })
    },
    [backDays, setParams]
  )

  return {
    searchParams,
    searchString,
    filterString,
    isAnywhere: searchParams.get('anywhere') === 'true',
    country: searchParams.get('country') || '',
    destination: searchParams.get('destination') || '',
    fromCountry: searchParams.get('fromCountry') || '',
    origins,
    originList,
    oneWay: searchParams.get('oneWay') === 'true',
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
    toggleOutDay,
    toggleBackDay,
  }
}

export type ResultsParams = ReturnType<typeof useResultsParams>
