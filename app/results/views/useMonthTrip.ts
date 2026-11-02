'use client'

import { useMemo } from 'react'
import { ALL_WEEKDAYS, dayOfWeek, findBestCombinations, serializeDays, type Combination } from '../../weekdays'
import { nightsBetweenDates } from '../../lib/format'
import { useJson } from '../../lib/useJson'
import { calendarDayToFare, monthSelection, withCalendarFare } from '../../lib/trip'
import type { CalendarDay, CalendarDayMap, Fare } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

const EMPTY: CalendarDayMap = {}

/** "cal|FROM|TO|date|price" (the id of a calendar fare) as its parts, or null for any other id. */
function parseCalendarFareId(id: string | null): { from: string; to: string; date: string; price: number } | null {
  const [kind, from, to, date, price] = (id ?? '').split('|')
  return kind === 'cal' && from && to && date && Number.isFinite(Number(price)) ? { from, to, date, price: Number(price) } : null
}

/** The fare the address asks for. A pair chosen from "Best combinations" names the calendar's own fare
 * ("cal|FROM|TO|date|price"); when the day's flight list already holds that same fare under another id,
 * the one with the same airports and price is the one meant (not just the cheapest flight of the day),
 * so the cost panel shows exactly the pair that was clicked. */
function pickFare(fares: Fare[], id: string | null): Fare | undefined {
  if (!id) return undefined
  const exact = fares.find((f) => f.id === id)
  if (exact) return exact
  const [kind, from, to, , price] = id.split('|')
  if (kind !== 'cal') return undefined
  return fares.find((f) => f.kind === 'round-trip' && f.outbound.origin === from && f.outbound.destination === to && f.price === Number(price))
}

type CalendarResponse = { data: CalendarDayMap }
type CompareResponse = { results: Fare[] }

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

  const calOutUrl =
    enabled && departMonth
      ? `/api/calendar?${new URLSearchParams({ destination, origins, month: departMonth, leg: 'outbound', ...(oneWay ? { oneWay: 'true' } : {}) })}`
      : null
  const calBackUrl =
    enabled && !oneWay && returnMonth
      ? `/api/calendar?${new URLSearchParams({ destination, origins, month: returnMonth, leg: 'inbound' })}`
      : null
  // Round-trip fares with an exact return day for these months (the same list the date-range search uses, already
  // limited to the chosen weekdays and trip length). The day pairs come from here AND from the two calendars.
  const fareListUrl =
    enabled && !oneWay && departMonth && returnMonth
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
  const calOut = useJson<CalendarResponse>(calOutUrl)
  const calBack = useJson<CalendarResponse>(calBackUrl)
  const outboundData = calOut.data?.data ?? EMPTY
  const inboundData = calBack.data?.data ?? EMPTY

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
  const backFlights = useJson<CompareResponse>(backDate ? dayFlightsUrl(backDate, true) : null)

  const outDay: CalendarDay | undefined = outDate ? outboundData[outDate] : undefined
  const backDay: CalendarDay | undefined = backDate ? inboundData[backDate] : undefined

  const outFares = useMemo(
    () =>
      withCalendarFare(
        outFlights.data?.results ?? [],
        outDay && outDate ? calendarDayToFare(outDay, outDate, outDay.origin, destination) : null
      ),
    [outFlights.data, outDay, outDate, destination]
  )
  const backFares = useMemo(
    () =>
      withCalendarFare(
        backFlights.data?.results ?? [],
        backDay && backDate ? calendarDayToFare(backDay, backDate, destination, backDay.origin) : null
      ),
    [backFlights.data, backDay, backDate, destination]
  )

  // The fares the address asks for. A pair chosen from "Best combinations" names the calendar's own fare
  // ("cal|FROM|TO|date|price"); when the day's flight list already holds that same fare under another id,
  // the one with the same airports and price is the one meant (not just the cheapest flight of the day),
  // so the cost panel shows exactly the pair that was clicked.
  // With no explicit pick the cheapest ONE-WAY return fare is chosen: a round-trip fare is not the price of one flight.
  const selectedBackFare = useMemo(
    () => (backDate ? pickFare(backFares, backFlightId) ?? backFares.find((f) => f.kind === 'one-way') ?? backFares[0] ?? null : null),
    [backDate, backFares, backFlightId]
  )

  const outLoading = !!outDate && (outFlights.loading || (calOut.loading && outFares.length === 0))
  const backLoading = !!backDate && (backFlights.loading || (calBack.loading && backFares.length === 0))

  // Every valid day pair, cheapest first: pairs from the calendars (a round-trip fare at its own price, or two one-way
  // prices) plus the round-trip fares of the latest-prices list. The same two days from two sources keep the cheaper.
  const allCombinations = useMemo(() => {
    if (!enabled || oneWay) return []
    const fromCalendars = findBestCombinations(outboundData, inboundData, p.outDays, p.backDays, p.minNights, p.maxNights, 5000)
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
    const best = new Map<string, Combination<CalendarDay>>()
    for (const combo of [...fromCalendars, ...fromFares]) {
      const key = `${combo.outOrigin}|${combo.outDate}|${combo.backDate}`
      const existing = best.get(key)
      if (!existing || combo.total < existing.total) best.set(key, combo)
    }
    return Array.from(best.values()).sort((a, b) => a.total - b.total)
  }, [enabled, oneWay, outboundData, inboundData, fareList.data, departMonth, returnMonth, p.outDays, p.backDays, p.minNights, p.maxNights])
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

  const selection = monthSelection(selectedOutFare, selectedBackFare, oneWay, backDate)
  const complete = selection.complete
  const total = selection.total

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
    combosLoading: fareList.loading,
    complete,
    total,
    selection,
  }
}

export type MonthTrip = ReturnType<typeof useMonthTrip>
