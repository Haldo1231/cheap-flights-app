import { flightToFare, getReturnFares } from '../../flightSources'
import { HOME_AIRPORTS } from '../../homeAirports'
import { badRequest, cachedJson, cleanCode, cleanCodes, cleanDate, cleanInt } from '../../lib/apiParams'
import type { Fare } from '../../tripTypes'

export type ReturnFlightsResponse = {
  /** One-way fares back to the home airports, cheapest first. */
  results: Fare[]
  /** How many matching fares there were before the list was cut. */
  total: number
  /** The airports that were looked at. */
  airports: string[]
}

// "Find a flight back": cached one-way fares from `from` (where the outbound flight lands) to every home airport, for one
// day (mode=exact&date=) or a range of days (mode=range&start=&end=). `after` (the outbound day) drops anything earlier.
// `limit` (default 60, at most 400) is how many of the cheapest fares come back: the month calendar asks for a whole month.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = cleanCode(searchParams.get('from'))
  if (!from) return badRequest('Missing or invalid from')
  const airports = cleanCodes(searchParams.get('to'), HOME_AIRPORTS)
  const after = cleanDate(searchParams.get('after'))
  const exact = searchParams.get('mode') === 'exact'
  const start = cleanDate(exact ? searchParams.get('date') : searchParams.get('start'))
  const end = exact ? start : cleanDate(searchParams.get('end'))
  if (!start || !end) return badRequest('Missing or invalid dates')
  if (end < start) return badRequest('The end day is before the start day')

  const limit = cleanInt(searchParams.get('limit'), 60, 1, 400)
  const { fares, total } = await getReturnFares(from, airports, process.env.TRAVELPAYOUTS_TOKEN, { start, end, after }, limit)
  return cachedJson<ReturnFlightsResponse>({ results: fares.map((f) => flightToFare(f)), total, airports })
}
