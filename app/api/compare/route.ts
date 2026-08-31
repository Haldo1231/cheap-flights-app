import { NextResponse } from 'next/server'

const AIRPORTS = ['BTS', 'VIE', 'BUD', 'KSC']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = searchParams.get('destination')

  if (!destination) {
    return NextResponse.json({ error: 'Missing destination' }, { status: 400 })
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN

  const results = await Promise.all(
    AIRPORTS.map(async (origin) => {
      const url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=eur&token=${token}`
      const res = await fetch(url)
      const json = await res.json()

      const destData = json.data?.[destination]
      if (!destData) return { origin, price: null }

      const firstEntry: any = Object.values(destData)[0]
      if (!firstEntry) return { origin, price: null }

      return {
        origin,
        price: firstEntry.price,
        departure_at: firstEntry.departure_at,
        return_at: firstEntry.return_at,
        airline: firstEntry.airline,
      }
    })
  )

  const validResults = results.filter((r) => r.price !== null)
  validResults.sort((a, b) => (a.price as number) - (b.price as number))

  return NextResponse.json({ destination, results: validResults })
}
