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
