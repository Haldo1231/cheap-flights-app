#!/usr/bin/env node
// Builds data/routes.json: which /flights/<origin>-<destination> pages exist.
//
// Run it with `npm run routes` after the nightly price job has been running for a while, then COMMIT the result.
// The list is committed on purpose: the addresses of these pages must not change between deployments just because the
// price store looked different at build time (see app/lib/routePages.ts).
//
// Needs the same two variables as the site: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Nothing is written to the database; it only reads price_tickets.

import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HOME_AIRPORTS = ['BTS', 'VIE', 'BUD', 'KSC', 'PRG']

// Only the destinations the site names (app/destinationsList.ts). The store also knows the 25 cheapest destinations of
// every airport, but those have no city page, no cost data and no photo, so they are not page material yet.
const DESTINATIONS = [
  { code: 'ROM', name: 'Rome', slug: 'rome', country: 'Italy', countryCode: 'IT' },
  { code: 'MIL', name: 'Milan', slug: 'milan', country: 'Italy', countryCode: 'IT' },
  { code: 'BCN', name: 'Barcelona', slug: 'barcelona', country: 'Spain', countryCode: 'ES' },
  { code: 'ATH', name: 'Athens', slug: 'athens', country: 'Greece', countryCode: 'GR' },
  { code: 'PAR', name: 'Paris', slug: 'paris', country: 'France', countryCode: 'FR' },
  { code: 'LON', name: 'London', slug: 'london', country: 'United Kingdom', countryCode: 'GB' },
  { code: 'BER', name: 'Berlin', slug: 'berlin', country: 'Germany', countryCode: 'DE' },
  { code: 'AMS', name: 'Amsterdam', slug: 'amsterdam', country: 'Netherlands', countryCode: 'NL' },
  { code: 'LIS', name: 'Lisbon', slug: 'lisbon', country: 'Portugal', countryCode: 'PT' },
  { code: 'WAW', name: 'Warsaw', slug: 'warsaw', country: 'Poland', countryCode: 'PL' },
  { code: 'KRK', name: 'Krakow', slug: 'krakow', country: 'Poland', countryCode: 'PL' },
  { code: 'MAD', name: 'Madrid', slug: 'madrid', country: 'Spain', countryCode: 'ES' },
]

const ORIGIN_CITIES = {
  BTS: { city: 'Bratislava', country: 'Slovakia', countryCode: 'SK' },
  VIE: { city: 'Vienna', country: 'Austria', countryCode: 'AT' },
  BUD: { city: 'Budapest', country: 'Hungary', countryCode: 'HU' },
  KSC: { city: 'Košice', country: 'Slovakia', countryCode: 'SK' },
  PRG: { city: 'Prague', country: 'Czechia', countryCode: 'CZ' },
}

// Keep in step with THRESHOLD in app/lib/routePages.ts.
const THRESHOLD = { tickets: 30, departureDays: 20, months: 3, oneWayDays: 8, roundTripDays: 8, freshHours: 72 }

/** "Košice" -> "kosice": accents dropped, lowercase, anything else a hyphen. */
function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const PAGE = 1000

/** Every stored ticket of one route, read page by page (Supabase answers at most 1000 rows). */
async function readRoute(db, origin, destination) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('price_tickets')
      .select('departure_date, month, one_way, found_at')
      .eq('origin', origin)
      .eq('destination', destination)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`reading ${origin}-${destination}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

function measure(rows) {
  const days = new Set()
  const months = new Set()
  const oneWayDays = new Set()
  const roundTripDays = new Set()
  let newest = 0
  for (const r of rows) {
    days.add(r.departure_date)
    months.add(r.month)
    ;(r.one_way ? oneWayDays : roundTripDays).add(r.departure_date)
    const t = Date.parse(r.found_at)
    if (Number.isFinite(t) && t > newest) newest = t
  }
  return {
    tickets: rows.length,
    departureDays: days.size,
    months: months.size,
    oneWayDays: oneWayDays.size,
    roundTripDays: roundTripDays.size,
    ageHours: newest ? Math.round((Date.now() - newest) / 3600e3) : Infinity,
  }
}

function passes(m) {
  return (
    m.tickets >= THRESHOLD.tickets &&
    m.departureDays >= THRESHOLD.departureDays &&
    m.months >= THRESHOLD.months &&
    m.oneWayDays >= THRESHOLD.oneWayDays &&
    m.roundTripDays >= THRESHOLD.roundTripDays &&
    m.ageHours <= THRESHOLD.freshHours
  )
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (put them in .env.local and export them).')
    process.exit(1)
  }
  const db = createClient(url, key)

  const routes = []
  const skipped = []
  for (const origin of HOME_AIRPORTS) {
    const home = ORIGIN_CITIES[origin]
    for (const d of DESTINATIONS) {
      const m = measure(await readRoute(db, origin, d.code))
      const why = []
      if (m.tickets < THRESHOLD.tickets) why.push(`${m.tickets} tickets`)
      if (m.departureDays < THRESHOLD.departureDays) why.push(`${m.departureDays} days`)
      if (m.months < THRESHOLD.months) why.push(`${m.months} months`)
      if (m.oneWayDays < THRESHOLD.oneWayDays) why.push(`${m.oneWayDays} one-way days`)
      if (m.roundTripDays < THRESHOLD.roundTripDays) why.push(`${m.roundTripDays} round-trip days`)
      if (m.ageHours > THRESHOLD.freshHours) why.push(`newest price ${m.ageHours} h old`)
      if (!passes(m)) {
        skipped.push(`${origin}-${d.code}: ${why.join(', ')}`)
        continue
      }
      routes.push({
        slug: `${slugify(home.city)}-${slugify(d.name)}`,
        origin,
        destination: d.code,
        originCity: home.city,
        destinationCity: d.name,
        destinationCountry: d.country,
        countryCode: d.countryCode,
        destinationSlug: d.slug,
      })
      console.log(`  kept ${origin}-${d.code}: ${m.tickets} tickets, ${m.departureDays} days, ${m.months} months`)
    }
  }

  const duplicates = routes.map((r) => r.slug).filter((s, i, all) => all.indexOf(s) !== i)
  if (duplicates.length) throw new Error(`two routes want the same address: ${duplicates.join(', ')}`)

  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'routes.json')
  await writeFile(out, `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), threshold: THRESHOLD, routes }, null, 2)}\n`)

  console.log(`\n${routes.length} route pages written to data/routes.json`)
  const perAirport = HOME_AIRPORTS.map((o) => `${o} ${routes.filter((r) => r.origin === o).length}`).join(', ')
  console.log(`per airport: ${perAirport}`)
  console.log(`\n${skipped.length} routes left out (not enough in the store):`)
  for (const s of skipped) console.log(`  ${s}`)
  console.log('\nCommit data/routes.json so the addresses stay the same.')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
