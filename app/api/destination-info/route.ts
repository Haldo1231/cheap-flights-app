import { supabase } from '../../supabase'
import { badRequest, cachedJson, cleanCode } from '../../lib/apiParams'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = cleanCode(searchParams.get('code'))

  if (!code) return badRequest('Missing or invalid code')

  const { data, error } = await supabase
    .from('destinations')
    .select('name, slug, hostel_avg_price, food_avg_price, transport_avg_price, other_avg_price')
    .eq('airport_code', code)
    .maybeSingle()

  if (error || !data) {
    // Not cached for long: a missing row may just be a hiccup.
    return cachedJson({ destination: null }, 60)
  }

  return cachedJson({ destination: data }, 3600)
}
