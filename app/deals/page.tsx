import { supabase } from '../supabase'
import Link from 'next/link'

export default async function DealsPage() {
  const { data: deals, error } = await supabase
    .from('weekly_deals')
    .select('*')
    .order('price', { ascending: true })

  if (error) {
    return <div style={{ padding: 40 }}>Error loading deals: {error.message}</div>
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
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
                style={{ display: 'block', padding: 15, textDecoration: 'none', color: 'inherit' }}
              >
                <strong>🔥 {deal.destination_city}</strong> — <strong>€{deal.price}</strong>
                <br />
                <small>{deal.origin} → {deal.destination} · {deal.departure_date} → {deal.return_date}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
