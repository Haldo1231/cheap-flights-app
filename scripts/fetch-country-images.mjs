#!/usr/bin/env node
// One-off helper: finds ONE landscape photo per country on Unsplash and saves
// the result in data/country-images.json. The website only reads that file, so
// visitors never trigger Unsplash API calls.
//
//   npm run images:fetch                 # fetch every country that has no photo yet
//   npm run images:fetch -- --only=IT,ES # just these countries
//   npm run images:fetch -- --refresh    # also redo countries that already have one
//   npm run images:fetch -- --limit=20   # stop after 20 countries
//   npm run images:fetch -- --dry-run    # show what would happen, change nothing
//
// It needs UNSPLASH_ACCESS_KEY in .env.local (Unsplash "Access Key", never the
// secret key). The key is only used by this script and is never printed.
//
// Unsplash rules this script follows (https://unsplash.com/documentation,
// "API Guidelines"):
//  - photos are used straight from Unsplash's servers (the site hotlinks),
//  - the photographer and Unsplash are credited (the site shows the credit),
//  - every photo we pick is reported to Unsplash through its download endpoint,
//  - the key stays on this computer.
//
// A new Unsplash app is in "demo" mode: 50 requests per hour, and each country
// needs 2 requests, so about 25 countries per run. The script stops politely
// when the hour is used up. Run it again later and it carries on where it
// stopped. (Applying for "production" status in the Unsplash dashboard raises
// the limit to 5000 per hour.)

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT = path.join(ROOT, 'data', 'country-images.json')
// UNSPLASH_API_BASE only exists so the script can be tested against a fake server.
const API = (process.env.UNSPLASH_API_BASE || 'https://api.unsplash.com').replace(/\/$/, '')
const COUNTRIES_URL = 'https://api.travelpayouts.com/data/en/countries.json'

// Where the most likely destinations come first, so a limited hourly quota is
// spent on the countries people will actually see.
const PRIORITY = [
  'IT', 'ES', 'FR', 'GB', 'DE', 'NL', 'PT', 'GR', 'HR', 'PL', 'AT', 'CH', 'BE', 'IE', 'CZ', 'HU', 'DK', 'SE', 'NO',
  'FI', 'IS', 'MT', 'CY', 'TR', 'EG', 'MA', 'AE', 'TH', 'RO', 'BG', 'RS', 'AL', 'ME', 'BA', 'SI', 'SK', 'LT', 'LV',
  'EE', 'GE', 'AM', 'IL', 'JO', 'TN', 'LU', 'MK', 'XK', 'MD', 'UA', 'US', 'JP', 'CN', 'IN', 'VN', 'ID', 'MX',
]

// Names that mean something else on a photo site ("Georgia", "Turkey" ...).
const QUERY_NAME = {
  GE: 'Tbilisi Georgia',
  TR: 'Istanbul Turkey',
  JO: 'Petra Jordan',
  US: 'New York United States',
  GB: 'London United Kingdom',
  CZ: 'Prague Czech Republic',
  AE: 'Dubai',
  NL: 'Amsterdam Netherlands',
  IE: 'Ireland',
}

// Photos whose text mentions people are skipped: landmarks and landscapes only.
const PEOPLE =
  /\b(man|men|woman|women|people|person|persons|girl|girls|boy|boys|child|children|kid|kids|couple|portrait|selfie|crowd|crowds|tourist|tourists|model|face|faces|hiker|hikers|traveler|traveller|bride|groom|wedding|friends|family|baby|lady|guy|guys|human|silhouette)\b/i
const SCENERY =
  /\b(landmark|castle|cathedral|church|old town|skyline|city|coast|beach|mountain|mountains|lake|bridge|tower|palace|harbou?r|village|temple|mosque|ruins|monument|square|landscape|sea|island|river|valley)\b/i

function parseArgs(argv) {
  const args = { only: null, refresh: false, limit: Infinity, dryRun: false, out: DEFAULT_OUT, countriesFile: null, help: false }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--refresh') args.refresh = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--only=')) args.only = arg.slice(7).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    else if (arg.startsWith('--limit=')) args.limit = Math.max(1, parseInt(arg.slice(8), 10) || 1)
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.slice(6))
    else if (arg.startsWith('--countries-file=')) args.countriesFile = path.resolve(arg.slice(17))
    else console.log(`Ignoring unknown option: ${arg}`)
  }
  return args
}

