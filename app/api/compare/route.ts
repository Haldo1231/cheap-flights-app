import { NextResponse } from 'next/server'
import { getDayFlights, getRangeFlights, getCheapestLeg, flightToFare, type Flight } from '../../flightSources'
import { buildBookingLink } from '../../aviasalesLink'
import type { Fare, OpenJawCombo, PricedLeg } from '../../tripTypes'

const DEFAULT_ORIGINS = ['BTS', 'VIE', 'BUD', 'KSC', 'PRG']

// Keeps the response (and the page) a sensible size for very busy routes.
const MAX_FARES = 100

function toPricedLeg(f: Flight): PricedLeg {
  return {
    origin: f.origin,
    destination: f.destination,
    date: f.departureDate,
    time: f.departureTime,
    airlineCode: f.airlineCode,
    airlineName: f.airlineName,
    stops: f.stops,
    bookingUrl: buildBookingLink(f.origin, f.destination, f.departureDate),
    price: f.price,
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
  // leg=inbound: `destination` is the city you fly FROM and `origins` are the
  // home airports you fly BACK TO (used for the return day of a Whole Month trip).
  const inboundLeg = searchParams.get('leg') === 'inbound'

  if (openJaw && !oneWay && (dateMode === 'exact' || dateMode === 'month')) {
    const outDate = dateMode === 'exact' ? searchParams.get('departDate') || undefined : searchParams.get('month') || undefined
    const backDate = dateMode === 'exact' ? searchParams.get('returnDate') || undefined : searchParams.get('month') || undefined

    const [outLegs, backLegs] = await Promise.all([
      Promise.all(origins.map((o) => getCheapestLeg(o, destination, outDate, token))),
      Promise.all(origins.map((o) => getCheapestLeg(destination, o, backDate, token))),
    ])

    const validOut = outLegs.filter((l): l is Flight => l !== null).map(toPricedLeg)
    const validBack = backLegs.filter((l): l is Flight => l !== null).map(toPricedLeg)

    // A trip only counts as a complete round trip when BOTH legs have a cached
    // price; otherwise we say which leg is missing instead of showing a half trip.
    const combos: OpenJawCombo[] = []
    for (const outbound of validOut) {
      for (const inbound of validBack) {
        combos.push({ outbound, inbound, total: outbound.price + inbound.price })
      }
    }
    combos.sort((a, b) => a.total - b.total)

    return NextResponse.json({
      destination,
      openJaw: true,
      results: combos.slice(0, 8),
      missingOutbound: validOut.length === 0,
      missingReturn: validBack.length === 0,
      outboundOnly: validBack.length === 0 ? validOut.sort((a, b) => a.price - b.price) : [],
    })
  }

  let allFlights: Flight[] = []
  const requestedReturn = oneWay ? null : searchParams.get('returnDate')

  if (dateMode === 'range') {
    const rangeStart = searchParams.get('rangeStart') || undefined
    const rangeEnd = searchParams.get('rangeEnd') || undefined
    const minDays = parseInt(searchParams.get('minDays') || '2', 10)
    const maxDays = parseInt(searchParams.get('maxDays') || '10', 10)

    const perOrigin = await Promise.all(
      origins.map((origin) => getRangeFlights(origin, destination, rangeStart, rangeEnd, minDays, maxDays, token, { oneWay }))
    )
    allFlights = perOrigin.flat()
  } else {
    // exact-date mode (and the fallback for any other non-openJaw mode)
    const departDate = searchParams.get('departDate')
    if (departDate) {
      const perOrigin = await Promise.all(
        origins.map((origin) =>
          inboundLeg
            ? getDayFlights(destination, origin, departDate, token, { oneWay, returnDate: requestedReturn })
            : getDayFlights(origin, destination, departDate, token, { oneWay, returnDate: requestedReturn })
        )
      )
      allFlights = perOrigin.flat()
    }
  }

  allFlights.sort((a, b) => a.price - b.price)

  const fares: Fare[] = allFlights.slice(0, MAX_FARES).map((f) => flightToFare(f, requestedReturn))

  return NextResponse.json({
    destination,
    results: fares,
    total: allFlights.length,
    requestedReturn,
    oneWayRequested: oneWay,
  })
}
