import { NextResponse } from 'next/server'

async function fetchLegCalendar(origin: string, destination: string, month: string, token: string | undefined) {
  const url = `https://api.travelpayouts.com/v1/prices/calendar?origin=${origin}&destination=${destination}&depart_date=${month}&calendar_type=departure_date&currency=eur&token=${token}`
  const res = await fetch(url)
  const json = await res.json()
  return json.data || {}
}

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
      const data =
        leg === 'inbound'
          ? await fetchLegCalendar(destination, origin, month, token)
          : await fetchLegCalendar(origin, destination, month, token)

      for (const [date, entry] of Object.entries<any>(data)) {
        const price = entry?.price
        if (typeof price !== 'number') continue
        if (!result[date] || price < result[date].price) {
          result[date] = { price, origin }
        }
      }
    })
  )

  return NextResponse.json({ data: result })
}
