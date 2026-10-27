import { badRequest, cachedJson, cleanCode } from '../../lib/apiParams'
import {
  parseAnywhereParams,
  rankCountries,
  checkCity,
  toAnywhereCity,
  nameAirlines,
  mapWithLimit,
  MAX_CITIES_PER_COUNTRY,
} from '../../anywhereSearch'

// Opening a country checks EVERY one of its cities (up to MAX_CITIES_PER_COUNTRY)
// against the filters -- the country list itself only checks the cheapest-looking one.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const countryCode = cleanCode(searchParams.get('country'))
  if (!countryCode) return badRequest('Missing or invalid country')

  const { origins, params } = parseAnywhereParams(searchParams)
  const { countries } = await rankCountries(origins, token)
  const country = countries.find((c) => c.code === countryCode)

  if (!country) {
    return cachedJson({ country: null, cities: [], unmatchedCities: [], totalCities: 0 })
  }

  const shown = country.cities.slice(0, MAX_CITIES_PER_COUNTRY)
  const checked = await mapWithLimit(shown, 4, (city) => checkCity(city, params, token))
  const all = shown.map((city, i) => toAnywhereCity(city, checked[i]))
  await nameAirlines(all)

  const matched = all.filter((c) => c.trip).sort((a, b) => (a.trip?.price ?? Infinity) - (b.trip?.price ?? Infinity))
  const unmatched = all.filter((c) => !c.trip)

  return cachedJson({
    country: { code: country.code, name: country.name },
    cities: matched,
    unmatchedCities: unmatched,
    totalCities: country.cities.length,
    checkedCities: shown.length,
  })
}
