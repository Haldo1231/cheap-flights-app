import { NextResponse } from 'next/server'
import { fetchMonthCalendar } from '../../flightSources'

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

  const result: Record<string, { price: number; origin: string }> = {}

  await Promise.all(
    origins.map(async (origin) => {
      // Inbound leg: flying FROM the destination city BACK TO this origin
      // airport, so the API call direction is reversed -- but the result's
      // "origin" should still mean "this home airport", not the destination
      // city, so it's set explicitly below rather than trusted from the call.
      const data =
        leg === 'inbound'
          ? await fetchMonthCalendar(destination, origin, month, token)
          : await fetchMonthCalendar(origin, destination, month, token)

      for (const [date, entry] of Object.entries(data)) {
        if (!result[date] || entry.price < result[date].price) {
          result[date] = { price: entry.price, origin }
        }
      }
    })
  )

  return NextResponse.json({ data: result })
}