/** Reads UNSPLASH_ACCESS_KEY from .env.local (nothing else is read). */
async function readAccessKey() {
  if (process.env.UNSPLASH_ACCESS_KEY) return process.env.UNSPLASH_ACCESS_KEY.trim()
  const file = path.join(ROOT, '.env.local')
  if (!existsSync(file)) return ''
  const text = await readFile(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?UNSPLASH_ACCESS_KEY\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let value = m[1]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    return value.trim()
  }
  return ''
}

async function loadCountries(file) {
  let list
  if (file) {
    list = JSON.parse(await readFile(file, 'utf8'))
  } else {
    const res = await fetch(COUNTRIES_URL)
    if (!res.ok) throw new Error(`Could not load the country list (HTTP ${res.status})`)
    list = await res.json()
  }
  const seen = new Set()
  const countries = []
  for (const c of list) {
    const code = String(c?.code || '').toUpperCase()
    const name = String(c?.name || '').trim()
    if (!/^[A-Z]{2}$/.test(code) || !name || seen.has(code)) continue
    seen.add(code)
    countries.push({ code, name })
  }
  const rank = (code) => {
    const i = PRIORITY.indexOf(code)
    return i === -1 ? Infinity : i
  }
  return countries.sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name))
}

async function loadExisting(file) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'))
    return {
      about: data.about,
      images: data.images ?? {},
      noPhoto: Array.isArray(data.noPhoto) ? data.noPhoto : [],
    }
  } catch {
    return { about: undefined, images: {}, noPhoto: [] }
  }
}

async function save(file, data) {
  const images = Object.fromEntries(Object.entries(data.images).sort(([a], [b]) => a.localeCompare(b)))
  // noPhoto remembers countries where nothing suitable was found, so the next run
  // does not spend the hourly quota on them again (--refresh tries them anyway).
  const noPhoto = [...new Set(data.noPhoto)].sort()
  const body = { about: data.about, generatedAt: new Date().toISOString(), noPhoto, images }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(body, null, 2) + '\n', 'utf8')
}

class RateLimited extends Error {}
class BadKey extends Error {}

/** Talks to Unsplash and keeps track of how many requests are left this hour. */
function createClient(key) {
  const state = { remaining: null }
  async function call(url) {
    // The key is only ever sent to the Unsplash API address, never anywhere else.
    if (new URL(url).origin !== new URL(API).origin) throw new Error(`Refusing to send the key to ${new URL(url).origin}`)
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } })
    const left = res.headers.get('x-ratelimit-remaining')
    if (left !== null && left !== '') state.remaining = Number(left)
    if (res.status === 401) throw new BadKey('Unsplash rejected the key (401). Check UNSPLASH_ACCESS_KEY in .env.local.')
    if (res.status === 403 || res.status === 429) throw new RateLimited('Unsplash says the hourly limit is used up.')
    if (!res.ok) throw new Error(`Unsplash answered HTTP ${res.status}`)
    return res.json()
  }
  return { state, call }
}

function score(photo, index, countryName) {
  if (!photo?.urls?.raw || !photo.user) return -Infinity
  const { width, height } = photo
  if (!(width >= 2400 && width / height >= 1.35 && width / height <= 2.2)) return -Infinity
  const words = [photo.alt_description, photo.description, ...(photo.tags || []).map((t) => t?.title)]
    .filter(Boolean)
    .join(' ')
  if (PEOPLE.test(words)) return -Infinity
  let s = 100 - index * 2 // Unsplash lists the most relevant first
  if (SCENERY.test(words)) s += 12
  if (words.toLowerCase().includes(countryName.toLowerCase())) s += 6
  s += Math.min(photo.likes || 0, 2000) / 400
  return s
}

function pickBest(photos, countryName) {
  let best = null
  photos.forEach((photo, i) => {
    const s = score(photo, i, countryName)
    if (s > (best?.score ?? -Infinity)) best = { photo, score: s }
  })
  return best?.photo ?? null
}

