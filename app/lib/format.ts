// Small, dependency-free formatting helpers shared by pages and components.
// Dates are handled as plain YYYY-MM-DD strings (no timezone shifting).

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** "Wed 11 Nov" */
export function formatDay(date: string | null | undefined): string {
  if (!date) return ''
  const p = parts(date)
  if (!p) return date
  const [y, m, d] = p
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`
}

/** "11 Nov" */
export function formatShortDate(date: string | null | undefined): string {
  if (!date) return ''
  const p = parts(date)
  if (!p) return date
  return `${p[2]} ${MONTHS[p[1] - 1]}`
}

/** "Nov 2026" from "2026-11" */
export function formatMonth(month: string | null | undefined): string {
  if (!month) return ''
  const m = /^(\d{4})-(\d{2})/.exec(month)
  if (!m) return month
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

export function formatStops(stops: number | null | undefined): string | null {
  if (stops === null || stops === undefined) return null
  if (stops === 0) return 'Direct'
  return stops === 1 ? '1 stop' : `${stops} stops`
}

export function formatNights(n: number): string {
  return `${n} night${n === 1 ? '' : 's'}`
}

/** Whole nights between two YYYY-MM-DD dates (never below 0). */
export function nightsBetweenDates(from: string, to: string | null | undefined): number {
  if (!to) return 0
  const a = parts(from)
  const b = parts(to)
  if (!a || !b) return 0
  const start = Date.UTC(a[0], a[1] - 1, a[2])
  const end = Date.UTC(b[0], b[1] - 1, b[2])
  return Math.max(0, Math.round((end - start) / 86400000))
}

/** "2026-11" shifted by a number of months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
