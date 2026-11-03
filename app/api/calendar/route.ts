import { cheapestPerDay, getMonthDaysByOrigin } from '../../flightSources'
import { getAirlineNames } from '../../airlines'
import { badRequest, cachedJson, cleanCode, cleanCodes, cleanMonth } from '../../lib/apiParams'
import type { CalendarDay, CalendarDayMap } from '../../tripTypes'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = cleanCode(searchParams.get('destination'))
  const month = cleanMonth(searchParams.get('month'))
  const leg = searchParams.get('leg') === 'inbound' ? 'inbound' : 'outbound'
  // A one-way search needs one-way prices: a calendar entry with a return date is a round-trip price.
  const oneWay = searchParams.get('oneWay') === 'true'

  if (!destination || !month) return badRequest('Missing or invalid destination or month')

  const origins = cleanCodes(searchParams.get('origins'), [])
  const token = process.env.TRAVELPAYOUTS_TOKEN

  // Inbound leg: flying FROM the destination city BACK TO each origin airport. Each fare's "origin" still means "this home
  // airport", not the destination city. The days come from the same function the Anywhere check uses (same requests, same cache).
  const merged = cheapestPerDay(await getMonthDaysByOrigin(origins, destination, month, leg, oneWay, token))

  const result: CalendarDayMap = {}
  for (const [date, entry] of Object.entries(merged)) {
    result[date] = {
      price: entry.price,
      origin: entry.origin,
      airlineCode: entry.airlineCode,
      airlineName: null,
      time: entry.time,
      stops: entry.stops,
      returnDate: entry.returnDate,
      returnTime: entry.returnTime,
      expiresAt: entry.expiresAt,
      foundAt: entry.foundAt,
    }
  }

  const names = await getAirlineNames(Object.values(result).map((d: CalendarDay) => d.airlineCode))
  for (const day of Object.values(result)) {
    if (day.airlineCode) day.airlineName = names.get(day.airlineCode) || null
  }

  return cachedJson({ data: result })
}
