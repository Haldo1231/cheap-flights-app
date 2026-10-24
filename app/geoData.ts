// Looks up which country a destination code belongs to, using Travelpayouts'
// static reference files (countries.json + cities.json). Both are fetched
// once and cached in memory for 24h -- they change rarely, so there's no
// need to hit them on every request.

export type CountryInfo = { code: string; name: string }
export type CityInfo = { code: string; name: string; country: CountryInfo }

let countriesCache: Map<string, string> | null = null // country code -> name
let citiesCache: Map<string, { name: string; countryCode: string }> | null = null // city code -> info
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
      const countries: { code?: string; name?: string }[] = await countriesRes.json()
      const map = new Map<string, string>()
      for (const c of countries) {
        if (c?.code && c?.name) map.set(c.code, c.name)
      }
      countriesCache = map
    }

    if (citiesRes.ok) {
      const cities: { code?: string; country_code?: string; name?: string }[] = await citiesRes.json()
      const map = new Map<string, { name: string; countryCode: string }>()
      for (const c of cities) {
        if (c?.code && c?.country_code && c?.name) {
          map.set(c.code, { name: c.name, countryCode: c.country_code })
        }
      }
      citiesCache = map
    }

    cacheTime = now
  } catch {
    // Keep serving whatever we already have cached, if anything.
  }
}

/** Resolves a destination/city code (e.g. "ROM") to its name and country.
 * Returns null if the code isn't in Travelpayouts' reference data. */
export async function getCityInfo(cityCode: string): Promise<CityInfo | null> {
  await loadGeoData()
  const city = citiesCache?.get(cityCode)
  if (!city) return null
  const countryName = countriesCache?.get(city.countryCode)
  if (!countryName) return null
  return { code: cityCode, name: city.name, country: { code: city.countryCode, name: countryName } }
}

/** Batch version -- resolves many codes at once against the same cached data. */
export async function getCityInfoForCodes(cityCodes: string[]): Promise<Map<string, CityInfo>> {
  await loadGeoData()
  const result = new Map<string, CityInfo>()
  for (const code of cityCodes) {
    const city = citiesCache?.get(code)
    if (!city) continue
    const countryName = countriesCache?.get(city.countryCode)
    if (!countryName) continue
    result.set(code, { code, name: city.name, country: { code: city.countryCode, name: countryName } })
  }
  return result
}
