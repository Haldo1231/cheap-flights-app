'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { buildBookingLink } from '../aviasalesLink'

export default function AnywherePage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/anywhere')
      .then((res) => res.json())
      .then((data) => {
        setResults(data.results || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Something went wrong loading destinations. Please try again.')
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '24px 20px', fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <h1>Where can I fly cheaply?</h1>
      <p>Cheapest destinations right now from Vienna, Bratislava, Budapest, and Košice — sorted by price.</p>

      {loading && <p>Loading cheap destinations...</p>}

      {!loading && error && (
        <div style={{ border: '1px solid #F3B3AC', backgroundColor: '#FDECEA', borderRadius: 8, padding: 15 }}>
          <p style={{ margin: '0 0 10px' }}>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#14213D',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <p>No cached destination prices found right now. Try again later.</p>
      )}

      {!loading && !error && results.length > 0 && (
        <ol style={{ padding: 0, listStyle: 'none' }}>
          {results.map((r, i) => (
            <li
              key={r.destination}
              style={{
                marginBottom: 10,
                border: i === 0 ? '2px solid #0070f3' : '1px solid #ddd',
                borderRadius: 8,
                backgroundColor: i === 0 ? '#f0f7ff' : 'white',
              }}
            >
              <Link
                href={`/destinations/${r.destinationSlug}`}
                style={{ display: 'block', padding: '15px 15px 0', textDecoration: 'none', color: 'inherit' }}
              >
                <strong>{i + 1}. {r.destinationName}</strong> — <strong>€{r.price}</strong>
                <br />
                <small>{r.origin} → {r.destination} · {r.departure_at?.split('T')[0]} → {r.return_at?.split('T')[0]}</small>
              </Link>
              <div style={{ padding: 15 }}>
                <a
                  href={buildBookingLink(r.origin, r.destination, r.departure_at, r.return_at)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  style={{
                    display: 'inline-block',
                    padding: '6px 14px',
                    backgroundColor: '#FCA311',
                    color: '#14213D',
                    fontWeight: 600,
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontSize: 14,
                  }}
                >
                  Book on Aviasales →
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
