'use client'

import { useMemo } from 'react'
import { ALL_WEEKDAYS, dayOfWeek, findBestCombinations, serializeDays, type Combination } from '../../weekdays'
import { nightsBetweenDates } from '../../lib/format'
import { useJson } from '../../lib/useJson'
import { calendarDayToFare, monthSelection, oneWayOutbound, withCalendarFare } from '../../lib/trip'
import { useReturnMonth } from '../../lib/returnMonth'
import { HOME_AIRPORTS } from '../../homeAirports'
import type { CalendarDay, CalendarDayMap, Fare } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

const EMPTY: CalendarDayMap = {}
const NO_FARES: Fare[] = []

/** "cal|FROM|TO|date|price" (the id of a calendar fare) as its parts, or null for any other id. */
function parseCalendarFareId(id: string | null): { from: string; to: string; date: string; price: number } | null {
  const [kind, from, to, date, price] = (id ?? '').split('|')
  return kind === 'cal' && from && to && date && Number.isFinite(Number(price)) ? { from, to, date, price: Number(price) } : null
}

/** The fare the address asks for. A pair chosen from "Best combinations" names the calendar's own fare
 * ("cal|FROM|TO|date|price"); when the day's flight list already holds that same fare under another id,
 * the one with the same airports and price is the one meant (not just the cheapest flight of the day),
 * so the cost panel shows exactly the pair that was clicked. */
function pickFare(fares: Fare[], id: string | null, anyKind = false): Fare | undefined {
  if (!id) return undefined
  const exact = fares.find((f) => f.id === id)
  if (exact) return exact
  const [kind, from, to, , price] = id.split('|')
  if (kind !== 'cal') return undefined
  return fares.find((f) => (anyKind || f.kind === 'round-trip') && f.outbound.origin === from && f.outbound.destination === to && f.price === Number(price))
}

type CalendarResponse = { data: CalendarDayMap }
type CompareResponse = { results: Fare[] }

/** The flights of one day that can be picked. On a round trip they are ONE-WAY tickets only: a round-trip fare is not a day's
 * flight to pick here (it is under Best combinations), so a picked outbound day and a picked return day always add up to two
 * one-way tickets. A one-way search keeps every flight. */
function dayOnly(fares: Fare[], oneWay: boolean): Fare[] {
  return oneWay ? fares : fares.filter((f) => !f.inbound)
}

/** A round-trip fare from the "latest prices" list as a day pair (one price for both flights). */
function combinationFromFare(fare: Fare): Combination<CalendarDay> | null {
  if (!fare.inbound) return null
  const day: CalendarDay = {
    price: fare.price,
    origin: fare.outbound.origin,
    airlineCode: fare.outbound.airlineCode,
    airlineName: fare.outbound.airlineName,
    time: fare.outbound.time,
    stops: fare.outbound.stops,
    returnDate: fare.inbound.date,
    returnTime: fare.inbound.time,
    foundAt: fare.seenAt,
  }
  return {
    outDate: fare.outbound.date, outPrice: fare.price, outOrigin: fare.outbound.origin,
    backDate: fare.inbound.date, backPrice: null, backOrigin: fare.outbound.origin,
    total: fare.price, nights: nightsBetweenDates(fare.outbound.date, fare.inbound.date),
    out: day, back: null, kind: 'fare',
  }
}

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

/** Whole Month mode: the two calendars, the best day pairs, and the days and
 * flights the user picked. The picks live in the URL (out, of, back, bf), so
 * Back, refresh and sharing keep them. */
