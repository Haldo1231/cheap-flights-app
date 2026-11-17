import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/supabaseAdmin'
import { LINK_PAGES, LINK_TRIPS, type LinkPage, type LinkTrip } from '../../lib/subId'

// Stores one site event (lib/siteEvents.ts). Only known names and values are kept; anything else is ignored. Always answers 204,
// so a failed write never shows on the page. No IP address or browser details are stored.
export const dynamic = 'force-dynamic'

const MODES = new Set(['exact', 'month', 'range'])
let warned = false

type Row = { name: 'search' | 'book_click'; page?: LinkPage | null; trip?: LinkTrip | null; airport?: string | null; mode?: string | null; anywhere?: boolean | null }

function clean(input: unknown): Row | null {
  if (!input || typeof input !== 'object') return null
  const e = input as Record<string, unknown>
  if (e.name === 'search') {
    if (typeof e.mode !== 'string' || !MODES.has(e.mode)) return null
    if (e.trip !== 'ow' && e.trip !== 'rt') return null
    return { name: 'search', mode: e.mode, trip: e.trip, anywhere: e.anywhere === true }
  }
  if (e.name === 'book_click') {
    const m = typeof e.subId === 'string' ? /^([a-z]+)_([a-z]+)_([a-z0-9]{3,4})$/.exec(e.subId) : null
    const page = m && (LINK_PAGES as readonly string[]).includes(m[1]) ? (m[1] as LinkPage) : null
    const trip = m && (LINK_TRIPS as readonly string[]).includes(m[2]) ? (m[2] as LinkTrip) : null
    return { name: 'book_click', page, trip, airport: page && trip ? m![3] : null }
  }
  return null
}

export async function POST(request: Request) {
  const text = await request.text().catch(() => '')
  if (text.length > 0 && text.length < 500) {
    let row: Row | null = null
    try {
      row = clean(JSON.parse(text))
    } catch {
      row = null
    }
    if (row) {
      const { error } = await supabaseAdmin.from('site_events').insert(row)
      if (error && !warned) {
        warned = true
        console.warn(`[events] not stored (is supabase/site_events.sql applied?): ${error.message}`)
      }
    }
  }
  return new NextResponse(null, { status: 204 })
}
