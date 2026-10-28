import { cachedJson } from '../../lib/apiParams'
import { getCountryImage } from '../../lib/countryImagesData'
import {
  parseAnywhereParams,
  rankCountries,
  checkCity,
  toAnywhereCity,
  nameAirlines,
  mapWithLimit,
  TOP_N_COUNTRIES,
  MAX_CITIES_PER_COUNTRY,
} from '../../anywhereSearch'
import type { AnywhereCity, AnywhereCountry } from '../../tripTypes'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const { origins, params } = parseAnywhereParams(searchParams)

  // Phase 1: one call per home airport ranks every reachable country roughly.
  const { countries: ranked, totalCities } = await rankCountries(origins, token)

  if (ranked.length === 0) {
    return cachedJson({
      countries: [],
      unmatchedCountries: [],
      checkedCount: 0,
      totalCandidateCities: 0,
      totalCandidateCountries: 0,
      note: 'No cached destinations found from your selected airports right now.',
    })
  }

  // Phase 2: honest check of the cheapest-looking city of each top country
  // (a few at a time). Opening a country checks ALL of its cities.
  const top = ranked.slice(0, TOP_N_COUNTRIES)
  const checked = await mapWithLimit(top, 5, async (country) => {
    const first = country.cities[0]
    return { country, first, result: await checkCity(first, params, token) }
  })

  const matched: AnywhereCountry[] = []
  const unmatched: AnywhereCountry[] = []
  const allCities: AnywhereCity[] = []

  for (const { country, first, result } of checked) {
    const verified = toAnywhereCity(first, result)
    const others = country.cities.slice(1, MAX_CITIES_PER_COUNTRY).map((c) => toAnywhereCity(c))
    allCities.push(verified, ...others)

    const base: AnywhereCountry = {
      code: country.code,
      name: country.name,
      candidateCityCount: country.cities.length,
      price: result ? result.trip.price : null,
      verifiedCity: verified,
      candidateCities: others,
      image: getCountryImage(country.code),
    }
    if (result) matched.push(base)
    else unmatched.push(base)
  }

  matched.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  await nameAirlines(allCities)

  return cachedJson({
    countries: matched,
    unmatchedCountries: unmatched,
    checkedCount: top.length,
    totalCandidateCities: totalCities,
    totalCandidateCountries: ranked.length,
  })
}
