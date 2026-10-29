import { supabase } from '../../supabase'
import { cachedJson } from '../../lib/apiParams'
import type { DestinationCostsResponse } from '../../lib/budget'

// One small answer with the cost numbers of ALL destinations (about a dozen rows), so the Anywhere
// screens can work out budgets for every city with one request instead of one per city.
export async function GET() {
  const { data, error } = await supabase
    .from('destinations')
    .select('airport_code, name, hostel_avg_price, food_avg_price, transport_avg_price, other_avg_price')

  if (error || !data) {
    // Short cache: a failure may just be a hiccup. The screens then say "no cost data".
    return cachedJson<DestinationCostsResponse>({ destinations: {} }, 60)
  }

  const destinations: DestinationCostsResponse['destinations'] = {}
  for (const row of data) {
    if (!row.airport_code) continue
    destinations[String(row.airport_code).toUpperCase()] = {
      name: row.name,
      hostel_avg_price: row.hostel_avg_price,
      food_avg_price: row.food_avg_price,
      transport_avg_price: row.transport_avg_price,
      other_avg_price: row.other_avg_price,
    }
  }
  return cachedJson<DestinationCostsResponse>({ destinations }, 3600)
}
