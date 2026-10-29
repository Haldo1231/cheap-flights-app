import { ALL_WEEKDAYS, WEEKDAY_BUTTONS, parseDays } from '../weekdays'
import { formatDay, formatMonth, formatShortDate } from './format'

function dayNames(days: number[]): string {
  return WEEKDAY_BUTTONS.filter((d) => days.includes(d.value)).map((d) => d.label).join(', ')
}

/** Short, human description of a search, e.g. ["Round trip", "Nov 2026", "Depart Thu", "Return Tue", "3–7 nights"]. */
export function describeSearch(params: URLSearchParams): string[] {
  const out: string[] = []
  const oneWay = params.get('oneWay') === 'true'
  out.push(oneWay ? 'One way' : 'Round trip')

  const mode = params.get('dateMode') || 'exact'
  if (mode === 'exact') {
    const dep = params.get('departDate')
    const ret = params.get('returnDate')
    if (dep) out.push(oneWay || !ret ? formatDay(dep) : `${formatShortDate(dep)} → ${formatShortDate(ret)}`)
  } else if (mode === 'month') {
    const month = params.get('month')
    const returnMonth = params.get('returnMonth')
    if (month) out.push(!oneWay && returnMonth && returnMonth !== month ? `${formatMonth(month)} → ${formatMonth(returnMonth)}` : formatMonth(month))
    const outDays = parseDays(params.get('outDays'))
    if (outDays.length < ALL_WEEKDAYS.length) out.push(`Depart ${dayNames(outDays)}`)
    if (!oneWay) {
      const backDays = parseDays(params.get('backDays'))
      if (backDays.length < ALL_WEEKDAYS.length) out.push(`Return ${dayNames(backDays)}`)
      out.push(`${params.get('minNights') || 1}–${params.get('maxNights') || 14} nights`)
    }
  } else if (mode === 'range') {
    const from = params.get('rangeStart')
    const to = params.get('rangeEnd')
    if (from && to) out.push(`${formatShortDate(from)} – ${formatShortDate(to)}`)
    if (!oneWay) out.push(`${params.get('minDays') || 2}–${params.get('maxDays') || 10} days`)
    const outDays = parseDays(params.get('outDays'))
    if (outDays.length < ALL_WEEKDAYS.length) out.push(`Depart ${dayNames(outDays)}`)
    if (!oneWay) {
      const backDays = parseDays(params.get('backDays'))
      if (backDays.length < ALL_WEEKDAYS.length) out.push(`Return ${dayNames(backDays)}`)
    }
  }
  return out
}

/** Only the weekday / nights part, e.g. "Depart Thu · Return Tue · 3–7 nights". */
export function describeFilters(params: URLSearchParams): string {
  const parts: string[] = []
  const oneWay = params.get('oneWay') === 'true'
  const outDays = parseDays(params.get('outDays'))
  parts.push(outDays.length < ALL_WEEKDAYS.length ? `Depart ${dayNames(outDays)}` : 'Depart any day')
  if (!oneWay) {
    const backDays = parseDays(params.get('backDays'))
    parts.push(backDays.length < ALL_WEEKDAYS.length ? `Return ${dayNames(backDays)}` : 'Return any day')
    // Whole Month has its own nights limits; a date range has "days away" (shown in the search chips).
    if (params.get('dateMode') !== 'range') parts.push(`${params.get('minNights') || 1}–${params.get('maxNights') || 14} nights`)
  }
  return parts.join(' · ')
}
