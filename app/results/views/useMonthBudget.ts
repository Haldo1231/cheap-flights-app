'use client'

import { useMemo } from 'react'
import { dayOfWeek } from '../../weekdays'
import { compareEstimates, estimateTrip, hasCostData, type DestCosts, type TripEstimate } from '../../lib/budget'
import { nightsBetweenDates } from '../../lib/format'
import type { ResultsParams } from '../useResultsParams'
import type { MonthTrip } from './useMonthTrip'

type Combo = MonthTrip['bestCombinations'][number]
export type BudgetCombo = { combo: Combo; estimate: TripEstimate }
export type DayMark = 'fits' | 'over'

/** Whole Month + a budget: every pair of days that matches the weekday and nights filters gets an
 * estimate (flights + stay), ranked "within budget first, cheapest total first". Also marks the
 * calendar days: a departure day "fits" when at least one allowed return makes the whole trip fit; a
 * return day fits for the chosen departure day (or, before one is chosen, for any departure day).
 * It only reads the two calendars already on screen: no price request is made. Returns null when no
 * budget is set. */
export function useMonthBudget(p: ResultsParams, m: MonthTrip, info: DestCosts | null) {
  const { budget, level, oneWay, withinOnly, outDays } = p
  const { outboundData, allCombinations, outDate } = m
  const dataOk = hasCostData(info)

  return useMemo(() => {
    if (budget === null) return null

    const rows: BudgetCombo[] = oneWay
      ? []
      : allCombinations.map((combo) => ({
          combo,
          estimate: estimateTrip({ flight: combo.total, nights: nightsBetweenDates(combo.outDate, combo.backDate), info, level, budget }),
        }))
    rows.sort((a, b) => compareEstimates(a.estimate, b.estimate))
    const shown = withinOnly ? rows.filter((r) => r.estimate.status === 'within') : rows

    const outMarks: Record<string, DayMark> = {}
    const backMarks: Record<string, DayMark> = {}
    if (dataOk) {
      if (oneWay) {
        for (const [date, day] of Object.entries(outboundData)) {
          if (!outDays.includes(dayOfWeek(date))) continue
          outMarks[date] = estimateTrip({ flight: day.price, nights: 1, info, level, budget }).status === 'within' ? 'fits' : 'over'
        }
      } else {
        for (const { combo, estimate } of rows) {
          const fits = estimate.status === 'within'
          if (fits || !outMarks[combo.outDate]) outMarks[combo.outDate] = fits ? 'fits' : 'over'
          if (outDate && combo.outDate !== outDate) continue
          if (fits || !backMarks[combo.backDate]) backMarks[combo.backDate] = fits ? 'fits' : 'over'
        }
      }
    }
    const withinCount = rows.filter((r) => r.estimate.status === 'within').length
    const totals = rows.flatMap((r) => (r.estimate.total !== null ? [r.estimate.total] : []))
    const cheapestTotal = totals.length > 0 ? Math.min(...totals) : null
    const ultraHelps = rows.some(
      (r) => estimateTrip({ flight: r.combo.total, nights: nightsBetweenDates(r.combo.outDate, r.combo.backDate), info, level: 'ultra', budget }).status === 'within'
    )
    return { rows, shown, withinCount, cheapestTotal, ultraHelps, outMarks, backMarks, dataOk }
  }, [budget, level, oneWay, withinOnly, outDays, outboundData, allCombinations, outDate, info, dataOk])
}

export type MonthBudget = NonNullable<ReturnType<typeof useMonthBudget>>
