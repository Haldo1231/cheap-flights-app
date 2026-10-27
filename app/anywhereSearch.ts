// Anywhere search, shared by the country list and the country detail routes.
//
// Two phases keep API usage small while staying honest about the filters:
//  1. Rough ranking: ONE call per home airport lists ~30 real destinations with
//     a rough cached price each (no weekday awareness).
//  2. Honest check: only for the cities we actually show, we look at the real
//     day-by-day data and apply the date/weekday/nights filters. A city only
//     gets a price when a day that really matches the filters has a cached fare.

import {
  getDayFlights,
  getRangeFlights,
  fetchMonthCalendarDetailed,
  completeFlights,
  flightToFare,
  normalizeFromCheap,
  type CheapEntry,
  type Flight,
} from './flightSources'
import { getCityInfoForCodes } from './geoData'
import { getAirlineNames } from './airlines'
import { parseDays, findBestCombinations } from './weekdays'
import { calendarDayToFare } from './lib/trip'
import { mapWithLimit } from './lib/pool'
import type { AnywhereCity, AnywhereTrip, CalendarDay, Fare, Leg } from './tripTypes'

// Bounds shown to the user ("checked the N cheapest-looking countries").
export { mapWithLimit }

export const MAX_ORIGINS = 6
export const TOP_N_COUNTRIES = 15
export const MAX_CITIES_PER_COUNTRY = 10
// A city is tried from at most this many home airports (cheapest first), and
// only the next one is tried when the previous one has no matching day.
const MAX_ORIGINS_PER_CITY = 3

export type AnywhereParams = {
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
}

export function parseAnywhereParams(searchParams: URLSearchParams): { origins: string[]; params: AnywhereParams } {
  const originsParam = searchParams.get('origins')
  const origins = (
    originsParam
      ? originsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : ['BTS', 'VIE', 'BUD', 'KSC', 'PRG']
  ).slice(0, MAX_ORIGINS)

  return {
    origins,
    params: {
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
    },
  }
}

// ---------------------------------------------------------------------------
// Phase 1: rough ranking
// ---------------------------------------------------------------------------

type RoughCandidate = {
  cityCode: string
  cityName: string
  origin: string
  roughPrice: number
  example: Flight | null
}

type CountryGroup = {
  code: string
  name: string
  /** One entry per city, best (cheapest) home airport first inside `originsFor`. */
  cities: { cityCode: string; cityName: string; options: RoughCandidate[] }[]
  roughPrice: number
}

