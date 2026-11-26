import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/app/supabaseAdmin'
import { getCheapestDestinations } from '../../../cheapDestinations'
import { HOME_AIRPORT_ROWS } from '../../../homeAirports'
import { resumeStuckRun, selfBase } from '../../../lib/priceRun'

// Daily (see vercel.json, 06:00 UTC): stores the 6 cheapest destinations in weekly_deals, then refreshes the /deals page.
// It is also the WATCHDOG of the nightly price run (the Hobby plan allows only two cron jobs): a price run that made no
// progress for 30 minutes is resumed from here (lib/priceRun.ts).
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deals = await refreshDeals()
  let priceRun: string
  try {
    priceRun = (await resumeStuckRun(selfBase(request.url))).detail
  } catch (e) {
    priceRun = `check failed: ${(e as Error).message}`
  }
  console.log(`generate-deals: ${deals.detail}; price run: ${priceRun}`)
  return NextResponse.json({ ...deals, priceRun }, { status: deals.ok ? 200 : deals.status })
}

async function refreshDeals(): Promise<{ ok: boolean; status: number; count: number; detail: string }> {
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

  // Nothing found (store empty, price service down): keep yesterday's deals instead of an empty page.
  if (topDeals.length === 0) return { ok: false, status: 503, count: 0, detail: 'no cached fares, kept the previous deals' }

  // weekly_deals.origin must exist in `airports`: add any home airport that is missing (existing rows are left as they are).
  const airports = await supabaseAdmin.from('airports').upsert(HOME_AIRPORT_ROWS, { onConflict: 'code', ignoreDuplicates: true })
  if (airports.error) console.warn(`generate-deals: could not check the airports table: ${airports.error.message}`)

  // New deals first, old ones removed only after that worked: a failed insert never leaves the page empty.
  const inserted = await supabaseAdmin.from('weekly_deals').insert(topDeals).select('id')
  if (inserted.error || !inserted.data) {
    return { ok: false, status: 500, count: 0, detail: `could not store the deals (previous deals kept): ${inserted.error?.message ?? 'no answer'}` }
  }
  const newIds = inserted.data.map((row) => (row as { id: number }).id)
  const removed = await supabaseAdmin.from('weekly_deals').delete({ count: 'exact' }).not('id', 'in', `(${newIds.join(',')})`)
  const removedNote = removed.error ? `old deals not removed: ${removed.error.message}` : `${removed.count ?? 0} old deals removed`

  // The page is rebuilt from the new rows on its next visit (otherwise it could keep showing the old list for an hour or more).
  revalidatePath('/deals')
  revalidatePath('/') // the home page shows the cheapest fresh deals too
  return { ok: true, status: 200, count: newIds.length, detail: `${newIds.length} deals stored, ${removedNote}, /deals and / refreshed` }
}
