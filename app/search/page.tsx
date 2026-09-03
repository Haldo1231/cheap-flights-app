'use client'

import { useState } from 'react'
import AirportPicker from '../components/AirportPicker'

const RECOMMENDED_AIRPORTS = [
  { code: 'BTS', name: 'Bratislava' },
  { code: 'VIE', name: 'Vienna' },
  { code: 'BUD', name: 'Budapest' },
  { code: 'KSC', name: 'Košice' },
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
  const [selectedAirports, setSelectedAirports] = useState<string[]>(['BTS', 'VIE', 'BUD', 'KSC'])
  const [extraOrigins, setExtraOrigins] = useState<{ code: string; city: string }[]>([])

  const [destinationCode, setDestinationCode] = useState('')
  const [destinationCity, setDestinationCity] = useState('')

  const [oneWay, setOneWay] = useState(false)
  const [dateMode, setDateMode] = useState<'exact' | 'month' | 'range'>('exact')

  const [departDate, setDepartDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [month, setMonth] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [minDays, setMinDays] = useState(2)
  const [maxDays, setMaxDays] = useState(8)

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

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

  async function handleSearch() {
    if (!destinationCode) return
    const allOrigins = [...selectedAirports, ...extraOrigins.map((o) => o.code)]
    if (allOrigins.length === 0) return

    setLoading(true)
    setSearched(true)

    const params = new URLSearchParams({
      destination: destinationCode,
      origins: allOrigins.join(','),
      oneWay: String(oneWay),
      dateMode,
    })

    if (dateMode === 'exact') {
      if (departDate) params.set('departDate', departDate)
      if (returnDate) params.set('returnDate', returnDate)
    } else if (dateMode === 'month') {
      if (month) params.set('month', month)
    } else if (dateMode === 'range') {
      if (rangeStart) params.set('rangeStart', rangeStart)
      if (rangeEnd) params.set('rangeEnd', rangeEnd)
      params.set('minDays', String(minDays))
      params.set('maxDays', String(maxDays))
    }

    const res = await fetch(`/api/compare?${params.toString()}`)
    const data = await res.json()
    setResults(data.results || [])
    setLoading(false)
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
            {destinationCode} · {destinationCity} ✕
          </button>
        ) : (
          <AirportPicker placeholder="Type a city, e.g. Rome" onSelect={(code, city) => { setDestinationCode(code); setDestinationCity(city) }} />
        )}
        <p className="text-xs text-[#5B6472] mt-1">
          Don&apos;t know where yet? Try the <a href="/anywhere" className="text-[#14213D] underline">Anywhere search</a> instead.
        </p>
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Trip type</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOneWay(false)} className={`px-4 py-2 rounded-sm border text-sm ${!oneWay ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}>Round trip</button>
          <button type="button" onClick={() => setOneWay(true)} className={`px-4 py-2 rounded-sm border text-sm ${oneWay ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-[#14213D] border-[#E5E1D8]'}`}>One way</button>
        </div>
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
          <div className="grid grid-cols-4 gap-2">
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

      <button onClick={handleSearch} className="px-6 py-3 bg-[#FCA311] text-[#14213D] font-semibold rounded-sm hover:bg-[#e8940a] transition-colors mb-10">
        Search
      </button>

      {loading && <p className="text-[#5B6472]">Searching...</p>}
      {!loading && searched && results.length === 0 && (
        <p className="text-[#5B6472]">No cached prices found for this search. Try a more popular destination, or a different date mode.</p>
      )}
      {!loading && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((r, i) => (
            <li key={r.origin} className={`px-5 py-4 rounded-sm border ${i === 0 ? 'border-2 border-[#FCA311] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white'}`}>
              {i === 0 && <p className="text-xs font-semibold text-[#FCA311] mb-1">CHEAPEST</p>}
              <p className="font-mono text-lg">{r.origin} → {destinationCode} · <span className="font-semibold">€{r.price}</span></p>
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
