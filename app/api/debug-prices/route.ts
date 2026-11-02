import { NextResponse } from 'next/server'
import { cleanCode, cleanDate, cleanMonth } from '../../lib/apiParams'
import { currencyIsEuro, isFreshPrice } from '../../flightSources'
import { priceAgeText } from '../../lib/priceAge'

// A checking tool for the owner, to compare what Travelpayouts really answers with what the site shows.
// It is OFF unless DEBUG_PRICES_KEY is set (in Vercel: Settings > Environment Variables). Open
//   /api/debug-prices?key=<your key>&origin=BTS&destination=WAW&date=2026-11-09
// It asks Travelpayouts live (no cache) and shows the raw numbers. The Travelpayouts token is never shown.

type Raw = Record<string, unknown>

async function ask(label: string, path: string, params: Record<string, string>, token: string, pick: (json: Raw) => Raw[]) {
  const query = new URLSearchParams({ ...params, currency: 'eur' })
  const shown = `https://api.travelpayouts.com${path}?${query.toString()}`
  try {
    const res = await fetch(`${shown}&token=${token}`, { cache: 'no-store' })
    if (!res.ok) return { label, url: shown, status: res.status, error: 'request failed' }
    const json = (await res.json()) as Raw
    const entries = pick(json)
    const rows = entries.slice(0, 8).map((e) => {
      const foundAt = (e.found_at as string | undefined) ?? null
      const expiresAt = (e.expires_at as string | undefined) ?? null
      return {
        price: e.price ?? e.value ?? null,
        depart: e.departure_at ?? e.depart_date ?? null,
        return: e.return_at ?? e.return_date ?? null,
        isRoundTrip: Boolean(e.return_at ?? e.return_date),
        found_at: foundAt,
        expires_at: expiresAt,
        age: priceAgeText(foundAt),
        usedBySite: isFreshPrice({ foundAt, expiresAt }),
        airline: e.airline ?? null,
        gate: e.gate ?? null,
      }
    })
    return {
      label,
      url: shown,
      status: res.status,
      currencyInAnswer: json.currency ?? '(not named)',
      currencyAccepted: currencyIsEuro(json),
      entries: entries.length,
      cheapestFirst: rows.sort((a, b) => Number(a.price) - Number(b.price)),
    }
  } catch (error) {
    return { label, url: shown, error: (error as Error).message }
  }
}

export async function GET(request: Request) {
  const key = process.env.DEBUG_PRICES_KEY
  const { searchParams } = new URL(request.url)
  // Off (and invisible) unless a key is set and matches.
  if (!key || searchParams.get('key') !== key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const token = process.env.TRAVELPAYOUTS_TOKEN
  const origin = cleanCode(searchParams.get('origin'))
  const destination = cleanCode(searchParams.get('destination'))
  const date = cleanDate(searchParams.get('date'))
  if (!token || !origin || !destination || !date) {
    return NextResponse.json({ error: 'Needs origin, destination and date (YYYY-MM-DD), and TRAVELPAYOUTS_TOKEN must be set.' }, { status: 400 })
  }
  const month = cleanMonth(date.slice(0, 7)) as string
  const common = { origin, destination }
  const answers = await Promise.all([
    ask('v1/prices/cheap (that day)', '/v1/prices/cheap', { ...common, depart_date: date }, token, (j) =>
      Object.values(((j.data as Raw | undefined)?.[destination] as Raw | undefined) ?? {}) as Raw[]
    ),
    ask('v2/prices/latest (default, round trips)', '/v2/prices/latest', { ...common, sorting: 'price', limit: '1000' }, token, (j) =>
      ((j.data as Raw[] | undefined) ?? []).filter((e) => e.depart_date === date)
    ),
    ask('v2/prices/latest (one_way=true)', '/v2/prices/latest', { ...common, sorting: 'price', limit: '1000', one_way: 'true' }, token, (j) =>
      ((j.data as Raw[] | undefined) ?? []).filter((e) => e.depart_date === date)
    ),
    ask('v1/prices/calendar (that month, that day)', '/v1/prices/calendar', { ...common, depart_date: month, calendar_type: 'departure_date' }, token, (j) => {
      const day = (j.data as Raw | undefined)?.[date]
      return day ? [day as Raw] : []
    }),
  ])
  return NextResponse.json({ origin, destination, date, note: 'isRoundTrip=true means that one price covers BOTH flights.', answers })
}
