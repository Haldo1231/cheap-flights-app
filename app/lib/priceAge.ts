// How old a cached price is. The free data says when a traveller saw some prices (`found_at`) and when
// others stop being valid (`expires_at`); where it says nothing, we say "age not in the data" and never guess.

/** A cached price seen longer ago than this is treated as out of date and left out. The free data is
 * meant to be what travellers found in the last day or two; three days leaves room for slow caches. */
export const MAX_PRICE_AGE_MS = 72 * 3600 * 1000

/** A time from the data as milliseconds. The sources send times without a zone ("2026-10-30T09:15:00"):
 * those are read as UTC, like the rest of the data. null for missing or broken text. */
export function parseTime(text: string | null | undefined): number | null {
  if (!text) return null
  const t = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`)
  return Number.isFinite(t) ? t : null
}

/** Milliseconds since a price was seen, or null when the data does not say. */
export function priceAgeMs(seenAt: string | null | undefined, now = Date.now()): number | null {
  const seen = parseTime(seenAt)
  return seen === null ? null : Math.max(0, now - seen)
}

/** "just now", "25 min ago", "6 h ago", "2 days ago". */
export function formatAge(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

/** One short phrase for the price: "price seen 6 h ago", or the honest "price age not in the data". */
export function priceAgeText(seenAt: string | null | undefined, now = Date.now()): string {
  const age = priceAgeMs(seenAt, now)
  return age === null ? 'price age not in the data' : `price seen ${formatAge(age)}`
}
