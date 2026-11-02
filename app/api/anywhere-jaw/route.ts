import { cachedJson, cleanCode } from '../../lib/apiParams'
import {
  parseAnywhereParams,
  rankCountries,
  checkCityOpenJaw,
  nameAirlines,
  mapWithLimit,
  TOP_N_COUNTRIES,
  MAX_CITIES_PER_COUNTRY,
} from '../../anywhereSearch'
import type { AnywhereCity, AnywhereTrip } from '../../tripTypes'

export const maxDuration = 60

export type AnywhereJawResponse = {
  /** The best trip back to a different home airport, by city code. A city with no such trip is not listed. */
  trips: Record<string, AnywhereTrip>
  /** How many cities were looked at. */
  checked: number
}

// The extra work of the "fly back to a different airport" switch on the Anywhere screens (exact dates and date range). It
// is a separate request, so the normal results never wait for it: the page shows the round trips first, then mixes these
// trips in by price when they arrive (a city shows whichever is cheaper: the round trip or the trip back to another airport).
//  - without `country`: the cheapest-looking city of each top country (the same cities the country cards are built from)
//  - with `country`: every city of that country (the same cities the country page checks)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const { origins, params } = parseAnywhereParams(searchParams)
  const countryCode = cleanCode(searchParams.get('country'))

  // No different-airport trips for a one-way search, and none for Anywhere over a whole month: that search only looks at
  // same-airport round trips (the way to another airport there is the button on a picked trip). Nothing is asked of the
  // price provider in these cases.
  if (params.oneWay || params.dateMode === 'month') return cachedJson<AnywhereJawResponse>({ trips: {}, checked: 0 })

  const { countries } = await rankCountries(origins, token)
  const cities = countryCode
    ? (countries.find((c) => c.code === countryCode)?.cities.slice(0, MAX_CITIES_PER_COUNTRY) ?? [])
    : countries.slice(0, TOP_N_COUNTRIES).flatMap((c) => c.cities.slice(0, 1))

  const found = await mapWithLimit(cities, 4, async (city) => ({
    city,
    trip: await checkCityOpenJaw(city.cityCode, origins, params, token),
  }))

  const trips: Record<string, AnywhereTrip> = {}
  const forNames: AnywhereCity[] = []
  for (const { city, trip } of found) {
    if (!trip) continue
    trips[city.cityCode] = trip
    forNames.push({ code: city.cityCode, name: city.cityName, origin: trip.outbound.origin, roughPrice: trip.price, example: null, trip })
  }
  await nameAirlines(forNames)

  return cachedJson<AnywhereJawResponse>({ trips, checked: cities.length })
}
