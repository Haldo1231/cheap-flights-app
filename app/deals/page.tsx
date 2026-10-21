import { supabase } from '../supabase'
import Link from 'next/link'
import { buildBookingLink } from '../aviasalesLink'

export default async function DealsPage() {
  const { data: deals, error } = await supabase
    .from('weekly_deals')
    .select('*')
    .order('price', { ascending: true })

  if (error) {
    return <div style={{ padding: '24px 20px' }}>Error loading deals: {error.message}</div>
  }

  return (
    <div style={{ padding: '24px 20px', fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <h1>🔥 Top Cheap Flights This Week</h1>
      <p>Hand-picked cheap flight deals from Vienna, Bratislava, Budapest, and Košice.</p>

      {(!deals || deals.length === 0) && (
        <p>No deals generated yet — check back soon.</p>
      )}

      {deals && deals.length > 0 && (
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {deals.map((deal, i) => (
            <li
              key={deal.id}
              style={{
                marginBottom: 10,
                border: i === 0 ? '2px solid #0070f3' : '1px solid #ddd',
                borderRadius: 8,
                backgroundColor: i === 0 ? '#f0f7ff' : 'white',
              }}
            >
              <Link
                href={`/destinations/${deal.destination_slug}`}
                style={{ display: 'block', padding: '15px 15px 0', textDecoration: 'none', color: 'inherit' }}
              >
                <strong>🔥 {deal.destination_city}</strong> — <strong>€{deal.price}</strong>
                <br />
                <small>{deal.origin} → {deal.destination} · {deal.departure_date} → {deal.return_date}</small>
              </Link>
              <div style={{ padding: 15 }}>
                <a
                  href={buildBookingLink(deal.origin, deal.destination, deal.departure_date, deal.return_date)}
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
        </ul>
      )}
    </div>
  )
}
