'use client'

import { useState, useEffect } from 'react'

export default function AnywherePage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/anywhere')
      .then((res) => res.json())
      .then((data) => {
        setResults(data.results || [])
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <h1>Where can I fly cheaply?</h1>
      <p>Cheapest destinations right now from Vienna, Bratislava, Budapest, and Košice — sorted by price.</p>

      {loading && <p>Loading cheap destinations...</p>}

      {!loading && results.length === 0 && (
        <p>No cached destination prices found right now. Try again later.</p>
      )}

      {!loading && results.length > 0 && (
        <ol style={{ padding: 0, listStyle: 'none' }}>
          {results.map((r, i) => (
            <li
              key={r.destination}
              style={{
                padding: 15,
                marginBottom: 10,
                border: i === 0 ? '2px solid #0070f3' : '1px solid #ddd',
                borderRadius: 8,
                backgroundColor: i === 0 ? '#f0f7ff' : 'white',
              }}
            >
              <strong>{i + 1}. {r.destinationName}</strong> — <strong>€{r.price}</strong>
              <br />
              <small>{r.origin} → {r.destination} · {r.departure_at?.split('T')[0]} → {r.return_at?.split('T')[0]}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