async function fetchCityDirections(origin: string, token: string | undefined) {
  try {
    const url = `https://api.travelpayouts.com/v1/city-directions?origin=${origin}&currency=eur&token=${token}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    const data: Record<string, CheapEntry> = json.data || {}
    const results: { cityCode: string; origin: string; roughPrice: number; example: Flight | null }[] = []
    for (const [cityCode, entry] of Object.entries(data)) {
      if (typeof entry?.price === 'number') {
        results.push({ cityCode, origin, roughPrice: entry.price, example: normalizeFromCheap(entry, origin, cityCode) })
      }
    }
    return results
  } catch {
    return []
  }
}

/** Rough ranking of every country reachable from the chosen airports, cheapest first. */
export async function rankCountries(origins: string[], token: string | undefined) {
  const perOrigin = await Promise.all(origins.map((o) => fetchCityDirections(o, token)))
  // A home airport is never a destination (e.g. Vienna when searching from Vienna + Budapest).
  const all = perOrigin.flat().filter((c) => !origins.includes(c.cityCode))

  const cityCodes = Array.from(new Set(all.map((c) => c.cityCode)))
  const info = await getCityInfoForCodes(cityCodes)

  const byCountry = new Map<string, CountryGroup>()
  const byCity = new Map<string, RoughCandidate[]>()

  for (const c of all) {
    const city = info.get(c.cityCode)
    if (!city) continue // can't place it on a country -- left out, not guessed
    const candidate: RoughCandidate = { ...c, cityName: city.name }
    const list = byCity.get(c.cityCode) || []
    list.push(candidate)
    byCity.set(c.cityCode, list)
  }

  for (const [cityCode, options] of byCity) {
    options.sort((a, b) => a.roughPrice - b.roughPrice)
    const city = info.get(cityCode)!
    const group = byCountry.get(city.country.code) || {
      code: city.country.code,
      name: city.country.name,
      cities: [],
      roughPrice: Infinity,
    }
    group.cities.push({ cityCode, cityName: city.name, options: options.slice(0, MAX_ORIGINS_PER_CITY) })
    group.roughPrice = Math.min(group.roughPrice, options[0].roughPrice)
    byCountry.set(city.country.code, group)
  }

  const countries = Array.from(byCountry.values()).map((g) => ({
    ...g,
    cities: g.cities.sort((a, b) => a.options[0].roughPrice - b.options[0].roughPrice),
  }))
  countries.sort((a, b) => a.roughPrice - b.roughPrice)

  return { countries, totalCities: byCity.size }
}

export type RankedCountry = Awaited<ReturnType<typeof rankCountries>>['countries'][number]
type RankedCity = RankedCountry['cities'][number]

// ---------------------------------------------------------------------------
// Phase 2: honest check of one city from one home airport
// ---------------------------------------------------------------------------

function tripFromFare(fare: Fare): AnywhereTrip {
  return {
    price: fare.price,
    kind: 'fare',
    outbound: { ...fare.outbound, price: null },
    inbound: fare.inbound ? { ...fare.inbound, price: null } : null,
  }
}

async function checkCityFromOrigin(
  origin: string,
  cityCode: string,
  params: AnywhereParams,
  token: string | undefined
): Promise<AnywhereTrip | null> {
  if (params.dateMode === 'range') {
    const flights = await getRangeFlights(
      origin, cityCode, params.rangeStart || undefined, params.rangeEnd || undefined,
      params.minDays, params.maxDays, token, { enrich: false, oneWay: params.oneWay }
    )
    if (flights.length === 0) return null
    const [winner] = await completeFlights([flights[0]], token)
    return tripFromFare(flightToFare(winner))
  }

  if (params.dateMode === 'month') {
    if (!params.month) return null
    const outDetailed = await fetchMonthCalendarDetailed(origin, cityCode, params.month, token)
    const outDays: Record<string, CalendarDay> = {}
    for (const [date, e] of Object.entries(outDetailed)) {
      outDays[date] = { ...e, origin, airlineName: null }
    }

    if (params.oneWay) {
      const matching = Object.entries(outDays).filter(([date]) => {
        const [y, m, d] = date.split('-').map(Number)
        return params.outDays.includes(new Date(y, m - 1, d).getDay())
      })
      if (matching.length === 0) return null
      const [date, day] = matching.reduce((min, cur) => (cur[1].price < min[1].price ? cur : min))
      const leg = calendarDayToFare(day, date, origin, cityCode).outbound
      return { price: day.price, kind: 'legs', outbound: { ...leg, price: day.price }, inbound: null }
    }

    if (!params.returnMonth) return null
    const backDetailed = await fetchMonthCalendarDetailed(cityCode, origin, params.returnMonth, token)
    const backDays: Record<string, CalendarDay> = {}
    for (const [date, e] of Object.entries(backDetailed)) {
      backDays[date] = { ...e, origin, airlineName: null }
    }
    const [best] = findBestCombinations(
      outDays, backDays, params.outDays, params.backDays, params.minNights, params.maxNights, 1
    )
    if (!best) return null
    const outLeg = calendarDayToFare(best.out, best.outDate, origin, cityCode).outbound
    const backLeg = calendarDayToFare(best.back, best.backDate, cityCode, origin).outbound
    return {
      price: best.total,
      kind: 'legs',
      outbound: { ...outLeg, price: best.outPrice },
      inbound: { ...backLeg, price: best.backPrice },
    }
  }

  // exact dates
  if (!params.departDate) return null
  const flights = await getDayFlights(origin, cityCode, params.departDate, token, {
    enrich: false,
    oneWay: params.oneWay,
    returnDate: params.oneWay ? null : params.returnDate,
  })
  // A round trip asked for an exact return date: only a fare with that return counts.
  const usable =
    !params.oneWay && params.returnDate ? flights.filter((f) => f.returnDate === params.returnDate) : flights
  if (usable.length === 0) return null
  const [winner] = await completeFlights([usable[0]], token)
  return tripFromFare(flightToFare(winner, params.returnDate))
}

/** Checks one city against the filters, trying its next-best home airport when
 * the first one has no matching day. */
export async function checkCity(
  city: RankedCity,
  params: AnywhereParams,
  token: string | undefined
): Promise<{ origin: string; trip: AnywhereTrip } | null> {
  for (const option of city.options) {
    const trip = await checkCityFromOrigin(option.origin, city.cityCode, params, token)
    if (trip) return { origin: option.origin, trip }
  }
  return null
}

// ---------------------------------------------------------------------------
// Output shaping
// ---------------------------------------------------------------------------

function exampleFor(option: RoughCandidate): AnywhereCity['example'] {
  if (!option.example) return null
  const fare = flightToFare(option.example)
  return { price: fare.price, outbound: fare.outbound, inbound: fare.inbound }
}

export function toAnywhereCity(city: RankedCity, checked?: { origin: string; trip: AnywhereTrip } | null): AnywhereCity {
  const best = city.options[0]
  return {
    code: city.cityCode,
    name: city.cityName,
    origin: checked?.origin ?? best.origin,
    roughPrice: best.roughPrice,
    example: exampleFor(checked ? city.options.find((o) => o.origin === checked.origin) || best : best),
    trip: checked === undefined ? undefined : checked ? checked.trip : null,
  }
}

/** Fills in airline names on every leg of the given cities (one lookup for all). */
export async function nameAirlines(cities: AnywhereCity[]): Promise<void> {
  const legs: Leg[] = []
  for (const c of cities) {
    if (c.example) legs.push(c.example.outbound, ...(c.example.inbound ? [c.example.inbound] : []))
    if (c.trip) legs.push(c.trip.outbound, ...(c.trip.inbound ? [c.trip.inbound] : []))
  }
  const names = await getAirlineNames(legs.map((l) => l.airlineCode))
  for (const leg of legs) {
    if (leg.airlineCode && !leg.airlineName) leg.airlineName = names.get(leg.airlineCode) || null
  }
}
