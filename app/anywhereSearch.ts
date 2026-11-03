// Anywhere search, shared by the country list and the country detail routes.
//
// Two phases keep API usage small while staying honest about the filters:
//  1. Rough ranking: ONE call per home airport lists ~30 real destinations with
//     a rough cached price each (no weekday awareness).
//  2. Honest check: only for the cities we actually show, we look at the real
//     day-by-day data and apply the date/weekday/nights filters. A city only
//     gets a price when a day that really matches the filters has a cached fare.
//     The check looks at EVERY chosen home airport and reads the very same
//     month calendars / fare lists (same requests, same one-hour cache) as the
//     city page, so a country screen and the city's own calendar always agree.

import {
  getDayFlights,
  getRangeFlights,
  getMonthDaysByOrigin,
  cheapestPerDay,
  currencyIsEuro,
  findOpenJawPairs,
  flightToLeg,
  completeFlights,
  flightToFare,
  normalizeFromCheap,
  type CalendarDayDetail,
  type CheapEntry,
  type Flight,
} from './flightSources'
import { getCityInfoForCodes } from './geoData'
import { getAirlineNames } from './airlines'
import { parseDays, dayOfWeek, findBestCombinations, matchesWeekdays, type Combination } from './weekdays'
import { calendarDayToFare } from './lib/trip'
import { mapWithLimit } from './lib/pool'
import type { AnywhereCity, AnywhereTrip, CalendarDay, Fare, Leg } from './tripTypes'
import { cleanCodes, cleanDate, cleanInt, cleanMonth, MAX_ORIGINS as MAX_ORIGIN_CODES } from './lib/apiParams'
import { HOME_AIRPORTS } from './homeAirports'
import { openJawFilterFor } from './openJawFilter'
import { oldestSeen } from './lib/priceAge'

// Bounds shown to the user ("checked the N cheapest-looking countries").
export { mapWithLimit }

