'use client'

import { useState } from 'react'

export default function SearchPage() {
  const [destination, setDestination] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (!destination) return
    setLoading(true)
    setSearched(true)
    const res = await fetch(`/api/compare?destination=${destination.toUpperCase()}`)
    const data = await res.json()
    setResults(data.results || [])
    setLoading(false)
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600 }}>
      <h1>Compare Cheap Flights</h1>
      <p>Enter a destination airport code (e.g. FCO for Rome, BCN for Barcelona) to compare prices from Vienna, Bratislava, Budapest, and Košice.</p>

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. FCO"
          style={{ padding: 8, fontSize: 16, marginRight: 10, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          onClick={handleSearch}
          style={{ padding: '8px 16px', fontSize: 16, backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Search
        </button>
      </div>

      {loading && <p>Searching...</p>}

      {!loading && searched && results.length === 0 && (
        <p>No cached prices found for this route yet. Try a more popular destination like FCO, BCN, or MXP.</p>
      )}

      {!loading && results.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {results.map((r, i) => (
            <li
              key={r.origin}
              style={{
                padding: 15,
                marginBottom: 10,
                border: i === 0 ? '2px solid #0070f3' : '1px solid #ddd',
                borderRadius: 8,
                backgroundColor: i === 0 ? '#f0f7ff' : 'white',
              }}
            >
              {i === 0 && <strong>🔥 Cheapest — </strong>}
              <strong>{r.origin}</strong> → {destination.toUpperCase()}: <strong>€{r.price}</strong>
              <br />
              <small>{r.departure_at?.split('T')[0]} → {r.return_at?.split('T')[0]} · {r.airline}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
