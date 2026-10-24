'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { buildBookingLink } from '../aviasalesLink'

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

function nightsBetween(departDate: string, returnDate: string | null): number {
  if (!returnDate) return 1
  const start = new Date(departDate)
  const end = new Date(returnDate)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

type DestInfo = {
  name: string
  hostel_avg_price: number | null
  food_avg_price: number | null
  transport_avg_price: number | null
  other_avg_price: number | null
}

function costOfStayNumbers(destInfo: DestInfo, flightPrice: number | null, days: number) {
  const perDay =
    (destInfo.hostel_avg_price || 0) +
    (destInfo.food_avg_price || 0) +
    (destInfo.transport_avg_price || 0) +
    (destInfo.other_avg_price || 0)
  const stayTotal = perDay * days
  const tripTotal = flightPrice !== null ? flightPrice + stayTotal : null
  return { perDay, stayTotal, tripTotal }
}

function CostOfStayPanelContent({ destInfo, flightPrice, days }: { destInfo: DestInfo; flightPrice: number | null; days: number }) {
  const { perDay, stayTotal, tripTotal } = costOfStayNumbers(destInfo, flightPrice, days)

  return (
    <>
      <p className="font-semibold mb-3">Cost of stay in {destInfo.name}</p>
      <ul className="text-sm text-[#5B6472] space-y-1 mb-3">
        <li>Hostel: €{destInfo.hostel_avg_price ?? 0}/night</li>
        <li>Food: €{destInfo.food_avg_price ?? 0}/day</li>
        <li>Transport: €{destInfo.transport_avg_price ?? 0}/day</li>
        <li>Other: €{destInfo.other_avg_price ?? 0}/day</li>
      </ul>
      <p className="text-sm mb-1">Per day: <span className="font-mono font-semibold">€{perDay}</span></p>
      <p className="text-sm mb-3">{days} day{days === 1 ? '' : 's'}: <span className="font-mono font-semibold">€{stayTotal}</span></p>
      <div className="border-t border-[#E5E1D8] pt-3">
        {flightPrice !== null ? (
          <>
            <p className="text-sm text-[#5B6472]">Flight: €{flightPrice}</p>
            <p className="font-semibold mt-1">Trip total: <span className="font-mono">€{tripTotal}</span></p>
          </>
        ) : (
          <p className="text-sm text-[#5B6472]">Pick a flight to see the full trip total.</p>
        )}
      </div>
    </>
  )
}

/** Desktop: a card that sticks in place while the flight list scrolls past it. */
function CostOfStayDesktopPanel(props: { destInfo: DestInfo; flightPrice: number | null; days: number }) {
  return (
    <div className="hidden lg:block border border-[#E5E1D8] rounded-sm p-4 bg-white lg:sticky lg:top-6">
      <CostOfStayPanelContent {...props} />
    </div>
  )
}

/** Mobile: a compact bar pinned to the bottom of the screen showing just the
 * trip total; tapping it expands the full breakdown above the bar. */
function CostOfStayMobileBar({
  destInfo,
  flightPrice,
  days,
  expanded,
  onToggle,
}: {
  destInfo: DestInfo
  flightPrice: number | null
  days: number
  expanded: boolean
  onToggle: () => void
}) {
  const { tripTotal } = costOfStayNumbers(destInfo, flightPrice, days)

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E1D8] shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      {expanded && (
        <div className="max-h-[60vh] overflow-y-auto px-4 pt-4 border-b border-[#E5E1D8]">
          <CostOfStayPanelContent destInfo={destInfo} flightPrice={flightPrice} days={days} />
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-sm text-[#5B6472]">
          {expanded ? 'Hide breakdown ▾' : `Trip total · ${days} day${days === 1 ? '' : 's'} ▴`}
        </span>
        <span className="font-mono font-semibold">
          {tripTotal !== null ? `€${tripTotal}` : 'Pick a flight'}
        </span>
      </button>
    </div>
  )
}

type DayData = Record<string, { price: number; origin: string }>
type Selected = { date: string; price: number; origin: string } | null

type FlightOption = {
  origin: string
  destination?: string
  price: number
  departure_at: string
  return_at: string | null
  stops: number | null
  airlineCode: string | null
  airlineName: string | null
  gate: string | null
  bookingUrl: string
}

function flightLabel(f: FlightOption) {
  const parts: string[] = []
  if (f.airlineName) parts.push(f.airlineName)
  else if (f.airlineCode) parts.push(f.airlineCode)
  else if (f.gate) parts.push(`via ${f.gate}`)
  if (f.stops !== null) parts.push(f.stops === 0 ? 'Direct' : f.stops === 1 ? '1 stop' : `${f.stops} stops`)
  return parts.join(' · ')
}

function FlightOptionRow({
  flight,
  isSelected,
  onSelect,
  rank,
}: {
  flight: FlightOption
  isSelected: boolean
  onSelect: () => void
  rank: number
}) {
  const label = flightLabel(flight)
  const [datePart, timePart] = flight.departure_at.split('T')
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-sm border text-left transition-colors ${
        isSelected ? 'border-[#14213D] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white hover:bg-[#FBF9F4]'
      }`}
    >
      <div>
        {rank === 0 && <span className="text-[10px] font-semibold text-[#FCA311] block">CHEAPEST</span>}
        <p className="font-mono text-sm">
          {flight.origin} · {datePart}
          {timePart ? ` · ${timePart.slice(0, 5)}` : ''}
          {flight.return_at ? ` → ${flight.return_at}` : ''}
        </p>
        {label && <p className="text-xs text-[#5B6472]">{label}</p>}
      </div>
      <p className="font-mono font-semibold whitespace-nowrap">€{flight.price}</p>
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
}: {
  title: string
  data: DayData
  month: string
  onPrev: () => void
  onNext: () => void
  selectedDate: string | undefined
  onSelectDay: (date: string, price: number, origin: string) => void
}) {
  const total = daysInMonth(month)
  const startWeekday = firstWeekday(month)
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)

  const prices = Object.values(data).map((v) => v.price)
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  const minPrice = prices.length ? Math.min(...prices) : null

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onPrev} className="px-2 py-1 border border-[#E5E1D8] rounded-sm text-xs">←</button>
        <h3 className="font-semibold text-sm">{title} · {month}</h3>
        <button onClick={onNext} className="px-2 py-1 border border-[#E5E1D8] rounded-sm text-xs">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#5B6472] mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${month}-${String(day).padStart(2, '0')}`
          const entry = data[dateStr]
          const isCheapest = entry && entry.price === minPrice
          const isSelected = selectedDate === dateStr
          const isGood = entry && avg !== null && entry.price < avg

          return (
            <button
              key={i}
              type="button"
              disabled={!entry}
              onClick={() => entry && onSelectDay(dateStr, entry.price, entry.origin)}
              className={`aspect-square flex flex-col items-center justify-center rounded-sm text-xs border transition-colors ${
                isSelected
                  ? 'ring-2 ring-[#14213D] border-[#14213D] bg-[#FFF8EC]'
                  : entry
                  ? isGood
                    ? 'bg-[#E8F5E9] border-[#A5D6A7]'
                    : 'bg-[#FDECEA] border-[#F3B3AC]'
                  : 'bg-[#FBF9F4] border-transparent text-[#ccc] cursor-default'
              } ${isCheapest && !isSelected ? 'outline outline-2 outline-[#FCA311]' : ''}`}
            >
              <span>{day}</span>
              {entry && <span className="font-mono">€{entry.price}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const destination = searchParams.get('destination') || ''
  const origins = searchParams.get('origins') || ''
  const oneWay = searchParams.get('oneWay') === 'true'
  const dateMode = searchParams.get('dateMode') || 'exact'
  const openJaw = searchParams.get('openJaw') === 'true'
  const departMonth = searchParams.get('month') || ''
  const returnMonth = searchParams.get('returnMonth') || departMonth

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listResults, setListResults] = useState<FlightOption[]>([])
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0)
  const [outboundData, setOutboundData] = useState<DayData>({})
  const [inboundData, setInboundData] = useState<DayData>({})
  const [expandedCombo, setExpandedCombo] = useState<number | null>(null)

  const [selectedOut, setSelectedOut] = useState<Selected>(null)
  const [selectedBack, setSelectedBack] = useState<Selected>(null)
  const [outDayFlights, setOutDayFlights] = useState<FlightOption[]>([])
  const [backDayFlights, setBackDayFlights] = useState<FlightOption[]>([])
  const [selectedOutFlightIndex, setSelectedOutFlightIndex] = useState(0)
  const [selectedBackFlightIndex, setSelectedBackFlightIndex] = useState(0)
  const [loadingOutFlights, setLoadingOutFlights] = useState(false)
  const [loadingBackFlights, setLoadingBackFlights] = useState(false)
  const [mobileCostExpanded, setMobileCostExpanded] = useState(false)

  const [destInfo, setDestInfo] = useState<{
    name: string
    hostel_avg_price: number | null
    food_avg_price: number | null
    transport_avg_price: number | null
    other_avg_price: number | null
  } | null>(null)

  useEffect(() => {
    if (!destination) return
    fetch(`/api/destination-info?code=${encodeURIComponent(destination)}`)
      .then((res) => res.json())
      .then((data) => setDestInfo(data.destination || null))
      .catch(() => setDestInfo(null))
  }, [destination])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelectedOut(null)
    setSelectedBack(null)
    setOutDayFlights([])
    setBackDayFlights([])
    setSelectedFlightIndex(0)

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
        setListResults(data.results || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Something went wrong loading results. Please try again.')
        setLoading(false)
      })
  }, [searchParams.toString()])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/results?${params.toString()}`)
  }

  async function fetchOneWayDayFlights(fromOrigins: string[], toDestination: string, date: string): Promise<FlightOption[]> {
    const params = new URLSearchParams({
      destination: toDestination,
      origins: fromOrigins.join(','),
      oneWay: 'true',
      dateMode: 'exact',
      departDate: date,
    })
    const res = await fetch(`/api/compare?${params.toString()}`)
    const data = await res.json()
    return (data.results || []) as FlightOption[]
  }

  async function handleSelectOutDay(date: string, price: number, origin: string) {
    setSelectedOut({ date, price, origin })
    setSelectedOutFlightIndex(0)
    setLoadingOutFlights(true)
    try {
      const flights = await fetchOneWayDayFlights(origins.split(','), destination, date)
      setOutDayFlights(flights)
    } finally {
      setLoadingOutFlights(false)
    }
  }

  async function handleSelectBackDay(date: string, price: number, origin: string) {
    setSelectedBack({ date, price, origin })
    setSelectedBackFlightIndex(0)
    setLoadingBackFlights(true)
    try {
      const homeAirports = origins.split(',')
      const perAirport = await Promise.all(
        homeAirports.map(async (airport) => {
          const flights = await fetchOneWayDayFlights([destination], airport, date)
          return flights.map((f) => ({ ...f, destination: airport }))
        })
      )
      const merged = perAirport.flat().sort((a, b) => a.price - b.price)
      setBackDayFlights(merged)
    } finally {
      setLoadingBackFlights(false)
    }
  }

  const selectedOutFlight = outDayFlights[selectedOutFlightIndex] || null
  const selectedBackFlight = backDayFlights[selectedBackFlightIndex] || null
  const monthTotal =
    selectedOutFlight && selectedBackFlight
      ? selectedOutFlight.price + selectedBackFlight.price
      : selectedOutFlight?.price ?? null

  let activeFlightPrice: number | null = null
  let activeDepartDate: string | null = null
  let activeReturnDate: string | null = null

  if (dateMode === 'month') {
    activeFlightPrice = monthTotal
    activeDepartDate = selectedOutFlight?.departure_at.split('T')[0] || null
    activeReturnDate = selectedBackFlight?.departure_at.split('T')[0] || null
  } else if (openJaw) {
    const combo = listResults[0] as any
    if (combo) {
      activeFlightPrice = combo.total
      activeDepartDate = combo.outDeparture?.split('T')[0] || null
      activeReturnDate = combo.backDeparture?.split('T')[0] || null
    }
  } else {
    const flight = listResults[selectedFlightIndex] as FlightOption | undefined
    if (flight) {
      activeFlightPrice = flight.price
      activeDepartDate = flight.departure_at?.split('T')[0] || null
      activeReturnDate = flight.return_at || null
    }
  }

  const stayDays = activeDepartDate ? nightsBetween(activeDepartDate, activeReturnDate) : 1

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 pb-24 lg:pb-12">
      <Link href="/search" className="text-sm text-[#5B6472] hover:text-[#14213D] mb-6 inline-block">← New search</Link>
      <h1 className="text-2xl font-semibold mb-6">
        {origins.split(',')[0]}{origins.split(',').length > 1 ? ` +${origins.split(',').length - 1}` : ''} → {destination}
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
      <div className="flex flex-col lg:flex-row lg:items-start gap-8">
      <div className="flex-1 min-w-0">

      {dateMode === 'month' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <CalendarGrid
              title="Departing"
              data={outboundData}
              month={departMonth}
              onPrev={() => updateParam('month', shiftMonth(departMonth, -1))}
              onNext={() => updateParam('month', shiftMonth(departMonth, 1))}
              selectedDate={selectedOut?.date}
              onSelectDay={handleSelectOutDay}
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
              <p className="font-semibold text-sm mb-2">Flights on {selectedOut.date}</p>
              {loadingOutFlights && <p className="text-sm text-[#5B6472]">Loading flights for this day...</p>}
              {!loadingOutFlights && outDayFlights.length === 0 && (
                <p className="text-sm text-[#5B6472]">No individual cached flights found for this exact day — prices shown on the calendar are the cheapest found nearby. Try a different day for more options.</p>
              )}
              {!loadingOutFlights && outDayFlights.length > 0 && (
                <div className="space-y-2">
                  {outDayFlights.map((f, i) => (
                    <FlightOptionRow
                      key={`${f.origin}-${f.price}-${i}`}
                      flight={f}
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
              <p className="font-semibold text-sm mb-2">Return flights on {selectedBack.date}</p>
              {loadingBackFlights && <p className="text-sm text-[#5B6472]">Loading flights for this day...</p>}
              {!loadingBackFlights && backDayFlights.length === 0 && (
                <p className="text-sm text-[#5B6472]">No individual cached flights found for this exact day — prices shown on the calendar are the cheapest found nearby. Try a different day for more options.</p>
              )}
              {!loadingBackFlights && backDayFlights.length > 0 && (
                <div className="space-y-2">
                  {backDayFlights.map((f, i) => (
                    <FlightOptionRow
                      key={`${f.destination}-${f.price}-${i}`}
                      flight={{ ...f, origin: `${destination} → ${f.destination}` }}
                      rank={i}
                      isSelected={i === selectedBackFlightIndex}
                      onSelect={() => setSelectedBackFlightIndex(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {(selectedOutFlight || selectedBackFlight) && (
            <div className="border-2 border-[#14213D] rounded-sm p-4 bg-white">
              <p className="font-semibold mb-2">Your trip</p>
              {selectedOutFlight && (
                <p className="font-mono text-sm">
                  {selectedOutFlight.origin} → {destination} · {selectedOutFlight.departure_at.split('T')[0]} · €{selectedOutFlight.price}
                </p>
              )}
              {selectedBackFlight && (
                <p className="font-mono text-sm">
                  {destination} → {selectedBackFlight.destination} · {selectedBackFlight.departure_at.split('T')[0]} · €{selectedBackFlight.price}
                </p>
              )}
              {monthTotal !== null && <p className="font-semibold mt-2">Total: €{monthTotal}</p>}
              <div className="flex flex-wrap gap-3 mt-3">
                {selectedOutFlight && (
                  <a
                    href={selectedOutFlight.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-block px-4 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm text-sm hover:bg-[#e8940a] transition-colors"
                  >
                    {selectedBackFlight ? 'Book outbound →' : 'Book on Aviasales →'}
                  </a>
                )}
                {selectedBackFlight && (
                  <a
                    href={selectedBackFlight.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-block px-4 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm text-sm hover:bg-[#e8940a] transition-colors"
                  >
                    Book return →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {dateMode !== 'month' && listResults.length === 0 && (
        <p className="text-[#5B6472]">No cached prices found for this search. Try a more popular destination, or a different date mode.</p>
      )}

      {dateMode !== 'month' && listResults.length > 0 && openJaw && (
        <ul className="space-y-3">
          {listResults.map((combo: any, i) => (
            <li key={i} className={`rounded-sm border ${i === 0 ? 'border-2 border-[#FCA311] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white'}`}>
              <button type="button" onClick={() => setExpandedCombo(expandedCombo === i ? null : i)} className="w-full text-left px-5 py-4">
                {i === 0 && <p className="text-xs font-semibold text-[#FCA311] mb-1">CHEAPEST COMBO</p>}
                <p className="font-mono text-lg">{combo.outOrigin} → {destination} → {combo.backOrigin} · <span className="font-semibold">€{combo.total}</span></p>
                <p className="text-sm text-[#5B6472]">Tap to see both flights</p>
              </button>
              {expandedCombo === i && (
                <div className="px-5 pb-4 text-sm font-mono text-[#5B6472] space-y-3 border-t border-[#E5E1D8] pt-3">
                  <p>{combo.outOrigin} → {destination}: €{combo.outPrice} · {combo.outDeparture?.split('T')[0]}</p>
                  <p>{destination} → {combo.backOrigin}: €{combo.backPrice} · {combo.backDeparture?.split('T')[0]}</p>
                  <div className="flex flex-wrap gap-3 font-sans">
                    <a
                      href={buildBookingLink(combo.outOrigin, destination, combo.outDeparture)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-block px-4 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm text-sm hover:bg-[#e8940a] transition-colors"
                    >
                      Book outbound →
                    </a>
                    <a
                      href={buildBookingLink(destination, combo.backOrigin, combo.backDeparture)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-block px-4 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm text-sm hover:bg-[#e8940a] transition-colors"
                    >
                      Book return →
                    </a>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dateMode !== 'month' && listResults.length > 0 && !openJaw && (
        <>
          {dateMode === 'range' && (
            <p className="text-xs text-[#5B6472] mb-3">
              All cached flights found in your date range, cheapest first. Prices are cached and may change — always confirm on the booking site.
            </p>
          )}
          {dateMode === 'exact' && listResults.length > 1 && (
            <p className="text-xs text-[#5B6472] mb-3">
              All cached flights found for this day across your chosen airports, cheapest first.
            </p>
          )}
          <ul className="space-y-3">
            {listResults.map((r, i) => (
              <li key={`${r.origin}-${r.price}-${i}`} className={`px-5 py-4 rounded-sm border ${i === selectedFlightIndex ? 'border-2 border-[#FCA311] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white'}`}>
                <button type="button" onClick={() => setSelectedFlightIndex(i)} className="w-full text-left">
                  {i === 0 && <p className="text-xs font-semibold text-[#FCA311] mb-1">CHEAPEST</p>}
                  <p className="font-mono text-lg">{r.origin} → {destination} · <span className="font-semibold">€{r.price}</span></p>
                  <p className="text-sm text-[#5B6472] font-mono mb-1">
                    {r.departure_at?.split('T')[0]}{r.return_at ? ` → ${r.return_at}` : ' (one way)'}
                  </p>
                  {flightLabel(r) && <p className="text-sm text-[#5B6472]">{flightLabel(r)}</p>}
                </button>
                <a
                  href={r.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-block mt-3 px-4 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm text-sm hover:bg-[#e8940a] transition-colors"
                >
                  Book on Aviasales →
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      </div>

      {destInfo && (
        <div className="lg:w-72 flex-shrink-0">
          <CostOfStayDesktopPanel destInfo={destInfo} flightPrice={activeFlightPrice} days={stayDays} />
        </div>
      )}

      </div>
      )}

      {destInfo && !loading && !error && (
        <CostOfStayMobileBar
          destInfo={destInfo}
          flightPrice={activeFlightPrice}
          days={stayDays}
          expanded={mobileCostExpanded}
          onToggle={() => setMobileCostExpanded((v) => !v)}
        />
      )}
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
