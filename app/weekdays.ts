// Shared weekday helpers for the Whole Month departure/return day filter.
// Day numbers match JS Date.getDay() (0 = Sunday ... 6 = Saturday) so they
// can be compared directly against a date string without any translation.

import { nightsBetweenDates } from './lib/format'
import { olderOf } from './lib/priceAge'

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

/** Does a cached fare leave and (for a round trip) return on the allowed weekdays? One shared rule
 * for the date-range search and Anywhere. A one-way fare only has a departure day. A round-trip
 * fare whose return date is unknown can never be proven to match a return-day limit, so it only
 * passes when return days are not limited. */
export function matchesWeekdays(
  fare: { departureDate: string; returnDate: string | null },
  outDays: number[],
  backDays: number[],
  oneWay: boolean
): boolean {
  if (!outDays.includes(dayOfWeek(fare.departureDate))) return false
  if (oneWay || backDays.length === ALL_WEEKDAYS.length) return true
  return fare.returnDate !== null && backDays.includes(dayOfWeek(fare.returnDate))
}

export type DayPrice = {
  price: number
  origin: string
  /** Set when the cached price is a ROUND-TRIP fare (one price for both flights) returning on this day. */
  returnDate?: string | null
  returnTime?: string | null
  time?: string | null
  /** When the cache found the price (ISO), if the source says. */
  foundAt?: string | null
  /** The data flags the price as expired / no longer valid. */
  outdated?: boolean
}
export type DayPriceMap = Record<string, DayPrice>

export type Combination<T extends DayPrice = DayPrice> = {
  outDate: string; outPrice: number; outOrigin: string
  backDate: string; backPrice: number; backOrigin: string
  total: number; nights: number
  /** The full calendar entries the combo was built from (airline, time, ...). */
  out: T
  back: T
  /** True when `out` is a round-trip fare: its price already covers the return flight, so `backPrice` is 0
   * and `total` is that one price (never two prices added). */
  backIncluded: boolean
  /** The data flags a price of the combo as expired / no longer valid. */
  outdated: boolean
  /** The older of the prices' "found at" times (ISO), null when the data does not say. */
  foundAt: string | null
}

/** The return flight of a round-trip fare, shaped like a calendar entry: it leaves the destination on
 * the fare's return day at the fare's return time. Its price is 0 because the fare's single price is
 * counted once, on the outbound side. */
function returnLegOf<T extends DayPrice>(fare: T): T {
  return { ...fare, price: 0, time: fare.returnTime ?? null, returnDate: null, returnTime: null }
}

/** Pairs up outbound/return days that match the weekday + nights filters,
 * sorted cheapest-total-first. Shared by the results page (client-side, on
 * already-fetched calendar data) and the Anywhere-by-country search
 * (server-side, on calendar data fetched per candidate city) so the exact
 * same "what counts as a valid combo" logic is used everywhere. A pair only
 * exists when BOTH days have a cached price -- a day with no price on one
 * side never produces a (half) trip.
 *
 * One price is never counted twice. A round-trip fare (it has a return day) already pays for both
 * flights, so it is a complete trip on its own, returning on ITS return day, and is never added to
 * another price; a round-trip fare out of the destination is not a single return flight, so it is
 * never used as the back half of a pair. Two one-way prices are added. Valid prices are listed before
 * ones the data flags as expired / no longer valid. */
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

    if (outEntry.returnDate) {
      const backDate = outEntry.returnDate
      if (!backDays.includes(dayOfWeek(backDate)) || backDate <= outDate) continue
      const nights = nightsBetweenDates(outDate, backDate)
      if (nights < minNights || nights > maxNights) continue
      combos.push({
        outDate, outPrice: outEntry.price, outOrigin: outEntry.origin,
        backDate, backPrice: 0, backOrigin: outEntry.origin,
        total: outEntry.price, nights,
        out: outEntry, back: returnLegOf(outEntry),
        backIncluded: true, outdated: !!outEntry.outdated, foundAt: outEntry.foundAt ?? null,
      })
      continue
    }

    for (const [backDate, backEntry] of Object.entries(inboundData)) {
      if (backEntry.returnDate) continue
      if (!backDays.includes(dayOfWeek(backDate))) continue
      if (backDate <= outDate) continue
      const nights = nightsBetweenDates(outDate, backDate)
      if (nights < minNights || nights > maxNights) continue
      combos.push({
        outDate, outPrice: outEntry.price, outOrigin: outEntry.origin,
        backDate, backPrice: backEntry.price, backOrigin: backEntry.origin,
        total: outEntry.price + backEntry.price, nights,
        out: outEntry, back: backEntry,
        backIncluded: false,
        outdated: !!(outEntry.outdated || backEntry.outdated),
        foundAt: olderOf(outEntry.foundAt, backEntry.foundAt),
      })
    }
  }

  combos.sort((a, b) => Number(a.outdated) - Number(b.outdated) || a.total - b.total)
  return combos.slice(0, limit)
}
