// The days a "fly back to a different airport" search looks at, worked out from a search. One place, used by the
// destination results (/api/compare) and by the Anywhere overview, so both ask for exactly the same trips.

import { ALL_WEEKDAYS } from './weekdays'
import type { OpenJawFilter } from './flightSources'

export type OpenJawSearch = {
  dateMode: string
  departDate?: string | null
  returnDate?: string | null
  month?: string | null
  returnMonth?: string | null
  rangeStart?: string | null
  rangeEnd?: string | null
  /** Trip length of a date range, in days (= nights). */
  minDays: number
  maxDays: number
  minNights: number
  maxNights: number
  outDays: number[]
  backDays: number[]
}

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

/** The out/back day windows for one search. Exact dates: the departure day, and the return day if one was named
 * (otherwise any return from the next day up to two weeks later). Whole month: the two months, with the weekday and
 * nights limits. Date range: the departure window, trip length and weekday limits. */
export function openJawFilterFor(search: OpenJawSearch): OpenJawFilter {
  if (search.dateMode === 'exact') {
    const day = search.departDate ?? null
    return {
      outFrom: day ?? '9999-12-31',
      outTo: day ?? '0000-01-01',
      minNights: 1,
      maxNights: search.returnDate ? 60 : 14,
      backDate: search.returnDate ?? null,
      outDays: ALL_WEEKDAYS,
      backDays: ALL_WEEKDAYS,
    }
  }
  if (search.dateMode === 'month') {
    const month = search.month ?? null
    const back = search.returnMonth ?? month
    return {
      outFrom: month ? `${month}-01` : '9999-12-31',
      outTo: month ? lastDayOf(month) : '0000-01-01',
      backFrom: back ? `${back}-01` : null,
      backTo: back ? lastDayOf(back) : null,
      minNights: search.minNights,
      maxNights: search.maxNights,
      backDate: null,
      outDays: search.outDays,
      backDays: search.backDays,
    }
  }
  return {
    outFrom: search.rangeStart ?? '0000-01-01',
    outTo: search.rangeEnd ?? '9999-12-31',
    minNights: search.minDays,
    maxNights: search.maxDays,
    backDate: null,
    outDays: search.outDays,
    backDays: search.backDays,
  }
}
