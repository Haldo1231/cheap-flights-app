import { compareFlights, fetchMonthDays } from '../../flightSources'
import { getAirlineNames } from '../../airlines'
import { badRequest, cachedJson, cleanCode, cleanCodes, cleanMonth } from '../../lib/apiParams'
import type { CalendarDay, CalendarDayMap } from '../../tripTypes'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = cleanCode(searchParams.get('destination'))
  const month = cleanMonth(searchParams.get('month'))
  const leg = searchParams.get('leg') === 'inbound' ? 'inbound' : 'outbound'

  if (!destination || !month) return badRequest('Missing or invalid destination or month')

  const origins = cleanCodes(searchParams.get('origins'), [])
  const token = process.env.TRAVELPAYOUTS_TOKEN

  const result: CalendarDayMap = {}

  await Promise.all(
    origins.map(async (origin) => {
      // Inbound leg: flying FROM the destination city BACK TO this origin
      // airport, so the API call direction is reversed -- but the result's
      // "origin" should still mean "this home airport", not the destination
      // city, so it's set explicitly below rather than trusted from the call.
      const data =
        leg === 'inbound'
          ? await fetchMonthDays(destination, origin, month, token)
          : await fetchMonthDays(origin, destination, month, token)

      for (const [date, entry] of Object.entries(data)) {
        // Across home airports: the cheapest valid price of the day (an outdated one never beats a valid one).
        const better = !result[date] || compareFlights(entry, { price: result[date].price, outdated: !!result[date].outdated }) < 0
        if (better) {
          result[date] = {
            price: entry.price,
            origin,
            airlineCode: entry.airlineCode,
            airlineName: null,
            time: entry.time,
            stops: entry.stops,
            returnDate: entry.returnDate,
            returnTime: entry.returnTime,
            foundAt: entry.foundAt,
            outdated: entry.outdated,
          }
        }
      }
    })
  )

  const names = await getAirlineNames(Object.values(result).map((d: CalendarDay) => d.airlineCode))
  for (const day of Object.values(result)) {
    if (day.airlineCode) day.airlineName = names.get(day.airlineCode) || null
  }

  return cachedJson({ data: result })
}
