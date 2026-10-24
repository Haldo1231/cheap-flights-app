'use client'

import { useState } from 'react'
import { AIRPORTS } from '../airportsList'

export default function AirportPicker({
  onSelect,
  placeholder,
  onSelectAnywhere,
}: {
  onSelect: (code: string, city: string) => void
  placeholder: string
  /** When provided, shows an "Anywhere" option above the input (and at the
   * top of suggestions while typing) for destination fields that support
   * searching every destination instead of one specific city. */
  onSelectAnywhere?: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches =
    query.length > 0
      ? AIRPORTS.filter(
          (a) =>
            a.city.toLowerCase().includes(query.toLowerCase()) ||
            a.code.toLowerCase().includes(query.toLowerCase()) ||
            a.country.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 6)
      : []

  return (
    <div className="relative">
      {onSelectAnywhere && (
        <button
          type="button"
          onClick={onSelectAnywhere}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-sm border border-[#FCA311] bg-[#FFF8EC] text-[#14213D] text-sm font-medium hover:bg-[#FCEDCB] transition-colors"
        >
          ✈️ Anywhere — search all destinations
        </button>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-[#E5E1D8] rounded-sm text-sm"
      />
      {open && (matches.length > 0 || onSelectAnywhere) && (
        <ul className="absolute z-10 w-full bg-white border border-[#E5E1D8] rounded-sm mt-1 shadow-sm max-h-56 overflow-auto">
          {onSelectAnywhere && (
            <li
              onClick={() => { onSelectAnywhere(); setQuery(''); setOpen(false) }}
              className="px-3 py-2 hover:bg-[#FFF8EC] cursor-pointer text-sm flex justify-between border-b border-[#E5E1D8] font-medium"
            >
              <span>✈️ Anywhere</span>
              <span className="text-[#5B6472]">all destinations</span>
            </li>
          )}
          {matches.map((a) => (
            <li
              key={a.code}
              onClick={() => { onSelect(a.code, a.city); setQuery(''); setOpen(false) }}
              className="px-3 py-2 hover:bg-[#FBF9F4] cursor-pointer text-sm flex justify-between"
            >
              <span>{a.city}, {a.country}</span>
              <span className="font-mono text-[#5B6472]">{a.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
