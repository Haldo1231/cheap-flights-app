import { NextResponse } from 'next/server'
import { fetchMonthCalendarDetailed } from '../../flightSources'
import { getAirlineNames } from '../../airlines'
import type { CalendarDay, CalendarDayMap } from '../../tripTypes'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = searchParams.get('destination')
  const originsParam = searchParams.get('origins')
  const month = searchParams.get('month')
  const leg = searchParams.get('leg') || 'outbound'

  if (!destination || !month) {
    return NextResponse.json({ error: 'Missing destination or month' }, { status: 400 })
  }

  const origins = originsParam ? originsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []
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
          ? await fetchMonthCalendarDetailed(destination, origin, month, token)
          : await fetchMonthCalendarDetailed(origin, destination, month, token)

      for (const [date, entry] of Object.entries(data)) {
        if (!result[date] || entry.price < result[date].price) {
          result[date] = {
            price: entry.price,
            origin,
            airlineCode: entry.airlineCode,
            airlineName: null,
            time: entry.time,
            stops: entry.stops,
            returnDate: entry.returnDate,
            returnTime: entry.returnTime,
          }
        }
      }
    })
  )

  const names = await getAirlineNames(Object.values(result).map((d: CalendarDay) => d.airlineCode))
  for (const day of Object.values(result)) {
    if (day.airlineCode) day.airlineName = names.get(day.airlineCode) || null
  }

  return NextResponse.json({ data: result })
}
