// Looks up airline names from Travelpayouts' static airlines file.
// Cached in memory so we don't re-fetch/re-parse on every request.

type AirlineEntry = { code?: string; name?: string | null; name_translations?: { en?: string } }

let cache: Map<string, string> | null = null
let cacheTime = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h — airline names rarely change

async function loadAirlines(): Promise<Map<string, string>> {
  const now = Date.now()
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache

  try {
    const res = await fetch('https://api.travelpayouts.com/data/en/airlines.json', {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return cache || new Map()

    const json: unknown = await res.json()
    const list: AirlineEntry[] = Array.isArray(json) ? json : []
    const map = new Map<string, string>()

    for (const entry of list) {
      const code = entry?.code
      if (!code) continue
      const name = entry?.name ?? entry?.name_translations?.en ?? null
      if (name) map.set(code, name)
    }

    cache = map
    cacheTime = now
    return map
  } catch {
    // Keep serving a stale cache rather than nothing, if we have one
    return cache || new Map()
  }
}

export async function getAirlineName(code: string | null | undefined): Promise<string | null> {
  if (!code) return null
  const map = await loadAirlines()
  return map.get(code) || null
}

export async function getAirlineNames(codes: (string | null | undefined)[]): Promise<Map<string, string>> {
  const map = await loadAirlines()
  const result = new Map<string, string>()
  for (const code of codes) {
    if (code && map.has(code)) result.set(code, map.get(code)!)
  }
  return result
}
