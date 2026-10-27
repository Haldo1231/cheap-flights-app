// Shared weekday helpers for the Whole Month departure/return day filter.
// Day numbers match JS Date.getDay() (0 = Sunday ... 6 = Saturday) so they
// can be compared directly against a date string without any translation.

export const WEEKDAY_BUTTONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

export function dayOfWeek(dateStr: string): number {
  // Parse as a plain calendar date (no time component), so the weekday is
  // computed in local terms matching the YYYY-MM-DD string, not shifted by
  // the browser's timezone the way `new Date("2026-11-04")` (UTC midnight)
  // can be.
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function parseDays(param: string | null): number[] {
  if (!param) return ALL_WEEKDAYS
  const days = param
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 6)
  return days.length > 0 ? days : ALL_WEEKDAYS
}

export function serializeDays(days: number[]): string {
  return days.slice().sort().join(',')
}

export function isAllDays(days: number[]): boolean {
  return ALL_WEEKDAYS.every((d) => days.includes(d))
}

export function nightsBetween(departDate: string, returnDate: string | null): number {
  if (!returnDate) return 1
  const start = new Date(departDate)
  const end = new Date(returnDate)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

export type DayPrice = { price: number; origin: string }
export type DayPriceMap = Record<string, DayPrice>

export type Combination<T extends DayPrice = DayPrice> = {
  outDate: string; outPrice: number; outOrigin: string
  backDate: string; backPrice: number; backOrigin: string
  total: number; nights: number
  /** The full calendar entries the combo was built from (airline, time, ...). */
  out: T
  back: T
}

/** Pairs up outbound/return days that match the weekday + nights filters,
 * sorted cheapest-total-first. Shared by the results page (client-side, on
 * already-fetched calendar data) and the Anywhere-by-country search
 * (server-side, on calendar data fetched per candidate city) so the exact
 * same "what counts as a valid combo" logic is used everywhere. A pair only
 * exists when BOTH days have a cached price -- a day with no price on one
 * side never produces a (half) trip. */
export function findBestCombinations<T extends DayPrice>(
  outboundData: Record<string, T>,
  inboundData: Record<string, T>,
  outDays: number[],
  backDays: number[],
  minNights: number,
  maxNights: number,
  limit = 10
): Combination<T>[] {
  const combos: Combination<T>[] = []

  for (const [outDate, outEntry] of Object.entries(outboundData)) {
    if (!outDays.includes(dayOfWeek(outDate))) continue
    for (const [backDate, backEntry] of Object.entries(inboundData)) {
      if (!backDays.includes(dayOfWeek(backDate))) continue
      if (backDate <= outDate) continue
      const nights = nightsBetween(outDate, backDate)
      if (nights < minNights || nights > maxNights) continue
      combos.push({
        outDate, outPrice: outEntry.price, outOrigin: outEntry.origin,
        backDate, backPrice: backEntry.price, backOrigin: backEntry.origin,
        total: outEntry.price + backEntry.price, nights,
        out: outEntry, back: backEntry,
      })
    }
  }

  combos.sort((a, b) => a.total - b.total)
  return combos.slice(0, limit)
}