export const MAX_ORIGINS = MAX_ORIGIN_CODES
export const TOP_N_COUNTRIES = 15
export const MAX_CITIES_PER_COUNTRY = 10
// The quick ranking keeps this many home airports per city (cheapest first) for the rough price and the
// "from X" example. The honest check below does NOT use this limit: it looks at every chosen airport.
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
  const origins = cleanCodes(searchParams.get('origins'), HOME_AIRPORTS, MAX_ORIGINS)

  return {
    origins,
    params: {
      dateMode: searchParams.get('dateMode') || 'exact',
      oneWay: searchParams.get('oneWay') === 'true',
      departDate: cleanDate(searchParams.get('departDate')),
      returnDate: cleanDate(searchParams.get('returnDate')),
      month: cleanMonth(searchParams.get('month')),
      returnMonth: cleanMonth(searchParams.get('returnMonth')) ?? cleanMonth(searchParams.get('month')),
      outDays: parseDays(searchParams.get('outDays')),
      backDays: parseDays(searchParams.get('backDays')),
      minNights: cleanInt(searchParams.get('minNights'), 1, 1, 60),
      maxNights: cleanInt(searchParams.get('maxNights'), 14, 1, 60),
      rangeStart: cleanDate(searchParams.get('rangeStart')),
      rangeEnd: cleanDate(searchParams.get('rangeEnd')),
      minDays: cleanInt(searchParams.get('minDays'), 2, 1, 30),
      maxDays: cleanInt(searchParams.get('maxDays'), 10, 1, 30),
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
    if (!currencyIsEuro(json)) return []
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
// Phase 2: honest check of one city from every chosen home airport
// ---------------------------------------------------------------------------

function tripFromFare(fare: Fare): AnywhereTrip {
  return {
    price: fare.price,
    kind: 'fare',
    outbound: { ...fare.outbound, price: null },
    inbound: fare.inbound ? { ...fare.inbound, price: null } : null,
    seenAt: fare.seenAt,
  }
}

/** A month-calendar entry of one home airport, in the shape the day-pair code works with. */
function withOrigin(days: Record<string, CalendarDayDetail> | undefined, origin: string): Record<string, CalendarDay> {
  const result: Record<string, CalendarDay> = {}
  for (const [date, e] of Object.entries(days ?? {})) result[date] = { ...e, origin, airlineName: null }
  return result
}

/** Exact dates and date range: the cheapest fare of ONE home airport that fits the filters (null = none). Lists are cheapest
 * first, so the first usable one is the winner. Uses the same lists as the city page (`/api/compare`). */
async function cheapestUsableFlight(origin: string, cityCode: string, params: AnywhereParams, token: string | undefined): Promise<Flight | null> {
  if (params.dateMode === 'range') {
    const flights = await getRangeFlights(
      origin, cityCode, params.rangeStart || undefined, params.rangeEnd || undefined,
      params.minDays, params.maxDays, token, { enrich: false, oneWay: params.oneWay }
    )
    // Only fares on the chosen weekdays count. A one-way search never takes a fare with a return date: that is a
    // round-trip price.
    return flights.find((f) => matchesWeekdays(f, params.outDays, params.backDays, params.oneWay) && (!params.oneWay || f.returnDate === null)) ?? null
  }

  // exact dates
  if (!params.departDate) return null
  const flights = await getDayFlights(origin, cityCode, params.departDate, token, {
    enrich: false,
    oneWay: params.oneWay,
    returnDate: params.oneWay ? null : params.returnDate,
  })
  // A round trip asked for an exact return date: only a fare with that return counts. A one-way search never takes a
  // fare with a return date (the "cheap" list holds round-trip fares even when one way is asked).
  return (
    flights.find((f) =>
      params.oneWay ? f.returnDate === null : params.returnDate ? f.returnDate === params.returnDate : true
    ) ?? null
  )
}

/** Whole month: the best trip from the month calendars of every chosen airport (the data the city page's calendar shows). */
async function checkCityMonth(
  cityCode: string,
  params: AnywhereParams,
  origins: string[],
  token: string | undefined
): Promise<{ origin: string; trip: AnywhereTrip } | null> {
  if (!params.month) return null

  if (params.oneWay) {
    // One-way prices only: a calendar entry with a return date is a round-trip price (see fetchMonthOneWayDays).
    // For every day the cheapest fare among the airports, exactly as the city page's calendar shows it.
    const perDay = cheapestPerDay(await getMonthDaysByOrigin(origins, cityCode, params.month, 'outbound', true, token))
    const matching = Object.entries(perDay).filter(([date]) => params.outDays.includes(dayOfWeek(date)))
    if (matching.length === 0) return null
    // Cheapest day first; the earlier day wins a tie.
    const [date, day] = matching.reduce((min, cur) => (cur[1].price < min[1].price || (cur[1].price === min[1].price && cur[0] < min[0]) ? cur : min))
    const leg = calendarDayToFare({ ...day, airlineName: null }, date, day.origin, cityCode).outbound
    return { origin: day.origin, trip: { price: day.price, kind: 'legs', outbound: { ...leg, price: day.price }, inbound: null, seenAt: day.foundAt ?? null } }
  }

  if (!params.returnMonth) return null
  const returnMonth = params.returnMonth
  const [outByOrigin, backByOrigin] = await Promise.all([
    getMonthDaysByOrigin(origins, cityCode, params.month, 'outbound', false, token),
    getMonthDaysByOrigin(origins, cityCode, returnMonth, 'inbound', false, token),
  ])

  // A round trip comes back to the airport it left from: day pairs are made inside each airport's own calendars. The
  // trip must leave in the departure month and come back in the return month. The cheapest airport wins (the first listed
  // one on a tie).
  let best: { origin: string; combo: Combination<CalendarDay> } | null = null
  for (const origin of origins) {
    const [combo] = findBestCombinations(
      withOrigin(outByOrigin[origin], origin), withOrigin(backByOrigin[origin], origin),
      params.outDays, params.backDays, params.minNights, params.maxNights, 1,
      { out: params.month, back: returnMonth }
    )
    if (combo && (!best || combo.total < best.combo.total)) best = { origin, combo }
  }
  if (!best) return null

  const { origin, combo } = best
  if (combo.kind === 'fare' || !combo.back) {
    // One round-trip fare covers both flights: one price, not split.
    return { origin, trip: tripFromFare(calendarDayToFare(combo.out, combo.outDate, origin, cityCode)) }
  }
  const outLeg = calendarDayToFare(combo.out, combo.outDate, origin, cityCode).outbound
  const backLeg = calendarDayToFare(combo.back, combo.backDate, cityCode, origin).outbound
  return {
    origin,
    trip: {
      price: combo.total,
      kind: 'legs',
      outbound: { ...outLeg, price: combo.outPrice },
      inbound: { ...backLeg, price: combo.backPrice },
    },
  }
}

/** The best trip to this city that comes back to a DIFFERENT home airport: a one-way fare out plus a one-way fare back,
 * paired and filtered by exactly the same code as the destination results (findOpenJawPairs). It may leave from any of
 * the chosen home airports and return to any of BTS/VIE/BUD/KSC/PRG or the chosen ones.
 * null when no pair of cached one-way fares fits the filters. Uses the one-way list only (no calendars) to keep the
 * number of price requests low on the Anywhere screens. */
export async function checkCityOpenJaw(
  cityCode: string,
  origins: string[],
  params: AnywhereParams,
  token: string | undefined
): Promise<AnywhereTrip | null> {
  if (params.oneWay) return null
  const returnTo = Array.from(new Set([...origins, ...HOME_AIRPORTS]))
  const { pairs } = await findOpenJawPairs(origins, returnTo, cityCode, token, openJawFilterFor(params), 1, { calendar: false })
  const best = pairs[0]
  if (!best) return null
  // The older of the two prices decides what "seen" says.
  const oldest = oldestSeen(best.out.foundAt, best.back.foundAt)
  return {
    price: best.total,
    kind: 'legs',
    outbound: { ...flightToLeg(best.out), price: best.out.price },
    inbound: { ...flightToLeg(best.back), price: best.back.price },
    seenAt: oldest,
  }
}

/** Checks one city against the filters from EVERY chosen home airport and keeps the cheapest trip that fits. This reads the
 * same data as the city page (the month calendars of `/api/calendar`, the fare lists of `/api/compare`) for the same
 * airports, so the country screen and the city's own calendar agree: a city is only "no matching day" when none of the
 * chosen airports has a fare on a matching day. */
export async function checkCity(
  city: RankedCity,
  params: AnywhereParams,
  origins: string[],
  token: string | undefined
): Promise<{ origin: string; trip: AnywhereTrip } | null> {
  if (params.dateMode === 'month') return checkCityMonth(city.cityCode, params, origins, token)

  const flights = await Promise.all(origins.map((origin) => cheapestUsableFlight(origin, city.cityCode, params, token)))
  // The cheapest of all airports (the first listed one on a tie).
  let winner: Flight | null = null
  for (const f of flights) if (f && (!winner || f.price < winner.price)) winner = f
  if (!winner) return null

  // Airline and time are looked up for the winner only (at most one calendar request).
  const [done] = await completeFlights([winner], token)
  return { origin: done.origin, trip: tripFromFare(flightToFare(done, params.dateMode === 'range' ? undefined : params.returnDate)) }
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
