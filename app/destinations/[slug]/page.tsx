import { supabase } from '../../supabase'
import { buildBookingLink } from '../../aviasalesLink'

const AIRPORTS = ['BTS', 'VIE', 'BUD', 'KSC']

async function getCheapestFlight(destinationCode: string) {
  const token = process.env.TRAVELPAYOUTS_TOKEN

  const results = await Promise.all(
    AIRPORTS.map(async (origin) => {
      try {
        const url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destinationCode}&currency=eur&token=${token}`
        const res = await fetch(url, { next: { revalidate: 3600 } })
        if (!res.ok) return null
        const json = await res.json()

        const destData = json.data?.[destinationCode]
        if (!destData) return null

        const firstEntry: any = Object.values(destData)[0]
        if (!firstEntry) return null

        return {
          origin,
          price: firstEntry.price,
          departure_at: firstEntry.departure_at,
          return_at: firstEntry.return_at,
        }
      } catch {
        return null
      }
    })
  )

  const valid = results.filter((r) => r !== null) as any[]
  if (valid.length === 0) return null

  valid.sort((a, b) => a.price - b.price)
  return valid[0]
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: destination, error } = await supabase
    .from('destinations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !destination) {
    return <div style={{ padding: '24px 20px' }}>Destination not found.</div>
  }

  const { data: hostels } = await supabase
    .from('hostels')
    .select('*')
    .eq('destination_slug', slug)

  const cheapestFlight = destination.airport_code
    ? await getCheapestFlight(destination.airport_code)
    : null

  const dailyTotal =
    (destination.hostel_avg_price || 0) +
    (destination.food_avg_price || 0) +
    (destination.transport_avg_price || 0) +
    (destination.other_avg_price || 0)

  const tripNights = 3
  const tripTotal = (cheapestFlight?.price || 0) + dailyTotal * tripNights

  return (
    <div style={{ padding: '24px 20px', fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <h1>{destination.name}</h1>
      <p style={{ color: '#555' }}>{destination.description}</p>

      <div style={{ padding: 20, backgroundColor: '#f0f7ff', borderRadius: 8, marginBottom: 30 }}>
        {cheapestFlight ? (
          <>
            <strong style={{ fontSize: 22 }}>Flight from €{cheapestFlight.price}</strong>
            <p style={{ margin: '5px 0 0' }}>Cheapest from {cheapestFlight.origin}</p>
            <a
              href={buildBookingLink(
                cheapestFlight.origin,
                destination.airport_code,
                cheapestFlight.departure_at,
                cheapestFlight.return_at
              )}
              target="_blank"
              rel="noopener noreferrer sponsored"
              style={{
                display: 'inline-block',
                marginTop: 10,
                padding: '8px 16px',
                backgroundColor: '#FCA311',
                color: '#14213D',
                fontWeight: 600,
                borderRadius: 4,
                textDecoration: 'none',
              }}
            >
              Book on Aviasales →
            </a>
          </>
        ) : (
          <p>No current flight price found for this route — try the search page directly.</p>
        )}
      </div>

      <h2>Estimated daily budget</h2>
      <ul>
        <li>Hostel: €{destination.hostel_avg_price}/night</li>
        <li>Food: €{destination.food_avg_price}/day</li>
        <li>Transport: €{destination.transport_avg_price}/day</li>
        <li>Other: €{destination.other_avg_price}/day</li>
      </ul>
      <p><strong>Estimated daily cost: €{dailyTotal}</strong></p>

      <h2>{tripNights}-day trip estimate</h2>
      <p>
        Flight: €{cheapestFlight?.price || '—'}<br />
        Accommodation + food + transport ({tripNights} days): €{dailyTotal * tripNights}<br />
        <strong>Estimated total: €{tripTotal}</strong>
      </p>
      <h2>Recommended hostels</h2>
      {(!hostels || hostels.length === 0) && <p>Hostel recommendations coming soon.</p>}
      {hostels && hostels.length > 0 && (
        <ul>
          {hostels.map((h) => (
            <li key={h.id} style={{ marginBottom: 8 }}>
              <a href={h.booking_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3' }}>
                {h.name}
              </a>{' '}
              — €{h.price_per_night}/night, rated {h.rating}
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