export function useMonthTrip(p: ResultsParams, enabled: boolean) {
  const { destination, origins, oneWay, departMonth, returnMonth, searchParams } = p

  // The two calendars show ONE-WAY prices only: each day is the cheapest one-way ticket from (Departing) or to (Returning)
  // any chosen airport. The plain calendar answer holds round-trip fares (a return day on every day), so it is not used here.
  const calOutUrl =
    enabled && departMonth
      ? `/api/calendar?${new URLSearchParams({ destination, origins, month: departMonth, leg: 'outbound', oneWay: 'true' })}`
      : null
  const calOut = useJson<CalendarResponse>(calOutUrl)
  const calBackUrl =
    enabled && !oneWay && returnMonth
      ? `/api/calendar?${new URLSearchParams({ destination, origins, month: returnMonth, leg: 'inbound', oneWay: 'true' })}`
      : null
  const calBack = useJson<CalendarResponse>(calBackUrl)
  // The requests for "Best combinations" start once the outbound calendar has come back. They ask the price service for the
  // SAME outbound calendar again (round-trip answer, flights for the date range), so when they start at the same moment they
  // would ask twice; after the first answer the server reuses its cached copy instead.
  const combosReady = !calOut.loading
  // Round-trip fares for "Best combinations" only (never shown in a calendar): the plain outbound answer, one round-trip fare
  // per departure day with its return day. The same Travelpayouts address as the outbound calendar above.
  const calRoundTripUrl =
    enabled && !oneWay && departMonth && combosReady
      ? `/api/calendar?${new URLSearchParams({ destination, origins, month: departMonth, leg: 'outbound' })}`
      : null
  // Round-trip fares with an exact return day for these months (the same list the date-range search uses, already
  // limited to the chosen weekdays and trip length). The day pairs come from here AND from the two calendars.
  const fareListUrl =
    enabled && !oneWay && departMonth && returnMonth && combosReady
      ? `/api/compare?${new URLSearchParams({
          destination,
          origins,
          oneWay: 'false',
          dateMode: 'range',
          rangeStart: `${departMonth}-01`,
          rangeEnd: lastDayOf(departMonth),
          minDays: String(Math.min(30, Math.max(1, p.minNights))),
          maxDays: String(Math.min(30, Math.max(1, p.maxNights))),
          ...(p.outDays.length < ALL_WEEKDAYS.length ? { outDays: serializeDays(p.outDays) } : {}),
          ...(p.backDays.length < ALL_WEEKDAYS.length ? { backDays: serializeDays(p.backDays) } : {}),
        })}`
      : null
  const fareList = useJson<CompareResponse>(fareListUrl)
  const calRoundTrip = useJson<CalendarResponse>(calRoundTripUrl)
  // The switch "Fly back to a different airport": the Returning calendar then shows the flights back to EVERY home airport
  // (one request for the whole return month, see lib/returnMonth), not only the airports of this search.
  const jawMode = enabled && !oneWay && p.openJaw
  const returnMonthData = useReturnMonth({ enabled: jawMode && !!returnMonth, from: destination, airports: HOME_AIRPORTS, month: returnMonth })
  const outboundData = calOut.data?.data ?? EMPTY
  const inboundData = calBack.data?.data ?? EMPTY
  const roundTripOutData = calRoundTrip.data?.data ?? EMPTY

  const outDate = enabled ? searchParams.get('out') : null
  const backDate = enabled && !oneWay ? searchParams.get('back') : null
  const outFlightId = searchParams.get('of')
  const backFlightId = searchParams.get('bf')

  const dayFlightsUrl = (date: string, inbound: boolean) =>
    `/api/compare?${new URLSearchParams({
      destination,
      origins,
      oneWay: 'true',
      dateMode: 'exact',
      departDate: date,
      ...(inbound ? { leg: 'inbound' } : {}),
    })}`

  const outFlights = useJson<CompareResponse>(outDate ? dayFlightsUrl(outDate, false) : null)
  const backFlights = useJson<CompareResponse>(backDate && !jawMode ? dayFlightsUrl(backDate, true) : null)

  const outDay: CalendarDay | undefined = outDate ? outboundData[outDate] : undefined
  const backDay: CalendarDay | undefined = backDate ? inboundData[backDate] : undefined

  const outFares = useMemo(
    () =>
      withCalendarFare(
        dayOnly(outFlights.data?.results ?? [], oneWay),
        outDay && outDate ? calendarDayToFare(outDay, outDate, outDay.origin, destination) : null
      ),
    [outFlights.data, outDay, outDate, destination, oneWay]
  )
  const backFares = useMemo(
    () =>
      jawMode
        ? (backDate ? returnMonthData.byDate[backDate] : undefined) ?? NO_FARES
        : withCalendarFare(
            dayOnly(backFlights.data?.results ?? [], oneWay),
            backDay && backDate ? calendarDayToFare(backDay, backDate, destination, backDay.origin) : null
          ),
    [jawMode, returnMonthData.byDate, backFlights.data, backDay, backDate, destination, oneWay]
  )

  // The fares the address asks for. A pair chosen from "Best combinations" names the calendar's own fare
  // ("cal|FROM|TO|date|price"); when the day's flight list already holds that same fare under another id,
  // the one with the same airports and price is the one meant (not just the cheapest flight of the day),
  // so the cost panel shows exactly the pair that was clicked.
  // With no explicit pick the cheapest ONE-WAY return fare is chosen: a round-trip fare is not the price of one flight.

  const outLoading = !!outDate && (outFlights.loading || (calOut.loading && outFares.length === 0))
  const backLoading = !!backDate && (jawMode ? returnMonthData.loading : backFlights.loading || (calBack.loading && backFares.length === 0))

  // Every valid day pair, cheapest first: pairs from the calendars (a round-trip fare at its own price, or two one-way
  // prices) plus the round-trip fares of the latest-prices list. The same two days from two sources keep the cheaper.
  const allCombinations = useMemo(() => {
    if (!enabled || oneWay) return []
    // Two one-way tickets: the day pairs of the two one-way calendars (each day a one-way price; the two prices are added).
    const oneWayPairs = findBestCombinations(outboundData, inboundData, p.outDays, p.backDays, p.minNights, p.maxNights, 5000, { out: departMonth, back: returnMonth })
    // Round-trip fares: the day pairs of the plain outbound answer (one price for both flights, the return day comes with it).
    const roundTripPairs = findBestCombinations(roundTripOutData, EMPTY, p.outDays, p.backDays, p.minNights, p.maxNights, 5000, { out: departMonth, back: returnMonth })
    const fromFares: Combination<CalendarDay>[] = []
    for (const fare of fareList.data?.results ?? []) {
      const combo = combinationFromFare(fare)
      if (!combo) continue
      // The list is asked for with a trip length of at most 30 days and a start month only: keep what fits ALL the filters.
      if (!combo.outDate.startsWith(departMonth) || !combo.backDate.startsWith(returnMonth)) continue
      if (combo.nights < p.minNights || combo.nights > p.maxNights) continue
      if (!p.outDays.includes(dayOfWeek(combo.outDate)) || !p.backDays.includes(dayOfWeek(combo.backDate))) continue
      fromFares.push(combo)
    }
    // One list, mixed and cheapest total first. A round-trip fare and two one-way tickets for the same days are both listed
    // (each labelled); the same kind on the same days keeps the cheaper copy.
    const best = new Map<string, Combination<CalendarDay>>()
    for (const combo of [...oneWayPairs, ...roundTripPairs, ...fromFares]) {
      const key =
        combo.kind === 'fare'
          ? `fare|${combo.outOrigin}|${combo.outDate}|${combo.backDate}`
          : `legs|${combo.outOrigin}|${combo.outDate}|${combo.backOrigin}|${combo.backDate}`
      const existing = best.get(key)
      if (!existing || combo.total < existing.total) best.set(key, combo)
    }
    return Array.from(best.values()).sort((a, b) => a.total - b.total)
  }, [enabled, oneWay, outboundData, inboundData, roundTripOutData, fareList.data, departMonth, returnMonth, p.outDays, p.backDays, p.minNights, p.maxNights])
  const bestCombinations = useMemo(() => allCombinations.slice(0, 10), [allCombinations])

  // The fare a clicked day pair stands for, rebuilt from the pair itself (the day's flight list may not hold it).
  const comboFare = useMemo(() => {
    const wanted = parseCalendarFareId(outFlightId)
    if (!wanted || !outDate) return null
    const combo = allCombinations.find(
      (c) => c.kind === 'fare' && c.outDate === wanted.date && c.outOrigin === wanted.from && c.total === wanted.price && (!backDate || c.backDate === backDate)
    )
    return combo ? calendarDayToFare(combo.out, combo.outDate, combo.outOrigin, destination) : null
  }, [allCombinations, outFlightId, outDate, backDate, destination])
  const selectedOutFare = useMemo(
    () => (outDate ? pickFare(outFares, outFlightId) ?? comboFare ?? outFares[0] ?? null : null),
    [outDate, outFares, outFlightId, comboFare]
  )

  // A round-trip fare already includes its own return day: no flight back is added to it, unless the traveller picked one
  // (a different return day, or a flight picked on that day). Otherwise the cheapest one-way flight back is used.
  const roundTripOutbound = !!selectedOutFare?.inbound && selectedOutFare.inbound.date === backDate && !backFlightId
  const selectedBackFare = useMemo(
    () => (backDate && !roundTripOutbound ? pickFare(backFares, backFlightId, jawMode) ?? backFares.find((f) => f.kind === 'one-way') ?? backFares[0] ?? null : null),
    [backDate, backFares, backFlightId, jawMode, roundTripOutbound]
  )

  // With the switch ON a flight back is its own one-way ticket: it is added to a one-way flight out, never to a round-trip fare.
  const selection = monthSelection(selectedOutFare, selectedBackFare, oneWay, backDate, jawMode ? oneWayOutbound(selectedOutFare, outFares) : undefined)
  const complete = selection.complete
  const total = selection.total

  // "If a round-trip fare exists for the selected pair of days and is cheaper, show it next to the total": the cheapest
  // round-trip fare with the same outbound and return day, when it costs less than the two one-way tickets picked.
  const roundTripAlt = useMemo(() => {
    if (oneWay || !outDate || !backDate || !selection.complete || selection.total === null || selection.backIncluded) return null
    let cheapest: Combination<CalendarDay> | null = null
    for (const c of allCombinations) {
      if (c.kind !== 'fare' || c.outDate !== outDate || c.backDate !== backDate) continue
      if (!cheapest || c.total < cheapest.total) cheapest = c
    }
    if (!cheapest || cheapest.total >= selection.total) return null
    return {
      fare: calendarDayToFare(cheapest.out, cheapest.outDate, cheapest.outOrigin, destination),
      price: cheapest.total,
      difference: selection.total - cheapest.total,
    }
  }, [oneWay, outDate, backDate, selection.complete, selection.total, selection.backIncluded, allCombinations, destination])

  return {
    calOut,
    calBack,
    outboundData,
    inboundData,
    outDate,
    backDate,
    outFares,
    backFares,
    selectedOutFare,
    selectedBackFare,
    outLoading,
    backLoading,
    bestCombinations,
    allCombinations,
    combosLoading: (!oneWay && !combosReady) || fareList.loading || calRoundTrip.loading,
    roundTripAlt,
    jawMode,
    returnByDate: returnMonthData.byDate,
    returnLoading: returnMonthData.loading,
    returnError: returnMonthData.error,
    complete,
    total,
    selection,
  }
}

export type MonthTrip = ReturnType<typeof useMonthTrip>
