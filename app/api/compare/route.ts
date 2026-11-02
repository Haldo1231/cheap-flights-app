import { findOpenJawPairs, getDayFlights, getRangeFlights, getCheapestOneWayLeg, flightToFare, type Flight } from '../../flightSources'
import { buildBookingLink } from '../../aviasalesLink'
import { ALL_WEEKDAYS as ALL_DAYS, matchesWeekdays, parseDays } from '../../weekdays'
import { HOME_AIRPORTS } from '../../homeAirports'
import { badRequest, cachedJson, cleanCode, cleanCodes, cleanDate, cleanInt, cleanMonth } from '../../lib/apiParams'
import type { CompareResponse, Fare, OpenJawCombo, PricedLeg } from '../../tripTypes'

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
    seenAt: f.foundAt,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = cleanCode(searchParams.get('destination'))
  const oneWay = searchParams.get('oneWay') === 'true'
  const dateMode = searchParams.get('dateMode') || 'exact'

  if (!destination) return badRequest('Missing or invalid destination')

  const origins = cleanCodes(searchParams.get('origins'), HOME_AIRPORTS)
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const openJaw = searchParams.get('openJaw') === 'true'
  // leg=inbound: `destination` is the city you fly FROM and `origins` are the
  // home airports you fly BACK TO (used for the return day of a Whole Month trip).
  const inboundLeg = searchParams.get('leg') === 'inbound'

  // Fly out from one home airport and come back to ANOTHER: two one-way tickets, each at its own cached price.
  if (openJaw && !oneWay && (dateMode === 'exact' || dateMode === 'range')) {
    const outDays = parseDays(searchParams.get('outDays'))
    const backDays = parseDays(searchParams.get('backDays'))
    let filter
    if (dateMode === 'exact') {
      const departDate = cleanDate(searchParams.get('departDate'))
      const returnDate = cleanDate(searchParams.get('returnDate'))
      // No return day named: look at every return from the next day up to two weeks later.
      filter = { outFrom: departDate ?? '9999-12-31', outTo: departDate ?? '0000-01-01', minNights: 1, maxNights: returnDate ? 60 : 14, backDate: returnDate, outDays: ALL_DAYS, backDays: ALL_DAYS }
    } else {
      filter = {
        outFrom: cleanDate(searchParams.get('rangeStart')) ?? '0000-01-01',
        outTo: cleanDate(searchParams.get('rangeEnd')) ?? '9999-12-31',
        minNights: cleanInt(searchParams.get('minDays'), 2, 1, 30),
        maxNights: cleanInt(searchParams.get('maxDays'), 10, 1, 30),
        backDate: null,
        outDays,
        backDays,
      }
    }
    // Out from the chosen airports; back to ANY of the home airports (BTS, VIE, BUD, KSC, PRG) or the chosen ones.
    const returnTo = Array.from(new Set([...origins, ...HOME_AIRPORTS]))
    const { pairs, outCount, backCount } = await findOpenJawPairs(origins, returnTo, destination, token, filter)
    const body: CompareResponse = {
      openJaw: true,
      destination,
      results: pairs.map((p) => ({ outbound: toPricedLeg(p.out), inbound: toPricedLeg(p.back), total: p.total })),
      missingOutbound: outCount === 0,
      missingReturn: backCount === 0,
      outboundOnly: [],
    }
    return cachedJson(body)
  }

  if (openJaw && !oneWay && dateMode === 'month') {
    const outDate = cleanMonth(searchParams.get('month'))
    const backDate = cleanMonth(searchParams.get('month'))

    const [outLegs, backLegs] = await Promise.all([
      // Each flight is priced on its own and the two are added, so only ONE-WAY fares count: a round-trip fare
      // already pays for two flights and would be counted twice.
      Promise.all(origins.map((o) => getCheapestOneWayLeg(o, destination, outDate ?? undefined, token))),
      Promise.all(origins.map((o) => getCheapestOneWayLeg(destination, o, backDate ?? undefined, token))),
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

    const body: CompareResponse = {
      openJaw: true,
      destination,
      results: combos.slice(0, 8),
      missingOutbound: validOut.length === 0,
      missingReturn: validBack.length === 0,
      outboundOnly: validBack.length === 0 ? validOut.sort((a, b) => a.price - b.price) : [],
    }
    return cachedJson(body)
  }

  let allFlights: Flight[] = []
  const requestedReturn = oneWay ? null : cleanDate(searchParams.get('returnDate'))

  if (dateMode === 'range') {
    const rangeStart = cleanDate(searchParams.get('rangeStart')) ?? undefined
    const rangeEnd = cleanDate(searchParams.get('rangeEnd')) ?? undefined
    const minDays = cleanInt(searchParams.get('minDays'), 2, 1, 30)
    const maxDays = cleanInt(searchParams.get('maxDays'), 10, 1, 30)

    const perOrigin = await Promise.all(
      origins.map((origin) => getRangeFlights(origin, destination, rangeStart, rangeEnd, minDays, maxDays, token, { oneWay }))
    )
    // Weekday limits (off unless the address has them): the same rule Anywhere uses.
    const outDays = parseDays(searchParams.get('outDays'))
    const backDays = parseDays(searchParams.get('backDays'))
    allFlights = perOrigin.flat().filter((f) => matchesWeekdays(f, outDays, backDays, oneWay))
  } else {
    // exact-date mode (and the fallback for any other non-openJaw mode)
    const departDate = cleanDate(searchParams.get('departDate'))
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

  const body: CompareResponse = {
    destination,
    results: fares,
    total: allFlights.length,
    requestedReturn,
    oneWayRequested: oneWay,
  }
  return cachedJson(body)
}

