// The cheapest cached fare to each of our curated destinations. One shared
// place for the /anywhere page, its API route and the daily deals cron job.

import { getCheapestFare } from './flightSources'
import { HOME_AIRPORTS } from './homeAirports'
import { DESTINATIONS } from './destinationsList'
import { mapWithLimit } from './lib/pool'
import type { Fare } from './tripTypes'

export type CheapDestination = {
  destination: (typeof DESTINATIONS)[number]
  fare: Fare
}

/** Cheapest first. Destinations with no cached fare are left out. */
export async function getCheapestDestinations(): Promise<CheapDestination[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const rows = await mapWithLimit(DESTINATIONS, 4, async (destination) => ({
    destination,
    fare: await getCheapestFare(HOME_AIRPORTS, destination.code, token),
  }))
  return rows
    .filter((r): r is CheapDestination => r.fare !== null)
    .sort((a, b) => a.fare.price - b.fare.price)
}
