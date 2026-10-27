'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { dayOfWeek, parseDays, serializeDays, nightsBetween, findBestCombinations, ALL_WEEKDAYS, WEEKDAY_BUTTONS } from '../weekdays'
import type { AnywhereCountry, CalendarDay, CalendarDayMap, Fare, OpenJawCombo, PricedLeg } from '../tripTypes'
import FareCard from '../components/FareCard'
import FlightLeg from '../components/FlightLeg'
import AnywhereCityRow from '../components/AnywhereCityRow'
import { CostSidebar, CostMobileBar, type DestInfo } from '../components/CostOfStay'
import { calendarDayToFare, withCalendarFare } from '../lib/trip'
import { formatDay, formatNights, formatShortDate } from '../lib/format'
import { isLowCostCarrier } from '../lib/lowCost'

function daysInMonth(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function firstWeekday(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).getDay()
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Selected = { date: string; day: CalendarDay } | null

type OpenJawResponse = {
  results: OpenJawCombo[]
  missingOutbound: boolean
  missingReturn: boolean
  outboundOnly: PricedLeg[]
}

/** Mon-Sun departure/return day toggles + min/max nights. Used by both the
 * single-destination Whole Month view and the Anywhere+Whole Month view, so
 * the filter UI (and what it means) stays identical in both places. */
function WeekdayFilterPanel({
  outDays,
  backDays,
  oneWay,
  minNights,
  maxNights,
  onToggleOutDay,
  onToggleBackDay,
  onChangeMinNights,
  onChangeMaxNights,
}: {
  outDays: number[]
  backDays: number[]
  oneWay: boolean
  minNights: number
  maxNights: number
  onToggleOutDay: (day: number) => void
  onToggleBackDay: (day: number) => void
  onChangeMinNights: (value: string) => void
  onChangeMaxNights: (value: string) => void
}) {
  return (
    <div className="mb-6 border border-[#E5E1D8] rounded-sm p-4 bg-white">
      <p className="font-semibold text-sm mb-2">Departure days</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {WEEKDAY_BUTTONS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => onToggleOutDay(d.value)}
            className={`px-3 py-1.5 rounded-sm border text-sm ${outDays.includes(d.value) ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#5B6472] border-[#E5E1D8]'}`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {!oneWay && (
        <>
          <p className="font-semibold text-sm mb-2">Return days</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {WEEKDAY_BUTTONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => onToggleBackDay(d.value)}
                className={`px-3 py-1.5 rounded-sm border text-sm ${backDays.includes(d.value) ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#5B6472] border-[#E5E1D8]'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-[#5B6472] mb-1">Min nights</label>
              <input
                type="number"
                min={1}
                max={60}
                value={minNights}
                onChange={(e) => onChangeMinNights(e.target.value)}
                className="w-24 px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5B6472] mb-1">Max nights</label>
              <input
                type="number"
                min={1}
                max={60}
                value={maxNights}
                onChange={(e) => onChangeMaxNights(e.target.value)}
                className="w-24 px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** One flight of a chosen calendar day (outbound or return), as a pickable row. */
function DayFlightRow({
  fare,
  isSelected,
  onSelect,
  rank,
}: {
  fare: Fare
  isSelected: boolean
  onSelect: () => void
  rank: number
}) {
  const leg = fare.outbound
  const airline = leg.airlineName || leg.airlineCode
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-sm border text-left transition-colors ${
        isSelected ? 'border-[#14213D] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white hover:bg-[#FBF9F4]'
      }`}
    >
      <div className="min-w-0">
        {rank === 0 && <span className="text-[10px] font-semibold text-[#FCA311] block">CHEAPEST</span>}
        <p className="font-mono text-sm">
          {leg.origin} → {leg.destination} · {formatDay(leg.date)}
          {leg.time ? ` · ${leg.time}` : ''}
        </p>
        <p className="text-xs text-[#5B6472]">
          {airline ?? 'airline not in cached data'}
          {isLowCostCarrier(leg.airlineCode) ? ' · Low-cost' : ''}
          {leg.time ? '' : ' · time not in cached data'}
          {leg.stops === 0 ? ' · Direct' : leg.stops ? ` · ${leg.stops} stop${leg.stops === 1 ? '' : 's'}` : ''}
          {fare.inbound ? ` · priced with a return on ${formatShortDate(fare.inbound.date)}` : ''}
        </p>
      </div>
      <p className="font-mono font-semibold whitespace-nowrap">€{fare.price}</p>
    </button>
  )
}

function CalendarGrid({
  title,
  data,
  month,
  onPrev,
  onNext,
  selectedDate,
  onSelectDay,
  allowedDays = ALL_WEEKDAYS,
}: {
  title: string
  data: CalendarDayMap
  month: string
  onPrev: () => void
  onNext: () => void
  selectedDate: string | undefined
  onSelectDay: (date: string, day: CalendarDay) => void
  allowedDays?: number[]
}) {
  const total = daysInMonth(month)
  const startWeekday = firstWeekday(month)
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)

  // Only allowed-weekday entries count toward the average/cheapest coloring,
  // so a filter to e.g. "Thursdays only" compares Thursdays against each
  // other, not against the whole month.
  const allowedEntries = Object.entries(data).filter(([date]) => allowedDays.includes(dayOfWeek(date)))
  const prices = allowedEntries.map(([, v]) => v.price)
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  const minPrice = prices.length ? Math.min(...prices) : null

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onPrev} aria-label="Previous month" className="px-2 py-1 border border-[#E5E1D8] rounded-sm text-xs">←</button>
        <h3 className="font-semibold text-sm">{title} · {month}</h3>
        <button onClick={onNext} aria-label="Next month" className="px-2 py-1 border border-[#E5E1D8] rounded-sm text-xs">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#5B6472] mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${month}-${String(day).padStart(2, '0')}`
          const entry = data[dateStr]
          const isAllowedDay = allowedDays.includes(dayOfWeek(dateStr))
          const isCheapest = entry && isAllowedDay && entry.price === minPrice
          const isSelected = selectedDate === dateStr
          const isGood = entry && avg !== null && entry.price < avg
          const detail = entry
            ? `${formatDay(dateStr)} · €${entry.price}${entry.time ? ` · ${entry.time}` : ''}${entry.airlineName || entry.airlineCode ? ` · ${entry.airlineName || entry.airlineCode}` : ''}`
            : undefined

          return (
            <button
              key={i}
              type="button"
              disabled={!entry || !isAllowedDay}
              onClick={() => entry && isAllowedDay && onSelectDay(dateStr, entry)}
              title={!isAllowedDay ? 'Not one of your selected weekdays' : detail}
              className={`aspect-square flex flex-col items-center justify-center rounded-sm text-xs border transition-colors ${
                !isAllowedDay
                  ? 'bg-[#FBF9F4] border-transparent text-[#ddd] cursor-default opacity-40'
                  : isSelected
                  ? 'ring-2 ring-[#14213D] border-[#14213D] bg-[#FFF8EC]'
                  : entry
                  ? isGood
                    ? 'bg-[#E8F5E9] border-[#A5D6A7]'
                    : 'bg-[#FDECEA] border-[#F3B3AC]'
                  : 'bg-[#FBF9F4] border-transparent text-[#ccc] cursor-default'
              } ${isCheapest && !isSelected ? 'outline outline-2 outline-[#FCA311]' : ''}`}
            >
              <span>{day}</span>
              {entry && isAllowedDay && <span className="font-mono">€{entry.price}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const PRIMARY_BUTTON =
  'inline-block px-4 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm text-sm hover:bg-[#e8940a] transition-colors'

function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const destination = searchParams.get('destination') || ''
  const isAnywhere = searchParams.get('anywhere') === 'true'
  const origins = searchParams.get('origins') || ''
  const originList = useMemo(() => origins.split(',').filter(Boolean), [origins])
  const oneWay = searchParams.get('oneWay') === 'true'
  const dateMode = searchParams.get('dateMode') || 'exact'
  const openJaw = searchParams.get('openJaw') === 'true'
  const departMonth = searchParams.get('month') || ''
  const returnMonth = searchParams.get('returnMonth') || departMonth
  const outDaysParam = searchParams.get('outDays')
  const backDaysParam = searchParams.get('backDays')
  // Memoized so these are stable array references across renders (not a new
  // array every time), which bestCombinations below depends on for its own
  // memoization to actually work.
  const outDays = useMemo(() => parseDays(outDaysParam), [outDaysParam])
  const backDays = useMemo(() => parseDays(backDaysParam), [backDaysParam])
  const minNights = parseInt(searchParams.get('minNights') || '1', 10)
  const maxNights = parseInt(searchParams.get('maxNights') || '14', 10)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fares, setFares] = useState<Fare[]>([])
  const [totalFares, setTotalFares] = useState(0)
  const [openJawData, setOpenJawData] = useState<OpenJawResponse | null>(null)
  const [selectedFareId, setSelectedFareId] = useState<string | null>(null)
  const [selectedComboIndex, setSelectedComboIndex] = useState(0)
  const [outboundData, setOutboundData] = useState<CalendarDayMap>({})
  const [inboundData, setInboundData] = useState<CalendarDayMap>({})

  const [selectedOut, setSelectedOut] = useState<Selected>(null)
  const [selectedBack, setSelectedBack] = useState<Selected>(null)
  const [outDayFlights, setOutDayFlights] = useState<Fare[]>([])
  const [backDayFlights, setBackDayFlights] = useState<Fare[]>([])
  const [selectedOutFlightIndex, setSelectedOutFlightIndex] = useState(0)
  const [selectedBackFlightIndex, setSelectedBackFlightIndex] = useState(0)
  const [loadingOutFlights, setLoadingOutFlights] = useState(false)
  const [loadingBackFlights, setLoadingBackFlights] = useState(false)

  // Cost-of-stay numbers, remembered together with the airport code they were
  // fetched for so a previous destination's numbers are never shown for a new one.
  const [destInfoState, setDestInfoState] = useState<{ code: string; info: DestInfo | null } | null>(null)
  const destInfoReady = destInfoState?.code === destination
  const destInfo = destInfoReady ? destInfoState.info : null

  useEffect(() => {
    if (!destination || isAnywhere) return
    fetch(`/api/destination-info?code=${encodeURIComponent(destination)}`)
      .then((res) => res.json())
      .then((data) => setDestInfoState({ code: destination, info: data.destination || null }))
      .catch(() => setDestInfoState({ code: destination, info: null }))
  }, [destination, isAnywhere])

  const searchParamsString = searchParams.toString()

  // Weekday/nights filters only affect client-side filtering of already-
  // fetched calendar data, so they're excluded from the fetch key -- toggling
  // them updates the (shareable, refresh-safe) URL without re-hitting the API.
  const fetchKey = useMemo(() => {
    const params = new URLSearchParams(searchParamsString)
    params.delete('outDays')
    params.delete('backDays')
    params.delete('minNights')
    params.delete('maxNights')
    return params.toString()
  }, [searchParamsString])

  useEffect(() => {
    if (isAnywhere) return // handled by the Anywhere-specific effect below

    setLoading(true)
    setError(null)
    setSelectedOut(null)
    setSelectedBack(null)
    setOutDayFlights([])
    setBackDayFlights([])
    setSelectedFareId(null)
    setSelectedComboIndex(0)
    setOpenJawData(null)

    if (dateMode === 'month') {
      const outParams = new URLSearchParams({ destination, origins, month: departMonth, leg: 'outbound' })
      const requests = [fetch(`/api/calendar?${outParams.toString()}`).then((r) => r.json())]

      if (!oneWay) {
        const inParams = new URLSearchParams({ destination, origins, month: returnMonth, leg: 'inbound' })
        requests.push(fetch(`/api/calendar?${inParams.toString()}`).then((r) => r.json()))
      }

      Promise.all(requests)
        .then((results) => {
          setOutboundData(results[0].data || {})
          setInboundData(results[1] ? results[1].data || {} : {})
          setLoading(false)
        })
        .catch(() => {
          setError('Something went wrong loading the calendar. Please try again.')
          setLoading(false)
        })
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    fetch(`/api/compare?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.openJaw) {
          setOpenJawData({
            results: data.results || [],
            missingOutbound: !!data.missingOutbound,
            missingReturn: !!data.missingReturn,
            outboundOnly: data.outboundOnly || [],
          })
          setFares([])
          setTotalFares(0)
        } else {
          setFares(data.results || [])
          setTotalFares(data.total || 0)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Something went wrong loading results. Please try again.')
        setLoading(false)
      })
  }, [fetchKey])

  const [anywhereLoading, setAnywhereLoading] = useState(true)
  const [anywhereError, setAnywhereError] = useState<string | null>(null)
  const [anywhereCountries, setAnywhereCountries] = useState<AnywhereCountry[]>([])
  const [anywhereUnmatched, setAnywhereUnmatched] = useState<AnywhereCountry[]>([])
  const [anywhereCheckedCount, setAnywhereCheckedCount] = useState(0)
  const [anywhereTotalCities, setAnywhereTotalCities] = useState(0)
  const [anywhereTotalCountries, setAnywhereTotalCountries] = useState(0)
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null)

  useEffect(() => {
    if (!isAnywhere) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- same fetch-on-param-change shape as the single-destination effect above
    setAnywhereLoading(true)
    setAnywhereError(null)
    setExpandedCountry(null)

    // Unlike the single-destination month view, the weekday/nights filters
    // here DO need a fresh request -- the honest per-country check happens
    // server-side per request, there's no local calendar data to re-filter.
    fetch(`/api/anywhere-by-country?${searchParamsString}`)
      .then((res) => res.json())
      .then((data) => {
        setAnywhereCountries(data.countries || [])
        setAnywhereUnmatched(data.unmatchedCountries || [])
        setAnywhereCheckedCount(data.checkedCount || 0)
        setAnywhereTotalCities(data.totalCandidateCities || 0)
        setAnywhereTotalCountries(data.totalCandidateCountries || 0)
        setAnywhereLoading(false)
      })
      .catch(() => {
        setAnywhereError('Something went wrong loading destinations. Please try again.')
        setAnywhereLoading(false)
      })
  }, [isAnywhere, searchParamsString])

  function goToCity(cityCode: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('anywhere')
    params.set('destination', cityCode)
    router.push(`/results?${params.toString()}`)
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    // Changing a filter should not throw the page back to the top.
    router.push(`/results?${params.toString()}`, { scroll: false })
  }

  function toggleOutDay(day: number) {
    const next = outDays.includes(day) ? outDays.filter((d) => d !== day) : [...outDays, day]
    updateParam('outDays', serializeDays(next))
  }

  function toggleBackDay(day: number) {
    const next = backDays.includes(day) ? backDays.filter((d) => d !== day) : [...backDays, day]
    updateParam('backDays', serializeDays(next))
  }

  // Ranked outbound/return day pairs that fit the weekday + nights filters.
  // Computed entirely from the two calendars' already-fetched months -- it
  // only ever covers whichever months are currently shown (navigating a
  // calendar with the arrows re-fetches and this recomputes), not a
  // cross-month search. A pair needs a cached price on BOTH days.
  const bestCombinations = useMemo(() => {
    if (oneWay || dateMode !== 'month') return []
    return findBestCombinations(outboundData, inboundData, outDays, backDays, minNights, maxNights, 10)
  }, [oneWay, dateMode, outboundData, inboundData, outDays, backDays, minNights, maxNights])

  async function selectCombination(combo: (typeof bestCombinations)[number]) {
    await Promise.all([
      handleSelectOutDay(combo.outDate, combo.out),
      handleSelectBackDay(combo.backDate, combo.back),
    ])
  }

  async function fetchOneWayDayFlights(fromOrigins: string[], toDestination: string, date: string): Promise<Fare[]> {
    const params = new URLSearchParams({
      destination: toDestination,
      origins: fromOrigins.join(','),
      oneWay: 'true',
      dateMode: 'exact',
      departDate: date,
    })
    const res = await fetch(`/api/compare?${params.toString()}`)
    const data = await res.json()
    return (data.results || []) as Fare[]
  }

  async function handleSelectOutDay(date: string, day: CalendarDay) {
    setSelectedOut({ date, day })
    setSelectedOutFlightIndex(0)
    setLoadingOutFlights(true)
    const fromCalendar = calendarDayToFare(day, date, day.origin, destination)
    try {
      const flights = await fetchOneWayDayFlights(originList, destination, date)
      setOutDayFlights(withCalendarFare(flights, fromCalendar))
    } catch {
      setOutDayFlights([fromCalendar])
    } finally {
      setLoadingOutFlights(false)
    }
  }

  async function handleSelectBackDay(date: string, day: CalendarDay) {
    setSelectedBack({ date, day })
    setSelectedBackFlightIndex(0)
    setLoadingBackFlights(true)
    const fromCalendar = calendarDayToFare(day, date, destination, day.origin)
    try {
      const perAirport = await Promise.all(
        originList.map((airport) => fetchOneWayDayFlights([destination], airport, date))
      )
      const merged = perAirport.flat().sort((a, b) => a.price - b.price)
      setBackDayFlights(withCalendarFare(merged, fromCalendar))
    } catch {
      setBackDayFlights([fromCalendar])
    } finally {
      setLoadingBackFlights(false)
    }
  }

  if (isAnywhere) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link href="/search" className="text-sm text-[#5B6472] hover:text-[#14213D] mb-6 inline-block">← New search</Link>
        <h1 className="text-2xl font-semibold mb-2">
          Anywhere from {originList[0]}{originList.length > 1 ? ` +${originList.length - 1}` : ''}
        </h1>
        <p className="text-sm text-[#5B6472] mb-6">Countries ranked by the cheapest price that matches your filters.</p>

        {dateMode === 'month' && (
          <WeekdayFilterPanel
            outDays={outDays}
            backDays={backDays}
            oneWay={oneWay}
            minNights={minNights}
            maxNights={maxNights}
            onToggleOutDay={toggleOutDay}
            onToggleBackDay={toggleBackDay}
            onChangeMinNights={(v) => updateParam('minNights', v)}
            onChangeMaxNights={(v) => updateParam('maxNights', v)}
          />
        )}

        {anywhereLoading && <p className="text-[#5B6472]">Searching every destination we have cached data for...</p>}

        {!anywhereLoading && anywhereError && (
          <div className="rounded-sm border border-[#F3B3AC] bg-[#FDECEA] px-5 py-4">
            <p className="text-[#14213D] mb-2">{anywhereError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#14213D] text-white rounded-sm text-sm font-medium hover:bg-[#1c2d52] transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!anywhereLoading && !anywhereError && anywhereCountries.length === 0 && anywhereUnmatched.length === 0 && (
          <p className="text-[#5B6472]">
            No cached destinations found from your selected airports right now. Try different airports, or a different date mode.
          </p>
        )}

        {!anywhereLoading && !anywhereError && (anywhereCountries.length > 0 || anywhereUnmatched.length > 0) && (
          <>
            <p className="text-xs text-[#5B6472] mb-4">
              Checked the {anywhereCheckedCount} cheapest-looking countries in detail (out of {anywhereTotalCountries} found, {anywhereTotalCities} destinations total) against your filters. Prices are cached and may change on the booking site.
            </p>

            <div className="space-y-3">
              {anywhereCountries.map((country) => (
                <div key={country.code} className="rounded-sm border border-[#E5E1D8] bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedCountry(expandedCountry === country.code ? null : country.code)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="font-semibold">{country.name}</p>
                      <p className="text-sm text-[#5B6472]">{country.candidateCityCount} destination{country.candidateCityCount === 1 ? '' : 's'} found</p>
                    </div>
                    <p className="font-mono font-semibold text-lg whitespace-nowrap">from €{country.price}</p>
                  </button>
                  {expandedCountry === country.code && (
                    <div className="px-5 pb-4 space-y-2 border-t border-[#E5E1D8] pt-3">
                      {country.verifiedCity && (
                        <AnywhereCityRow highlight city={country.verifiedCity} onOpen={() => goToCity(country.verifiedCity!.code)} />
                      )}
                      {country.candidateCities.map((c) => (
                        <AnywhereCityRow key={c.code} city={c} onOpen={() => goToCity(c.code)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {anywhereUnmatched.length > 0 && (
              <div className="mt-8">
                <p className="font-semibold text-sm mb-2">No matching days found</p>
                <p className="text-xs text-[#5B6472] mb-3">
                  These countries have cheap flights, but not on your selected weekdays within the months shown. Try loosening your filters.
                </p>
                <div className="space-y-2">
                  {anywhereUnmatched.map((c) => (
                    <div key={c.code} className="px-4 py-2 rounded-sm border border-[#E5E1D8] bg-[#FBF9F4] text-sm text-[#5B6472] flex items-center justify-between">
                      <span>{c.name}</span>
                      <span>{c.candidateCityCount} destination{c.candidateCityCount === 1 ? '' : 's'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ---- Which flight(s) the cost panel and trip summary are about ----------
  const selectedOutFare = outDayFlights[selectedOutFlightIndex] || null
  const selectedBackFare = backDayFlights[selectedBackFlightIndex] || null
  const monthTotal = oneWay
    ? selectedOutFare?.price ?? null
    : selectedOutFare && selectedBackFare
    ? selectedOutFare.price + selectedBackFare.price
    : null

  // Lists that are not month mode: split fares into "what you asked for" and
  // "other return dates / round-trip-only" so nothing is silently mislabeled.
  const primaryFares = oneWay
    ? fares.filter((f) => f.kind === 'one-way')
    : fares.filter((f) => f.returnMatchesRequest !== false)
  const secondaryFares = oneWay
    ? fares.filter((f) => f.kind === 'round-trip')
    : fares.filter((f) => f.returnMatchesRequest === false)
  const activeFare =
    fares.find((f) => f.id === selectedFareId) || primaryFares[0] || secondaryFares[0] || null
  const requestedReturn = searchParams.get('returnDate')

  let activeFlightPrice: number | null = null
  let activeDepartDate: string | null = null
  let activeReturnDate: string | null = null

  if (dateMode === 'month') {
    activeFlightPrice = monthTotal
    activeDepartDate = selectedOutFare?.outbound.date || null
    activeReturnDate = oneWay ? null : selectedBackFare?.outbound.date || null
  } else if (openJaw) {
    const combo = openJawData?.results[selectedComboIndex] || openJawData?.results[0]
    if (combo) {
      activeFlightPrice = combo.total
      activeDepartDate = combo.outbound.date
      activeReturnDate = combo.inbound.date
    }
  } else if (activeFare) {
    activeFlightPrice = activeFare.price
    activeDepartDate = activeFare.outbound.date
    activeReturnDate = activeFare.inbound?.date || null
  }

  const stayDays = activeDepartDate ? nightsBetween(activeDepartDate, activeReturnDate) : 1
  const costProps = {
    destinationName: destInfo?.name || destination,
    info: destInfo,
    flightPrice: activeFlightPrice,
    flightNote:
      dateMode === 'month' || openJaw
        ? oneWay
          ? 'one way'
          : 'outbound + return'
        : activeFare?.kind === 'round-trip'
        ? 'round trip, both flights'
        : 'one way',
    days: stayDays,
    dates: activeDepartDate
      ? `${formatShortDate(activeDepartDate)}${activeReturnDate ? ` → ${formatShortDate(activeReturnDate)}` : ''}`
      : null,
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 pb-24 lg:pb-12">
      <Link href="/search" className="text-sm text-[#5B6472] hover:text-[#14213D] mb-6 inline-block">← New search</Link>
      <h1 className="text-2xl font-semibold mb-6">
        {originList[0]}{originList.length > 1 ? ` +${originList.length - 1}` : ''} → {destination}
      </h1>

      {loading && <p className="text-[#5B6472]">Searching...</p>}

      {!loading && error && (
        <div className="rounded-sm border border-[#F3B3AC] bg-[#FDECEA] px-5 py-4">
          <p className="text-[#14213D] mb-2">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#14213D] text-white rounded-sm text-sm font-medium hover:bg-[#1c2d52] transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
      <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0">

      {dateMode === 'month' && (
        <div>
          <WeekdayFilterPanel
            outDays={outDays}
            backDays={backDays}
            oneWay={oneWay}
            minNights={minNights}
            maxNights={maxNights}
            onToggleOutDay={toggleOutDay}
            onToggleBackDay={toggleBackDay}
            onChangeMinNights={(v) => updateParam('minNights', v)}
            onChangeMaxNights={(v) => updateParam('maxNights', v)}
          />

          {!oneWay && (
            <div className="mb-6">
              <p className="font-semibold text-sm mb-2">Best combinations</p>
              {bestCombinations.length === 0 && (
                <p className="text-sm text-[#5B6472]">
                  {Object.keys(outboundData).length > 0 && Object.keys(inboundData).length > 0
                    ? 'No combination fits your current weekday/nights filters in these months. A trip needs a cached price on both the outbound and the return day. Try loosening the filters, or browse further months with the arrows below.'
                    : 'No complete round trip to suggest: ' +
                      (Object.keys(outboundData).length === 0 ? 'no cached outbound prices in this month' : 'no cached return prices in the return month') +
                      '.'}
                </p>
              )}
              {bestCombinations.length > 0 && (
                <div className="space-y-2">
                  {bestCombinations.map((combo, i) => {
                    const outLeg = calendarDayToFare(combo.out, combo.outDate, combo.out.origin, destination).outbound
                    const backLeg = calendarDayToFare(combo.back, combo.backDate, destination, combo.back.origin).outbound
                    return (
                      <button
                        key={`${combo.outDate}-${combo.backDate}`}
                        type="button"
                        onClick={() => selectCombination(combo)}
                        className={`w-full flex items-start justify-between gap-3 px-3 py-2 rounded-sm border text-left transition-colors ${
                          selectedOut?.date === combo.outDate && selectedBack?.date === combo.backDate
                            ? 'border-[#14213D] bg-[#FFF8EC]'
                            : 'border-[#E5E1D8] bg-white hover:bg-[#FBF9F4]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {i === 0 && <span className="text-[10px] font-semibold text-[#FCA311]">CHEAPEST</span>}
                            <span className="font-mono text-xs text-[#5B6472]">{formatNights(combo.nights)}</span>
                          </div>
                          <FlightLeg compact label="Out" leg={outLeg} price={combo.outPrice} />
                          <FlightLeg compact label="Back" leg={backLeg} price={combo.backPrice} />
                        </div>
                        <p className="font-mono font-semibold text-lg whitespace-nowrap">€{combo.total}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <CalendarGrid
              title="Departing"
              data={outboundData}
              month={departMonth}
              onPrev={() => updateParam('month', shiftMonth(departMonth, -1))}
              onNext={() => updateParam('month', shiftMonth(departMonth, 1))}
              selectedDate={selectedOut?.date}
              onSelectDay={handleSelectOutDay}
              allowedDays={outDays}
            />
            {!oneWay && (
              <CalendarGrid
                title="Returning"
                data={inboundData}
                month={returnMonth}
                onPrev={() => updateParam('returnMonth', shiftMonth(returnMonth, -1))}
                onNext={() => updateParam('returnMonth', shiftMonth(returnMonth, 1))}
                selectedDate={selectedBack?.date}
                onSelectDay={handleSelectBackDay}
                allowedDays={backDays}
              />
            )}
          </div>

          <p className="text-xs text-[#5B6472] mb-4">
            <span className="inline-block w-3 h-3 bg-[#E8F5E9] border border-[#A5D6A7] rounded-sm mr-1 align-middle" /> Below average ·{' '}
            <span className="inline-block w-3 h-3 bg-[#FDECEA] border border-[#F3B3AC] rounded-sm mr-1 ml-2 align-middle" /> Above average ·{' '}
            <span className="inline-block w-3 h-3 border-2 border-[#FCA311] rounded-sm mr-1 ml-2 align-middle" /> Cheapest day
          </p>

          {selectedOut && (
            <div className="mb-4">
              <p className="font-semibold text-sm mb-2">Flights on {formatDay(selectedOut.date)}</p>
              {loadingOutFlights && <p className="text-sm text-[#5B6472]">Loading flights for this day...</p>}
              {!loadingOutFlights && outDayFlights.length === 0 && (
                <p className="text-sm text-[#5B6472]">No cached flight details found for this day.</p>
              )}
              {!loadingOutFlights && outDayFlights.length > 0 && (
                <div className="space-y-2">
                  {outDayFlights.map((f, i) => (
                    <DayFlightRow
                      key={f.id}
                      fare={f}
                      rank={i}
                      isSelected={i === selectedOutFlightIndex}
                      onSelect={() => setSelectedOutFlightIndex(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!oneWay && selectedBack && (
            <div className="mb-4">
              <p className="font-semibold text-sm mb-2">Return flights on {formatDay(selectedBack.date)}</p>
              {loadingBackFlights && <p className="text-sm text-[#5B6472]">Loading flights for this day...</p>}
              {!loadingBackFlights && backDayFlights.length === 0 && (
                <p className="text-sm text-[#5B6472]">No cached return flight found for {formatDay(selectedBack.date)}.</p>
              )}
              {!loadingBackFlights && backDayFlights.length > 0 && (
                <div className="space-y-2">
                  {backDayFlights.map((f, i) => (
                    <DayFlightRow
                      key={f.id}
                      fare={f}
                      rank={i}
                      isSelected={i === selectedBackFlightIndex}
                      onSelect={() => setSelectedBackFlightIndex(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {(selectedOutFare || selectedBackFare || (!oneWay && selectedOut) || (!oneWay && selectedBack)) && (
            <div className="border-2 border-[#14213D] rounded-sm p-4 bg-white">
              <p className="font-semibold mb-1">Your trip</p>
              <div className="divide-y divide-[#E5E1D8]">
                {selectedOutFare ? (
                  <FlightLeg
                    label="Outbound"
                    leg={selectedOutFare.outbound}
                    price={selectedOutFare.price}
                    searchLinkLabel="Book outbound →"
                  />
                ) : (
                  !oneWay && (
                    <p className="py-2 text-sm text-[#5B6472]">Outbound: pick a departure day in the left calendar.</p>
                  )
                )}
                {!oneWay &&
                  (selectedBackFare ? (
                    <FlightLeg
                      label="Return"
                      leg={selectedBackFare.outbound}
                      price={selectedBackFare.price}
                      searchLinkLabel="Book return →"
                    />
                  ) : selectedBack && !loadingBackFlights ? (
                    <p className="py-2 text-sm text-[#8a2f22]">
                      No cached return price for {formatDay(selectedBack.date)} — this is not a complete round trip.
                    </p>
                  ) : (
                    <p className="py-2 text-sm text-[#5B6472]">Return: pick a return day in the right calendar.</p>
                  ))}
              </div>
              {monthTotal !== null ? (
                <p className="font-semibold mt-2">Flights total: <span className="font-mono">€{monthTotal}</span></p>
              ) : (
                !oneWay && <p className="mt-2 text-sm text-[#5B6472]">Flights total appears once both a cached outbound and return price are chosen.</p>
              )}
              <p className="mt-2 text-xs text-[#5B6472]">
                Each price is the cheapest cached fare for that day; some are priced together with a return, so confirm the final price on Aviasales.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {selectedOutFare && (
                  <a href={selectedOutFare.outbound.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={PRIMARY_BUTTON}>
                    {selectedBackFare ? 'Book outbound →' : 'Book on Aviasales →'}
                  </a>
                )}
                {!oneWay && selectedBackFare && (
                  <a href={selectedBackFare.outbound.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={PRIMARY_BUTTON}>
                    Book return →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {dateMode !== 'month' && !openJaw && fares.length === 0 && (
        <p className="text-[#5B6472]">No cached prices found for this search. Try a more popular destination, or a different date mode.</p>
      )}

      {dateMode !== 'month' && openJaw && openJawData && (
        <div>
          {openJawData.results.length === 0 && !openJawData.missingOutbound && !openJawData.missingReturn && (
            <p className="text-[#5B6472]">No cached prices found for this search.</p>
          )}
          {openJawData.missingOutbound && (
            <p className="mb-3 rounded-sm border border-[#E5E1D8] bg-white px-4 py-3 text-sm text-[#5B6472]">
              No cached outbound price found from your airports to {destination}, so no complete trip can be built.
            </p>
          )}
          {openJawData.missingReturn && !openJawData.missingOutbound && (
            <div className="mb-3 rounded-sm border border-[#F3B3AC] bg-[#FDECEA] px-4 py-3 text-sm text-[#14213D]">
              No cached return price found from {destination} to your airports — these are NOT complete round trips.
              Outbound flights we did find:
            </div>
          )}

          {openJawData.outboundOnly.length > 0 && (
            <ul className="space-y-3 mb-4">
              {openJawData.outboundOnly.map((leg) => (
                <li key={`${leg.origin}-${leg.date}-${leg.price}`} className="rounded-sm border border-[#E5E1D8] bg-white px-4 py-2">
                  <FlightLeg label="Outbound" leg={leg} price={leg.price} />
                  <a href={leg.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={`${PRIMARY_BUTTON} mb-2`}>
                    Book outbound →
                  </a>
                </li>
              ))}
            </ul>
          )}

          {openJawData.results.length > 0 && (
            <ul className="space-y-3">
              {openJawData.results.map((combo, i) => {
                const isSelected = i === selectedComboIndex
                return (
                  <li key={`${combo.outbound.origin}-${combo.inbound.destination}-${combo.total}-${i}`} className={`rounded-sm border ${isSelected ? 'border-2 border-[#FCA311] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white'}`}>
                    <button type="button" onClick={() => setSelectedComboIndex(i)} aria-pressed={isSelected} className="w-full text-left px-4 pt-4 pb-1 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {i === 0 && <p className="text-xs font-semibold text-[#FCA311] mb-1">CHEAPEST COMBO</p>}
                          <p className="font-mono text-sm text-[#5B6472]">{combo.outbound.origin} → {destination} → {combo.inbound.destination}</p>
                        </div>
                        <p className="font-mono text-2xl font-semibold tabular-nums">€{combo.total}</p>
                      </div>
                      <div className="mt-2 divide-y divide-[#E5E1D8]">
                        <FlightLeg label="Outbound" leg={combo.outbound} price={combo.outbound.price} />
                        <FlightLeg label="Return" leg={combo.inbound} price={combo.inbound.price} />
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-3 px-4 pb-4 pt-2 sm:px-5">
                      <a href={combo.outbound.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={PRIMARY_BUTTON}>
                        Book outbound →
                      </a>
                      <a href={combo.inbound.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className={PRIMARY_BUTTON}>
                        Book return →
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {dateMode !== 'month' && !openJaw && fares.length > 0 && (
        <>
          {primaryFares.length === 0 && oneWay && (
            <p className="mb-3 rounded-sm border border-[#E5E1D8] bg-white px-4 py-3 text-sm text-[#5B6472]">
              No one-way fare is cached for this search. Only round-trip fares (which include a return flight) were found, shown below.
            </p>
          )}
          {primaryFares.length === 0 && !oneWay && requestedReturn && (
            <p className="mb-3 rounded-sm border border-[#E5E1D8] bg-white px-4 py-3 text-sm text-[#5B6472]">
              No cached fare found for your exact return date ({formatDay(requestedReturn)}). These fares leave on your departure day with a different return date:
            </p>
          )}
          {dateMode === 'range' && primaryFares.length > 0 && (
            <p className="text-xs text-[#5B6472] mb-3">
              Cached fares found in your date range, cheapest first
              {totalFares > fares.length ? ` (cheapest ${fares.length} of ${totalFares})` : ''}. Prices are cached and may change — always confirm on the booking site.
            </p>
          )}
          {dateMode === 'exact' && primaryFares.length > 1 && (
            <p className="text-xs text-[#5B6472] mb-3">
              All cached fares found for this day across your chosen airports, cheapest first.
            </p>
          )}
          {primaryFares.length > 0 && (
            <ul className="space-y-3">
              {primaryFares.map((f, i) => (
                <FareCard
                  key={f.id}
                  fare={f}
                  isCheapest={i === 0}
                  isSelected={f.id === activeFare?.id}
                  onSelect={() => setSelectedFareId(f.id)}
                />
              ))}
            </ul>
          )}

          {secondaryFares.length > 0 && (
            <div className={primaryFares.length > 0 ? 'mt-8' : ''}>
              {primaryFares.length > 0 && (
                <>
                  <p className="font-semibold text-sm mb-1">
                    {oneWay ? 'Round-trip fares (include a return flight)' : 'Other return dates'}
                  </p>
                  <p className="text-xs text-[#5B6472] mb-3">
                    {oneWay
                      ? 'No one-way price for these — the price covers a return flight too.'
                      : `No cached fare for ${requestedReturn ? formatDay(requestedReturn) : 'your return date'} — these leave on your departure day with another return date.`}
                  </p>
                </>
              )}
              <ul className="space-y-3">
                {secondaryFares.map((f, i) => (
                  <FareCard
                    key={f.id}
                    fare={f}
                    isCheapest={primaryFares.length === 0 && i === 0}
                    isSelected={f.id === activeFare?.id}
                    onSelect={() => setSelectedFareId(f.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      </div>

      {/* No items-start on the row above: this column must stretch to the full
          height of the results so the sticky card has room to travel. */}
      {destInfoReady && (
        <div className="hidden lg:block lg:w-72 lg:flex-shrink-0">
          <CostSidebar {...costProps} />
        </div>
      )}

      </div>
      )}

      {destInfoReady && !loading && !error && <CostMobileBar {...costProps} />}
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-6 py-12 text-[#5B6472]">Loading...</div>}>
      <ResultsContent />
    </Suspense>
  )
}
