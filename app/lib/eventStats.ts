// Counts of the site's own events (supabase/site_events.sql) for /api/debug-prices?key=…&events=1. Read-only, server only.

import { supabaseAdmin } from '../supabaseAdmin'

type EventRow = { at: string; name: string; page: string | null; trip: string | null; airport: string | null; mode: string | null; anywhere: boolean | null }

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

/** Searches and booking clicks of the last `days` days: totals, per day, and booking clicks per SubID part and per full SubID. */
export async function eventStats(days: number) {
  const since = new Date(Date.now() - days * 86400e3).toISOString()
  const rows: EventRow[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('site_events')
      .select('at,name,page,trip,airport,mode,anywhere')
      .gte('at', since)
      .order('at', { ascending: true })
      .range(from, from + 999)
    if (error) return { error: `${error.message} (is supabase/site_events.sql applied?)` }
    rows.push(...((data ?? []) as EventRow[]))
    if (!data || data.length < 1000) break
  }
  const searches = { total: 0, byMode: {} as Record<string, number>, byTrip: {} as Record<string, number>, anywhere: 0 }
  const clicks = { total: 0, byPage: {} as Record<string, number>, byTrip: {} as Record<string, number>, byAirport: {} as Record<string, number>, bySubId: {} as Record<string, number> }
  const perDay: Record<string, { searches: number; clicks: number }> = {}
  for (const r of rows) {
    const day = r.at.slice(0, 10)
    perDay[day] ??= { searches: 0, clicks: 0 }
    if (r.name === 'search') {
      searches.total++
      perDay[day].searches++
      bump(searches.byMode, r.mode ?? '?')
      bump(searches.byTrip, r.trip ?? '?')
      if (r.anywhere) searches.anywhere++
    } else if (r.name === 'book_click') {
      clicks.total++
      perDay[day].clicks++
      bump(clicks.byPage, r.page ?? 'no SubID')
      bump(clicks.byTrip, r.trip ?? 'no SubID')
      bump(clicks.byAirport, r.airport ?? 'no SubID')
      bump(clicks.bySubId, r.page && r.trip && r.airport ? `${r.page}_${r.trip}_${r.airport}` : 'no SubID')
    }
  }
  return {
    days,
    since,
    searches,
    clicks,
    clicksPerSearch: searches.total ? Math.round((clicks.total / searches.total) * 100) / 100 : null,
    perDay,
    note: 'Our own counts (no cookies, no personal data). Bookings and earnings per SubID are in Travelpayouts: Reports → Performance → Group by SubID.',
  }
}
