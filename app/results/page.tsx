'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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

type DayData = Record<string, { price: number; origin: string }>
type Selected = { date: string; price: number; origin: string } | null

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
  const [listResults, setListResults] = useState<any[]>([])
  const [outboundData, setOutboundData] = useState<DayData>({})
  const [inboundData, setInboundData] = useState<DayData>({})
  const [expandedCombo, setExpandedCombo] = useState<number | null>(null)

  const [selectedOut, setSelectedOut] = useState<Selected>(null)
  const [selectedBack, setSelectedBack] = useState<Selected>(null)

  useEffect(() => {
    setLoading(true)
    setSelectedOut(null)
    setSelectedBack(null)

    if (dateMode === 'month') {
      const outParams = new URLSearchParams({ destination, origins, month: departMonth, leg: 'outbound' })
      const requests = [fetch(`/api/calendar?${outParams.toString()}`).then((r) => r.json())]

      if (!oneWay) {
        const inParams = new URLSearchParams({ destination, origins, month: returnMonth, leg: 'inbound' })
        requests.push(fetch(`/api/calendar?${inParams.toString()}`).then((r) => r.json()))
      }

      Promise.all(requests).then((results) => {
        setOutboundData(results[0].data || {})
        setInboundData(results[1] ? results[1].data || {} : {})
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
  }, [searchParams.toString()])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/results?${params.toString()}`)
  }

  const total = selectedOut && selectedBack ? selectedOut.price + selectedBack.price : selectedOut?.price || null

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/search" className="text-sm text-[#5B6472] hover:text-[#14213D] mb-6 inline-block">← New search</Link>
      <h1 className="text-2xl font-semibold mb-6">
        {origins.split(',')[0]}{origins.split(',').length > 1 ? ` +${origins.split(',').length - 1}` : ''} → {destination}
      </h1>

      {loading && <p className="text-[#5B6472]">Searching...</p>}

      {!loading && dateMode === 'month' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <CalendarGrid
              title="Departing"
              data={outboundData}
              month={departMonth}
              onPrev={() => updateParam('month', shiftMonth(departMonth, -1))}
              onNext={() => updateParam('month', shiftMonth(departMonth, 1))}
              selectedDate={selectedOut?.date}
              onSelectDay={(date, price, origin) => setSelectedOut({ date, price, origin })}
            />
            {!oneWay && (
              <CalendarGrid
                title="Returning"
                data={inboundData}
                month={returnMonth}
                onPrev={() => updateParam('returnMonth', shiftMonth(returnMonth, -1))}
                onNext={() => updateParam('returnMonth', shiftMonth(returnMonth, 1))}
                selectedDate={selectedBack?.date}
                onSelectDay={(date, price, origin) => setSelectedBack({ date, price, origin })}
              />
            )}
          </div>

          <p className="text-xs text-[#5B6472] mb-4">
            <span className="inline-block w-3 h-3 bg-[#E8F5E9] border border-[#A5D6A7] rounded-sm mr-1 align-middle" /> Below average ·{' '}
            <span className="inline-block w-3 h-3 bg-[#FDECEA] border border-[#F3B3AC] rounded-sm mr-1 ml-2 align-middle" /> Above average ·{' '}
            <span className="inline-block w-3 h-3 border-2 border-[#FCA311] rounded-sm mr-1 ml-2 align-middle" /> Cheapest day
          </p>

          {(selectedOut || selectedBack) && (
            <div className="border-2 border-[#14213D] rounded-sm p-4 bg-white">
              <p className="font-semibold mb-2">Your trip</p>
              {selectedOut && (
                <p className="font-mono text-sm">
                  {selectedOut.origin} → {destination} · {selectedOut.date} · €{selectedOut.price}
                </p>
              )}
              {selectedBack && (
                <p className="font-mono text-sm">
                  {destination} → {selectedBack.origin} · {selectedBack.date} · €{selectedBack.price}
                </p>
              )}
              {total !== null && <p className="font-semibold mt-2">Total: €{total}</p>}
              <p className="text-xs text-[#5B6472] mt-3">Booking link coming soon — for now, use these dates when searching directly with an airline or booking site.</p>
            </div>
          )}
        </div>
      )}

      {!loading && dateMode !== 'month' && listResults.length === 0 && (
        <p className="text-[#5B6472]">No cached prices found for this search. Try a more popular destination, or a different date mode.</p>
      )}

      {!loading && dateMode !== 'month' && listResults.length > 0 && openJaw && (
        <ul className="space-y-3">
          {listResults.map((combo, i) => (
            <li key={i} className={`rounded-sm border ${i === 0 ? 'border-2 border-[#FCA311] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white'}`}>
              <button type="button" onClick={() => setExpandedCombo(expandedCombo === i ? null : i)} className="w-full text-left px-5 py-4">
                {i === 0 && <p className="text-xs font-semibold text-[#FCA311] mb-1">CHEAPEST COMBO</p>}
                <p className="font-mono text-lg">{combo.outOrigin} → {destination} → {combo.backOrigin} · <span className="font-semibold">€{combo.total}</span></p>
                <p className="text-sm text-[#5B6472]">Tap to see both flights</p>
              </button>
              {expandedCombo === i && (
                <div className="px-5 pb-4 text-sm font-mono text-[#5B6472] space-y-1 border-t border-[#E5E1D8] pt-3">
                  <p>{combo.outOrigin} → {destination}: €{combo.outPrice} · {combo.outDeparture?.split('T')[0]}</p>
                  <p>{destination} → {combo.backOrigin}: €{combo.backPrice} · {combo.backDeparture?.split('T')[0]}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && dateMode !== 'month' && listResults.length > 0 && !openJaw && (
        <ul className="space-y-3">
          {listResults.map((r, i) => (
            <li key={r.origin} className={`px-5 py-4 rounded-sm border ${i === 0 ? 'border-2 border-[#FCA311] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white'}`}>
              {i === 0 && <p className="text-xs font-semibold text-[#FCA311] mb-1">CHEAPEST</p>}
              <p className="font-mono text-lg">{r.origin} → {destination} · <span className="font-semibold">€{r.price}</span></p>
              <p className="text-sm text-[#5B6472] font-mono">
                {r.departure_at?.split('T')[0]}{r.return_at ? ` → ${r.return_at.split('T')[0]}` : ' (one way)'}
              </p>
            </li>
          ))}
        </ul>
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
