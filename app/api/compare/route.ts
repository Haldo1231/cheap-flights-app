import { NextResponse } from 'next/server'

const DEFAULT_ORIGINS = ['BTS', 'VIE', 'BUD', 'KSC']

async function searchExactOrMonth(
  origin: string,
  destination: string,
  token: string | undefined,
  dateMode: string,
  oneWay: boolean,
  searchParams: URLSearchParams
) {
  let url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=eur&token=${token}`

  if (dateMode === 'exact') {
    const departDate = searchParams.get('departDate')
    const returnDate = searchParams.get('returnDate')
    if (departDate) url += `&depart_date=${departDate}`
    if (!oneWay && returnDate) url += `&return_date=${returnDate}`
  } else if (dateMode === 'month') {
    const month = searchParams.get('month')
    if (month) url += `&depart_date=${month}`
    if (!oneWay && month) url += `&return_date=${month}`
  }

  const res = await fetch(url)
  const json = await res.json()

  const destData = json.data?.[destination]
  if (!destData) return null
  const firstEntry: any = Object.values(destData)[0]
  if (!firstEntry) return null

  return {
    origin,
    price: firstEntry.price,
    departure_at: firstEntry.departure_at,
    return_at: firstEntry.return_at,
  }
}

async function searchLeg(
  origin: string,
  destination: string,
  token: string | undefined,
  date: string | undefined
) {
  let url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=eur&token=${token}`
  if (date) url += `&depart_date=${date}`

  const res = await fetch(url)
  const json = await res.json()

  const destData = json.data?.[destination]
  if (!destData) return null
  const firstEntry: any = Object.values(destData)[0]
  if (!firstEntry) return null

  return {
    price: firstEntry.price,
    departure_at: firstEntry.departure_at,
  }
}

async function searchRange(
  origin: string,
  destination: string,
  token: string | undefined,
  searchParams: URLSearchParams
) {
  const rangeStart = searchParams.get('rangeStart')
  const rangeEnd = searchParams.get('rangeEnd')
  const minDuration = parseInt(searchParams.get('minDays') || '2', 10)
  const maxDuration = parseInt(searchParams.get('maxDays') || '10', 10)

  const url = `https://api.travelpayouts.com/v2/prices/latest?currency=eur&origin=${origin}&destination=${destination}&min_trip_duration=${minDuration}&max_trip_duration=${maxDuration}&sorting=price&limit=30&token=${token}`

  const res = await fetch(url)
  const json = await res.json()
  let entries = json.data || []

  if (rangeStart) {
    entries = entries.filter(
      (e: any) => e.depart_date >= rangeStart && (!rangeEnd || e.depart_date <= rangeEnd)
    )
  }

  if (!entries.length) return null

  const cheapest = entries.reduce((min: any, e: any) => (e.value < min.value ? e : min), entries[0])

  return {
    origin,
    price: cheapest.value,
    departure_at: cheapest.depart_date,
    return_at: cheapest.return_date,
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

  const results = await Promise.all(
    origins.map(async (origin) => {
      if (dateMode === 'range') {
        return await searchRange(origin, destination, token, searchParams)
      }
      return await searchExactOrMonth(origin, destination, token, dateMode, oneWay, searchParams)
    })
  )

  const validResults = results.filter((r) => r !== null) as any[]
  validResults.sort((a, b) => a.price - b.price)

  return NextResponse.json({ destination, results: validResults })
}
