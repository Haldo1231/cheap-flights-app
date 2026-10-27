import { NextResponse } from 'next/server'
import { getCheapestDestinations } from '../../cheapDestinations'

// Cheapest cached fare to each curated destination (kept for the /anywhere page
// and anything that links to it).
export async function GET() {
  const results = await getCheapestDestinations()
  return NextResponse.json({
    results: results.map(({ destination, fare }) => ({
      destination: destination.code,
      destinationName: destination.name,
      destinationSlug: destination.slug,
      origin: fare.outbound.origin,
      price: fare.price,
      departure_at: fare.outbound.time ? `${fare.outbound.date}T${fare.outbound.time}:00` : fare.outbound.date,
      return_at: fare.inbound ? (fare.inbound.time ? `${fare.inbound.date}T${fare.inbound.time}:00` : fare.inbound.date) : null,
      airlineCode: fare.outbound.airlineCode,
      airlineName: fare.outbound.airlineName,
      fare,
    })),
  })
}
