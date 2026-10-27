import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/supabaseAdmin'
import { getCheapestDestinations } from '../../../cheapDestinations'

// Daily (see vercel.json): stores the 6 cheapest destinations in weekly_deals.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cheapest = await getCheapestDestinations()
  const topDeals = cheapest.slice(0, 6).map(({ destination, fare }) => ({
    origin: fare.outbound.origin,
    destination: destination.code,
    destination_city: destination.name,
    destination_slug: destination.slug,
    price: fare.price,
    departure_date: fare.outbound.date,
    return_date: fare.inbound?.date ?? null,
  }))

  await supabaseAdmin.from('weekly_deals').delete().neq('id', 0)
  const { error } = await supabaseAdmin.from('weekly_deals').insert(topDeals)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: topDeals.length })
}
