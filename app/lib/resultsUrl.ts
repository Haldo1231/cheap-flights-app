// Helpers for building the URLs of the results screens. Everything the user
// chose lives in the URL (filters, drill-down level, selected days), so Back,
// refresh and sharing all work.

/** Query keys that hold a chosen day/flight in Whole Month mode. */
export const SELECTION_KEYS = ['out', 'of', 'back', 'bf'] as const

/** Query keys that describe the drill-down level. */
export const LEVEL_KEYS = ['anywhere', 'country', 'destination', 'fromCountry'] as const

/** Copy of the current params with some changed; a null value removes the key. */
export function withParams(
  current: URLSearchParams | string,
  changes: Record<string, string | null>,
  path = '/results'
): string {
  const params = new URLSearchParams(typeof current === 'string' ? current : current.toString())
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Just the search filters (no drill-down level, no selection, no trip data). */
export function filtersOnly(current: URLSearchParams | string): URLSearchParams {
  const params = new URLSearchParams(typeof current === 'string' ? current : current.toString())
  for (const key of [...LEVEL_KEYS, ...SELECTION_KEYS]) params.delete(key)
  for (const key of [...params.keys()]) {
    if (/^(tk|tp|tg|[otdasp][12]|h2)$/.test(key)) params.delete(key)
  }
  return params
}
