'use client'

import { useMemo } from 'react'
import { findBestCombinations } from '../../weekdays'
import { useJson } from '../../lib/useJson'
import { calendarDayToFare, withCalendarFare } from '../../lib/trip'
import type { CalendarDay, CalendarDayMap, Fare } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'

const EMPTY: CalendarDayMap = {}

/** The fare the address asks for. A pair chosen from "Best combinations" names the calendar's own fare
 * ("cal|FROM|TO|date|price"); when the day's flight list already holds that same fare under another id,
 * the one with the same airports and price is the one meant (not just the cheapest flight of the day),
 * so the cost panel shows exactly the pair that was clicked. */
function findPicked(fares: Fare[], id: string | null): Fare | undefined {
  if (!id) return undefined
  const exact = fares.find((f) => f.id === id)
  if (exact) return exact
  const [kind, from, to, , price] = id.split('|')
  if (kind !== 'cal') return undefined
  return fares.find((f) => f.outbound.origin === from && f.outbound.destination === to && f.price === Number(price))
}

type CalendarResponse = { data: CalendarDayMap }
type CompareResponse = { results: Fare[] }

/** Whole Month mode: the two calendars, the best day pairs, and the days and
 * flights the user picked. The picks live in the URL (out, of, back, bf), so
 * Back, refresh and sharing keep them. */
export function useMonthTrip(p: ResultsParams, enabled: boolean) {
  const { destination, origins, oneWay, departMonth, returnMonth, searchParams } = p

  const calOutUrl =
    enabled && departMonth
      ? `/api/calendar?${new URLSearchParams({ destination, origins, month: departMonth, leg: 'outbound' })}`
      : null
  const calBackUrl =
    enabled && !oneWay && returnMonth
      ? `/api/calendar?${new URLSearchParams({ destination, origins, month: returnMonth, leg: 'inbound' })}`
      : null
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

  const selectedOutFare = outDate ? findPicked(outFares, outFlightId) ?? outFares[0] ?? null : null
  const selectedBackFare = backDate ? findPicked(backFares, backFlightId) ?? backFares[0] ?? null : null

  const outLoading = !!outDate && (outFlights.loading || (calOut.loading && outFares.length === 0))
  const backLoading = !!backDate && (backFlights.loading || (calBack.loading && backFares.length === 0))

  const bestCombinations = useMemo(() => {
    if (!enabled || oneWay) return []
    return findBestCombinations(outboundData, inboundData, p.outDays, p.backDays, p.minNights, p.maxNights, 10)
  }, [enabled, oneWay, outboundData, inboundData, p.outDays, p.backDays, p.minNights, p.maxNights])

  const complete = !!selectedOutFare && (oneWay || !!selectedBackFare)
  const total = complete ? selectedOutFare.price + (oneWay ? 0 : selectedBackFare?.price ?? 0) : null

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
    complete,
    total,
  }
}

export type MonthTrip = ReturnType<typeof useMonthTrip>