async function findPhoto(client, country) {
  const base = QUERY_NAME[country.code] || country.name
  const queries = [`${base} travel landmark`, `${base} landscape`]
  for (const query of queries) {
    if (client.state.remaining !== null && client.state.remaining < 2) throw new RateLimited('Hourly limit reached.')
    const params = new URLSearchParams({
      query,
      orientation: 'landscape',
      per_page: '20',
      content_filter: 'high',
      order_by: 'relevant',
    })
    const data = await client.call(`${API}/search/photos?${params}`)
    const photo = pickBest(data.results || [], country.name)
    if (photo) return photo
  }
  return null
}

function toRecord(photo, countryName) {
  return {
    raw: photo.urls.raw,
    alt: photo.alt_description || photo.description || `${countryName} landscape`,
    color: photo.color || null,
    width: photo.width,
    height: photo.height,
    photographer: photo.user.name || photo.user.username,
    photographerUrl: photo.user.links?.html || `https://unsplash.com/@${photo.user.username}`,
    photoUrl: photo.links?.html || `https://unsplash.com/photos/${photo.id}`,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('See the comment at the top of scripts/fetch-country-images.mjs for what the options do.')
    return
  }

  const key = await readAccessKey()
  if (!key) {
    console.log('UNSPLASH_ACCESS_KEY is not set, so no photos were fetched.')
    console.log('Nothing is broken: the site shows a navy-and-amber gradient with the country flag instead of a photo.')
    console.log('To add photos: create a free app at https://unsplash.com/developers, copy its "Access Key",')
    console.log('add a line  UNSPLASH_ACCESS_KEY=your-key  to .env.local, then run  npm run images:fetch  again.')
    return
  }

  const countries = await loadCountries(args.countriesFile)
  const data = await loadExisting(args.out)
  const wanted = countries.filter((c) => (args.only ? args.only.includes(c.code) : true))
  const todo = wanted
    .filter((c) => args.refresh || (!data.images[c.code] && !data.noPhoto.includes(c.code)))
    .slice(0, args.limit)
  console.log(`${wanted.length} countries in scope, ${wanted.length - todo.length} already done or skipped, ${todo.length} to fetch.`)
  if (args.dryRun) {
    console.log(todo.map((c) => `${c.code} ${c.name}`).join('\n'))
    return
  }

  const client = createClient(key)
  let added = 0
  const noPhoto = []
  let stoppedEarly = false

  for (const country of todo) {
    try {
      const photo = await findPhoto(client, country)
      if (!photo) {
        noPhoto.push(country.code)
        if (!data.noPhoto.includes(country.code)) data.noPhoto.push(country.code)
        await save(args.out, data)
        console.log(`  --  ${country.code} ${country.name}: no suitable photo found`)
        continue
      }
      // Unsplash asks to be told when a photo is used: this is that report.
      if (photo.links?.download_location) await client.call(photo.links.download_location)
      data.images[country.code] = toRecord(photo, country.name)
      data.noPhoto = data.noPhoto.filter((code) => code !== country.code)
      added += 1
      await save(args.out, data) // saved after every country, so nothing is lost if it stops
      console.log(`  ok  ${country.code} ${country.name}: photo by ${photo.user.name}`)
    } catch (error) {
      if (error instanceof RateLimited) {
        stoppedEarly = true
        break
      }
      if (error instanceof BadKey) {
        console.log(error.message)
        process.exitCode = 1
        return
      }
      console.log(`  !!  ${country.code} ${country.name}: ${error.message}`)
    }
  }

  const left = wanted.filter((c) => !data.images[c.code] && !data.noPhoto.includes(c.code)).length
  console.log(`\nDone: ${added} photo(s) added. ${Object.keys(data.images).length} countries now have a photo.`)
  if (noPhoto.length) console.log(`No suitable photo for: ${noPhoto.join(', ')} (they use the gradient fallback).`)
  if (stoppedEarly) {
    console.log(`Stopped because Unsplash's hourly limit is used up. ${left} countries still need a photo.`)
    console.log('Run  npm run images:fetch  again in about an hour: it continues where it stopped.')
  } else if (left > 0) {
    console.log(`${left} countries still have no photo. Run the command again to continue.`)
  }
  console.log('Please look through the photos once (the file lists photographers and links) before you publish.')
}

main().catch((error) => {
  console.error(`Stopped: ${error.message}`)
  process.exitCode = 1
})
