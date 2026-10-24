// Looks up which country a destination code belongs to, using Travelpayouts'
// static reference files (countries.json + cities.json). Both are fetched
// once and cached in memory for 24h -- they change rarely, so there's no
// need to hit them on every request.

export type CountryInfo = { code: string; name: string }

let countriesCache: Map<string, string> | null = null // country code -> name
let citiesCache: Map<string, string> | null = null // city/destination code -> country code
let cacheTime = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

async function loadGeoData(): Promise<void> {
  const now = Date.now()
  if (countriesCache && citiesCache && now - cacheTime < CACHE_TTL_MS) return

  try {
    const [countriesRes, citiesRes] = await Promise.all([
      fetch('https://api.travelpayouts.com/data/en/countries.json', { next: { revalidate: 86400 } }),
      fetch('https://api.travelpayouts.com/data/en/cities.json', { next: { revalidate: 86400 } }),
    ])

    if (countriesRes.ok) {
      const countries: any[] = await countriesRes.json()
      const map = new Map<string, string>()
      for (const c of countries) {
        if (c?.code && c?.name) map.set(c.code, c.name)
      }
      countriesCache = map
    }

    if (citiesRes.ok) {
      const cities: any[] = await citiesRes.json()
      const map = new Map<string, string>()
      for (const c of cities) {
        if (c?.code && c?.country_code) map.set(c.code, c.country_code)
      }
      citiesCache = map
    }

    cacheTime = now
  } catch {
    // Keep serving whatever we already have cached, if anything.
  }
}

/** Resolves a destination/city code (e.g. "ROM") to its country. Returns
 * null if the code isn't in Travelpayouts' reference data. */
export async function getCountryForCity(cityCode: string): Promise<CountryInfo | null> {
  await loadGeoData()
  const countryCode = citiesCache?.get(cityCode)
  if (!countryCode) return null
  const name = countriesCache?.get(countryCode)
  if (!name) return null
  return { code: countryCode, name }
}

/** Batch version -- resolves many codes at once against the same cached data. */
export async function getCountriesForCities(cityCodes: string[]): Promise<Map<string, CountryInfo>> {
  await loadGeoData()
  const result = new Map<string, CountryInfo>()
  for (const code of cityCodes) {
    const countryCode = citiesCache?.get(code)
    if (!countryCode) continue
    const name = countriesCache?.get(countryCode)
    if (!name) continue
    result.set(code, { code: countryCode, name })
  }
  return result
}
