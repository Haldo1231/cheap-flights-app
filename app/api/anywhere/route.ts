import { NextResponse } from 'next/server'

const AIRPORTS = ['BTS', 'VIE', 'BUD', 'KSC']

const DESTINATIONS = [
  { code: 'ROM', name: 'Rome' },
  { code: 'MIL', name: 'Milan' },
  { code: 'BCN', name: 'Barcelona' },
  { code: 'ATH', name: 'Athens' },
  { code: 'PAR', name: 'Paris' },
  { code: 'LON', name: 'London' },
  { code: 'BER', name: 'Berlin' },
  { code: 'AMS', name: 'Amsterdam' },
  { code: 'LIS', name: 'Lisbon' },
  { code: 'WAW', name: 'Warsaw' },
  { code: 'KRK', name: 'Krakow' },
  { code: 'MAD', name: 'Madrid' },
]

export async function GET() {
  const token = process.env.TRAVELPAYOUTS_TOKEN

  const destinationResults = await Promise.all(
    DESTINATIONS.map(async (dest) => {
      const originResults = await Promise.all(
        AIRPORTS.map(async (origin) => {
          const url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${dest.code}&currency=eur&token=${token}`
          const res = await fetch(url)
          const json = await res.json()

          const destData = json.data?.[dest.code]
          if (!destData) return null

          const firstEntry: any = Object.values(destData)[0]
          if (!firstEntry) return null

          return {
            origin,
            price: firstEntry.price,
            departure_at: firstEntry.departure_at,
            return_at: firstEntry.return_at,
          }
        })
      )

      const valid = originResults.filter((r) => r !== null) as any[]
      if (valid.length === 0) return null

      valid.sort((a, b) => a.price - b.price)
      const best = valid[0]

      return {
        destination: dest.code,
        destinationName: dest.name,
        origin: best.origin,
        price: best.price,
        departure_at: best.departure_at,
        return_at: best.return_at,
      }
    })
  )

  const validDestinations = destinationResults.filter((r) => r !== null) as any[]
  validDestinations.sort((a, b) => a.price - b.price)

  return NextResponse.json({ results: validDestinations })
}
