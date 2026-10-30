// How old a cached price is, and whether it can still be trusted. Pure and client-safe:
// the price sources (server) and the screens (browser) both use it.
//
// The Travelpayouts cache can tell us when a price was found (`found_at`, on the "latest"
// endpoint only), whether it is still valid (`actual`) and when it expires (`expires_at`).
// Nothing is ever hidden because of these fields: an old or no-longer-valid price is only
// ranked AFTER valid, fresh ones and labelled, so a wrong reading of a field cannot blank out
// the site.

/** A price found longer ago than this counts as old. One place to tune it. */
export const FRESH_HOURS = 72

/** An ISO time from whatever the data gave, or null when it is missing or not a date. */
export function parseTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw === '') return null
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** True only when the data names a time that is already behind us. */
export function isExpired(raw: unknown, now = Date.now()): boolean {
  const iso = parseTime(raw)
  return iso !== null && Date.parse(iso) < now
}

/** Hours since the price was found, or null when the data does not say. */
export function ageHours(foundAt: string | null | undefined, now = Date.now()): number | null {
  const iso = parseTime(foundAt)
  if (iso === null) return null
  return Math.max(0, (now - Date.parse(iso)) / 3_600_000)
}

/** Old, or flagged by the data as no longer valid. An unknown age is NOT old: nothing says it is. */
export function isOutdated(price: { foundAt: string | null; invalid?: boolean }, now = Date.now()): boolean {
  if (price.invalid) return true
  const hours = ageHours(price.foundAt, now)
  return hours !== null && hours > FRESH_HOURS
}

/** The older of two "found at" times: a trip of two separately priced flights is only as fresh as its
 * older price. If either price has no known age, the trip's age is not known either (null), rather than
 * borrowing the other price's age. */
export function olderOf(a: string | null | undefined, b: string | null | undefined): string | null {
  const x = parseTime(a)
  const y = parseTime(b)
  if (x === null || y === null) return null
  return x <= y ? x : y
}

/** The words shown next to a price, e.g. "price seen 6 h ago". */
export function describeAge(
  foundAt: string | null | undefined,
  options: { outdated?: boolean; now?: number } = {}
): { text: string; known: boolean; warn: boolean } {
  const now = options.now ?? Date.now()
  const hours = ageHours(foundAt, now)
  if (hours === null) {
    return { text: options.outdated ? 'age not in data · may be out of date' : 'age not in data', known: false, warn: !!options.outdated }
  }
  let when: string
  if (hours < 1 / 60) when = 'just now'
  else if (hours < 1) when = `${Math.floor(hours * 60)} min ago`
  else if (hours < 48) when = `${Math.floor(hours)} h ago`
  else when = `${Math.floor(hours / 24)} days ago`
  const warn = !!options.outdated || hours > FRESH_HOURS
  return { text: `price seen ${when}${warn ? ' · may be out of date' : ''}`, known: true, warn }
}
