'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AirportPicker from '../components/AirportPicker'
import { WEEKDAY_BUTTONS, ALL_WEEKDAYS, serializeDays } from '../weekdays'

const RECOMMENDED_AIRPORTS = [
  { code: 'BTS', name: 'Bratislava' },
  { code: 'VIE', name: 'Vienna' },
  { code: 'BUD', name: 'Budapest' },
  { code: 'KSC', name: 'Košice' },
  { code: 'PRG', name: 'Prague' },
]

function getNext12Months() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    months.push({ value, label })
  }
  return months
}

export default function SearchPage() {
  const router = useRouter()

  const [selectedAirports, setSelectedAirports] = useState<string[]>(['BTS', 'VIE', 'BUD', 'KSC', 'PRG'])
  const [extraOrigins, setExtraOrigins] = useState<{ code: string; city: string }[]>([])

  const [destinationCode, setDestinationCode] = useState('')
  const [destinationCity, setDestinationCity] = useState('')

  const [oneWay, setOneWay] = useState(false)
  const [openJaw, setOpenJaw] = useState(false)
  const [dateMode, setDateMode] = useState<'exact' | 'month' | 'range'>('exact')

  const [departDate, setDepartDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [month, setMonth] = useState('')
  const [returnMonth, setReturnMonth] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [minDays, setMinDays] = useState(2)
  const [maxDays, setMaxDays] = useState(8)

  const [outDays, setOutDays] = useState<number[]>(ALL_WEEKDAYS)
  const [backDays, setBackDays] = useState<number[]>(ALL_WEEKDAYS)
  const [minNights, setMinNights] = useState(1)
  const [maxNights, setMaxNights] = useState(14)

  function toggleOutDay(day: number) {
    setOutDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  function toggleBackDay(day: number) {
    setBackDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const months = getNext12Months()

  function toggleAirport(code: string) {
    setSelectedAirports((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  function addExtraOrigin(code: string, city: string) {
    if (extraOrigins.find((o) => o.code === code) || selectedAirports.includes(code)) return
    setExtraOrigins((prev) => [...prev, { code, city }])
  }

  function removeExtraOrigin(code: string) {
    setExtraOrigins((prev) => prev.filter((o) => o.code !== code))
  }

  function handleSearch() {
    if (!destinationCode) return
    const allOrigins = [...selectedAirports, ...extraOrigins.map((o) => o.code)]
    if (allOrigins.length === 0) return

    const isAnywhere = destinationCode === 'ANYWHERE'

    const params = new URLSearchParams({
      origins: allOrigins.join(','),
      oneWay: String(oneWay),
      dateMode,
      openJaw: String(isAnywhere ? false : openJaw),
    })

    if (isAnywhere) {
      params.set('anywhere', 'true')
    } else {
      params.set('destination', destinationCode)
    }

    if (dateMode === 'exact') {
      if (departDate) params.set('departDate', departDate)
      if (returnDate) params.set('returnDate', returnDate)
    } else if (dateMode === 'month') {
      if (month) params.set('month', month)
      if (!oneWay && returnMonth) params.set('returnMonth', returnMonth)
      params.set('outDays', serializeDays(outDays))
      if (!oneWay) {
        params.set('backDays', serializeDays(backDays))
        params.set('minNights', String(minNights))
        params.set('maxNights', String(maxNights))
      }
    } else if (dateMode === 'range') {
      if (rangeStart) params.set('rangeStart', rangeStart)
      if (rangeEnd) params.set('rangeEnd', rangeEnd)
      params.set('minDays', String(minDays))
      params.set('maxDays', String(maxDays))
    }

    router.push(`/results?${params.toString()}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Compare cheap flights</h1>
      <p className="text-[#5B6472] mb-8">Pick where you can fly from, where you want to go, and how flexible your dates are.</p>

      <div className="mb-6">
        <label className="block font-medium mb-2">Flying from</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {RECOMMENDED_AIRPORTS.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => toggleAirport(a.code)}
              className={`px-3 py-2 rounded-sm border text-sm font-mono transition-colors ${
                selectedAirports.includes(a.code) ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'
              }`}
            >
              {a.code} · {a.name}
            </button>
          ))}
          {extraOrigins.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => removeExtraOrigin(o.code)}
              className="px-3 py-2 rounded-sm border text-sm font-mono bg-[#FFF8EC] border-[#FCA311] text-[#14213D]"
            >
              {o.code} · {o.city} ✕
            </button>
          ))}
        </div>
        <AirportPicker placeholder="Add another airport, e.g. Barcelona" onSelect={addExtraOrigin} />
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Flying to</label>
        {destinationCode ? (
          <button
            type="button"
            onClick={() => { setDestinationCode(''); setDestinationCity('') }}
            className="px-3 py-2 rounded-sm border text-sm font-mono bg-[#FFF8EC] border-[#FCA311] text-[#14213D]"
          >
            {destinationCode === 'ANYWHERE' ? '✈️ Anywhere' : `${destinationCode} · ${destinationCity}`} ✕
          </button>
        ) : (
          <AirportPicker
            placeholder="Type a city, e.g. Rome"
            onSelect={(code, city) => { setDestinationCode(code); setDestinationCity(city) }}
            onSelectAnywhere={() => { setDestinationCode('ANYWHERE'); setDestinationCity('Anywhere') }}
          />
        )}
        {destinationCode === 'ANYWHERE' && (
          <p className="text-xs text-[#5B6472] mt-1">
            Searches every destination we have cached flight data for, grouped by country, cheapest first.
          </p>
        )}
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Trip type</label>
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={() => setOneWay(false)} className={`px-4 py-2 rounded-sm border text-sm ${!oneWay ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}>Round trip</button>
          <button type="button" onClick={() => setOneWay(true)} className={`px-4 py-2 rounded-sm border text-sm ${oneWay ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}>One way</button>
        </div>
        {!oneWay && destinationCode !== 'ANYWHERE' && (
          <label className="flex items-center gap-2 text-sm text-[#5B6472]">
            <input type="checkbox" checked={openJaw} onChange={(e) => setOpenJaw(e.target.checked)} />
            Allow flying back to a different airport (only works with Exact dates or Whole month)
          </label>
        )}
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Dates</label>
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setDateMode('exact')} className={`px-4 py-2 rounded-sm border text-sm ${dateMode === 'exact' ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}>Exact dates</button>
          <button type="button" onClick={() => setDateMode('month')} className={`px-4 py-2 rounded-sm border text-sm ${dateMode === 'month' ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}>Whole month</button>
          <button type="button" onClick={() => setDateMode('range')} className={`px-4 py-2 rounded-sm border text-sm ${dateMode === 'range' ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}>Date range</button>
        </div>

        {dateMode === 'exact' && (
          <div className="flex gap-3">
            <div>
              <label className="block text-xs text-[#5B6472] mb-1">Departure</label>
              <input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} className="px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
            </div>
            {!oneWay && (
              <div>
                <label className="block text-xs text-[#5B6472] mb-1">Return</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
              </div>
            )}
          </div>
        )}
        {dateMode === 'month' && (
          <div>
            <label className="block text-xs text-[#5B6472] mb-1">{oneWay ? 'Month' : 'Departure month'}</label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {months.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMonth(m.value)}
                  className={`px-3 py-2 rounded-sm border text-sm ${month === m.value ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {!oneWay && (
              <>
                <label className="block text-xs text-[#5B6472] mb-1">Return month</label>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {months.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setReturnMonth(m.value)}
                      className={`px-3 py-2 rounded-sm border text-sm ${returnMonth === m.value ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-2">
              <label className="block text-xs text-[#5B6472] mb-1">Departure days (optional)</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {WEEKDAY_BUTTONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleOutDay(d.value)}
                    className={`px-3 py-1.5 rounded-sm border text-sm ${outDays.includes(d.value) ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#5B6472] border-[#E5E1D8]'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {!oneWay && (
                <>
                  <label className="block text-xs text-[#5B6472] mb-1">Return days (optional)</label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {WEEKDAY_BUTTONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleBackDay(d.value)}
                        className={`px-3 py-1.5 rounded-sm border text-sm ${backDays.includes(d.value) ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#5B6472] border-[#E5E1D8]'}`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 items-end">
                    <div>
                      <label className="block text-xs text-[#5B6472] mb-1">Min nights</label>
                      <input type="number" min={1} max={60} value={minNights} onChange={(e) => setMinNights(Number(e.target.value))} className="w-24 px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5B6472] mb-1">Max nights</label>
                      <input type="number" min={1} max={60} value={maxNights} onChange={(e) => setMaxNights(Number(e.target.value))} className="w-24 px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}


        {dateMode === 'range' && (
          <div>
            <div className="flex gap-3 mb-3">
              <div>
                <label className="block text-xs text-[#5B6472] mb-1">From</label>
                <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[#5B6472] mb-1">To</label>
                <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-xs text-[#5B6472] mb-1">Min days</label>
                <input type="number" min={1} max={30} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} className="w-24 px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[#5B6472] mb-1">Max days</label>
                <input type="number" min={1} max={30} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} className="w-24 px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm" />
              </div>
            </div>
            <p className="text-xs text-[#5B6472] mt-1">Experimental — fewer cached results may be available than the other two modes.</p>
          </div>
        )}
      </div>

      <button onClick={handleSearch} className="px-6 py-3 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm hover:bg-[#e8940a] transition-colors">
        Search
      </button>
    </div>
  )
}
