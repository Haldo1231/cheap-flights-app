import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/supabaseAdmin'

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

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
        origin: best.origin,
        destination: dest.code,
        destination_city: dest.name,
        price: best.price,
        departure_date: best.departure_at?.split('T')[0],
        return_date: best.return_at?.split('T')[0],
      }
    })
  )

  const validDeals = destinationResults.filter((r) => r !== null) as any[]
  validDeals.sort((a, b) => a.price - b.price)
  const topDeals = validDeals.slice(0, 6)

  await supabaseAdmin.from('weekly_deals').delete().neq('id', 0)
  const { error } = await supabaseAdmin.from('weekly_deals').insert(topDeals)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: topDeals.length })
}
