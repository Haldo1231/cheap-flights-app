import { NextResponse } from 'next/server'
import { getDayFlights, getRangeFlights } from '../../flightSources'

const DEFAULT_ORIGINS = ['BTS', 'VIE', 'BUD', 'KSC', 'PRG']

async function searchLeg(
  origin: string,
  destination: string,
  token: string | undefined,
  date: string | undefined
) {
  let url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=eur&token=${token}`
  if (date) url += `&depart_date=${date}`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()

    const destData = json.data?.[destination]
    if (!destData) return null
    const firstEntry: any = Object.values(destData)[0]
    if (!firstEntry) return null

    return {
      price: firstEntry.price,
      departure_at: firstEntry.departure_at,
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = searchParams.get('destination')
  const originsParam = searchParams.get('origins')
  const oneWay = searchParams.get('oneWay') === 'true'
  const dateMode = searchParams.get('dateMode') || 'exact'

  if (!destination) {
    return NextResponse.json({ error: 'Missing destination' }, { status: 400 })
  }

  const origins = originsParam
    ? originsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_ORIGINS

  const token = process.env.TRAVELPAYOUTS_TOKEN

  const openJaw = searchParams.get('openJaw') === 'true'

  if (openJaw && !oneWay && (dateMode === 'exact' || dateMode === 'month')) {
    const outDate = dateMode === 'exact' ? searchParams.get('departDate') || undefined : searchParams.get('month') || undefined
    const backDate = dateMode === 'exact' ? searchParams.get('returnDate') || undefined : searchParams.get('month') || undefined

    const outLegs = await Promise.all(
      origins.map(async (o) => ({ origin: o, leg: await searchLeg(o, destination, token, outDate) }))
    )
    const backLegs = await Promise.all(
      origins.map(async (o) => ({ origin: o, leg: await searchLeg(destination, o, token, backDate) }))
    )

    const validOut = outLegs.filter((l) => l.leg !== null)
    const validBack = backLegs.filter((l) => l.leg !== null)

    const combos: any[] = []
    for (const out of validOut) {
      for (const back of validBack) {
        combos.push({
          outOrigin: out.origin,
          backOrigin: back.origin,
          outPrice: out.leg!.price,
          backPrice: back.leg!.price,
          outDeparture: out.leg!.departure_at,
          backDeparture: back.leg!.departure_at,
          total: out.leg!.price + back.leg!.price,
        })
      }
    }

    combos.sort((a, b) => a.total - b.total)

    return NextResponse.json({ destination, openJaw: true, results: combos.slice(0, 8) })
  }

  let allFlights: Awaited<ReturnType<typeof getDayFlights>> = []

  if (dateMode === 'range') {
    const rangeStart = searchParams.get('rangeStart') || undefined
    const rangeEnd = searchParams.get('rangeEnd') || undefined
    const minDays = parseInt(searchParams.get('minDays') || '2', 10)
    const maxDays = parseInt(searchParams.get('maxDays') || '10', 10)

    const perOrigin = await Promise.all(
      origins.map((origin) => getRangeFlights(origin, destination, rangeStart, rangeEnd, minDays, maxDays, token))
    )
    allFlights = perOrigin.flat()
  } else {
    // exact-date mode (and the fallback for any other non-openJaw mode)
    const departDate = searchParams.get('departDate')
    if (departDate) {
      const perOrigin = await Promise.all(
        origins.map((origin) => getDayFlights(origin, destination, departDate, token))
      )
      allFlights = perOrigin.flat()
    }
  }

  allFlights.sort((a, b) => a.price - b.price)

  // Shape kept close to the old response (origin/price/departure_at/return_at)
  // so the results page's existing rendering keeps working, with the new
  // fields (airline, stops, gate) added alongside.
  const results = allFlights.map((f) => ({
    origin: f.origin,
    price: f.price,
    departure_at: f.departureTime ? `${f.departureDate}T${f.departureTime}:00` : f.departureDate,
    return_at: f.returnDate,
    stops: f.stops,
    airlineCode: f.airlineCode,
    airlineName: f.airlineName,
    gate: f.gate,
    bookingUrl: f.bookingUrl,
  }))

  return NextResponse.json({ destination, results })
}
