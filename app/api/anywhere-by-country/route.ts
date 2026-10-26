import { NextResponse } from 'next/server'
import { getDayFlights, getRangeFlights, fetchMonthCalendar } from '../../flightSources'
import { getCityInfoForCodes } from '../../geoData'
import { parseDays, findBestCombinations, type DayPriceMap } from '../../weekdays'

// How many origin airports we'll call city-directions for, and how many
// countries we do an honest, weekday-aware precise check on. Both are kept
// small on purpose -- this is the "don't call the API hundreds of times"
// limit the UI tells the user about.
const MAX_ORIGINS = 6
const TOP_N_COUNTRIES = 15

type RoughCandidate = { cityCode: string; origin: string; roughPrice: number }

async function fetchCityDirections(origin: string, token: string | undefined): Promise<RoughCandidate[]> {
  try {
    const url = `https://api.travelpayouts.com/v1/city-directions?origin=${origin}&currency=eur&token=${token}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    const data = json.data || {}
    const results: RoughCandidate[] = []
    for (const [cityCode, entry] of Object.entries<{ price?: number }>(data)) {
      if (typeof entry?.price === 'number') {
        results.push({ cityCode, origin, roughPrice: entry.price })
      }
    }
    return results
  } catch {
    return []
  }
}

/** Honest check for ONE candidate city: does it actually have a price that
 * matches the requested date mode (and, for Whole Month, the weekday/nights
 * filters)? Reuses the exact same logic the single-destination results page
 * already relies on -- nothing new or less honest for this one city. */
async function checkCityPrecisely(
  origin: string,
  cityCode: string,
  params: {
    dateMode: string
    oneWay: boolean
    departDate: string | null
    returnDate: string | null
    month: string | null
    returnMonth: string | null
    outDays: number[]
    backDays: number[]
    minNights: number
    maxNights: number
    rangeStart: string | null
    rangeEnd: string | null
    minDays: number
    maxDays: number
  },
  token: string | undefined
): Promise<{ price: number; departDate: string; returnDate: string | null } | null> {
  if (params.dateMode === 'range') {
    const flights = await getRangeFlights(
      origin, cityCode, params.rangeStart || undefined, params.rangeEnd || undefined,
      params.minDays, params.maxDays, token
    )
    if (flights.length === 0) return null
    const cheapest = flights[0]
    return { price: cheapest.price, departDate: cheapest.departureDate, returnDate: cheapest.returnDate }
  }

  if (params.dateMode === 'month') {
    if (!params.month) return null
    const outboundData: DayPriceMap = await fetchMonthCalendar(origin, cityCode, params.month, token)

    if (params.oneWay) {
      const matching = Object.entries(outboundData).filter(([date]) =>
        params.outDays.includes(new Date(date).getDay())
      )
      if (matching.length === 0) return null
      const [date, entry] = matching.reduce((min, cur) => (cur[1].price < min[1].price ? cur : min))
      return { price: entry.price, departDate: date, returnDate: null }
    }

    if (!params.returnMonth) return null
    const inboundData: DayPriceMap = await fetchMonthCalendar(cityCode, origin, params.returnMonth, token)
    const combos = findBestCombinations(
      outboundData, inboundData, params.outDays, params.backDays, params.minNights, params.maxNights, 1
    )
    if (combos.length === 0) return null
    const best = combos[0]
    return { price: best.total, departDate: best.outDate, returnDate: best.backDate }
  }

  // exact
  if (!params.departDate) return null
  const flights = await getDayFlights(origin, cityCode, params.departDate, token)
  if (flights.length === 0) return null
  const cheapest = flights[0]
  return { price: cheapest.price, departDate: cheapest.departureDate, returnDate: cheapest.returnDate }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = process.env.TRAVELPAYOUTS_TOKEN

  const originsParam = searchParams.get('origins')
  const origins = (originsParam ? originsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : ['BTS', 'VIE', 'BUD', 'KSC', 'PRG']).slice(0, MAX_ORIGINS)

  const params = {
    dateMode: searchParams.get('dateMode') || 'exact',
    oneWay: searchParams.get('oneWay') === 'true',
    departDate: searchParams.get('departDate'),
    returnDate: searchParams.get('returnDate'),
    month: searchParams.get('month'),
    returnMonth: searchParams.get('returnMonth') || searchParams.get('month'),
    outDays: parseDays(searchParams.get('outDays')),
    backDays: parseDays(searchParams.get('backDays')),
    minNights: parseInt(searchParams.get('minNights') || '1', 10),
    maxNights: parseInt(searchParams.get('maxNights') || '14', 10),
    rangeStart: searchParams.get('rangeStart'),
    rangeEnd: searchParams.get('rangeEnd'),
    minDays: parseInt(searchParams.get('minDays') || '2', 10),
    maxDays: parseInt(searchParams.get('maxDays') || '10', 10),
  }

  // Phase 1: rough, cheap ranking -- one call per origin, covers dozens of
  // real destinations each, no weekday awareness yet.
  const perOrigin = await Promise.all(origins.map((o) => fetchCityDirections(o, token)))
  const allCandidates = perOrigin.flat()

  if (allCandidates.length === 0) {
    return NextResponse.json({
      countries: [], unmatchedCountries: [], checkedCount: 0, totalCandidateCities: 0,
      note: 'No cached destinations found from your selected airports right now.',
    })
  }

  // Keep the cheapest rough candidate per city code (across all origins).
  const cheapestPerCity = new Map<string, RoughCandidate>()
  for (const c of allCandidates) {
    const existing = cheapestPerCity.get(c.cityCode)
    if (!existing || c.roughPrice < existing.roughPrice) cheapestPerCity.set(c.cityCode, c)
  }

  const cityInfo = await getCityInfoForCodes(Array.from(cheapestPerCity.keys()))

  // Group by country.
  const byCountry = new Map<string, { code: string; name: string; candidates: (RoughCandidate & { cityName: string })[] }>()
  for (const [cityCode, candidate] of cheapestPerCity) {
    const info = cityInfo.get(cityCode)
    if (!info) continue // can't place it on a country -- excluded, not guessed
    const key = info.country.code
    if (!byCountry.has(key)) byCountry.set(key, { code: info.country.code, name: info.country.name, candidates: [] })
    byCountry.get(key)!.candidates.push({ ...candidate, cityName: info.name })
  }

  const countriesRoughRanked = Array.from(byCountry.values())
    .map((c) => ({ ...c, candidates: c.candidates.sort((a, b) => a.roughPrice - b.roughPrice) }))
    .sort((a, b) => a.candidates[0].roughPrice - b.candidates[0].roughPrice)

  const topCountries = countriesRoughRanked.slice(0, TOP_N_COUNTRIES)

  // Phase 2: honest check -- cheapest candidate city per top country only,
  // actually respecting the weekday/nights filters.
  const checked = await Promise.all(
    topCountries.map(async (country) => {
      const cheapest = country.candidates[0]
      const result = await checkCityPrecisely(cheapest.origin, cheapest.cityCode, params, token)
      return { country, cheapest, result }
    })
  )

  type CandidateCityOut = { code: string; name: string; origin: string; roughPrice: number }
  type UnmatchedCountryOut = { code: string; name: string; candidateCityCount: number; candidateCities: CandidateCityOut[] }
  type MatchedCountryOut = UnmatchedCountryOut & {
    price: number
    verifiedCity: { code: string; name: string; origin: string; departDate: string; returnDate: string | null }
  }

  const matched: MatchedCountryOut[] = []
  const unmatched: UnmatchedCountryOut[] = []

  for (const { country, cheapest, result } of checked) {
    const base: UnmatchedCountryOut = {
      code: country.code,
      name: country.name,
      candidateCityCount: country.candidates.length,
      candidateCities: country.candidates.slice(0, 8).map((c) => ({
        code: c.cityCode, name: c.cityName, origin: c.origin, roughPrice: c.roughPrice,
      })),
    }
    if (result) {
      matched.push({
        ...base,
        price: result.price,
        verifiedCity: { code: cheapest.cityCode, name: cheapest.cityName, origin: cheapest.origin, departDate: result.departDate, returnDate: result.returnDate },
      })
    } else {
      unmatched.push(base)
    }
  }

  matched.sort((a, b) => a.price - b.price)

  return NextResponse.json({
    countries: matched,
    unmatchedCountries: unmatched,
    checkedCount: topCountries.length,
    totalCandidateCities: cheapestPerCity.size,
    totalCandidateCountries: countriesRoughRanked.length,
  })
}
