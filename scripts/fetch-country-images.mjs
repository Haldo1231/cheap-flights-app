#!/usr/bin/env node
// One-off helper: finds ONE landscape photo per country and saves the result in
// data/country-images.json. The website only reads that file, so visitors never
// trigger photo-site API calls.
//
//   npm run images                       # fetch every country that has no photo yet
//   npm run images -- --only=IT,ES       # just these countries
//   npm run images -- --refresh          # also redo countries that already have one
//   npm run images -- --limit=20         # stop after 20 countries
//   npm run images -- --wait             # when the hourly limit is hit, wait and carry on
//   npm run images -- --source=pexels    # use only Pexels (default: Unsplash first)
//   npm run images -- --dry-run          # show what would happen, change nothing
//
// Keys come from .env.local (they are only read, never printed):
//   UNSPLASH_ACCESS_KEY   the "Access Key" of your Unsplash app (never the secret key)
//   PEXELS_API_KEY        optional: used only when Unsplash is unavailable
//
// Unsplash rules this script follows (https://unsplash.com/documentation,
// "API Guidelines"):
//  - photos are used straight from Unsplash's servers (the site hotlinks),
//  - the photographer and Unsplash are credited (the site shows the credit),
//  - every photo we pick is reported to Unsplash through its download endpoint,
//  - the key stays on this computer.
// Pexels rules: photographer and Pexels are credited; photos are hotlinked.
//
// A new Unsplash app is in "demo" mode: 50 requests per hour, and each country
// needs 2 to 4 requests, so about 12-25 countries per hour. The script waits a
// moment between requests and stops politely when the hour is used up (or waits
// for the next hour with --wait). Run it again later and it carries on where it
// stopped. Applying for "production" status in the Unsplash dashboard raises the
// limit to 5000 per hour.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT = path.join(ROOT, 'data', 'country-images.json')
const REVIEW_FILE = path.join(ROOT, 'data', 'country-images-review.md')
// The *_API_BASE variables only exist so the script can be tested against a fake server.
const UNSPLASH_API = (process.env.UNSPLASH_API_BASE || 'https://api.unsplash.com').replace(/\/$/, '')
const PEXELS_API = (process.env.PEXELS_API_BASE || 'https://api.pexels.com').replace(/\/$/, '')
const COUNTRIES_URL = 'https://api.travelpayouts.com/data/en/countries.json'
const FLAG_ICONS_JSON = path.join(ROOT, 'node_modules', 'flag-icons', 'country.json')

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
  MK: 'Ohrid North Macedonia',
  BA: 'Mostar Bosnia',
  GN: 'Conakry Guinea',
  NE: 'Niger Africa',
  CG: 'Brazzaville Congo',
  CD: 'Kinshasa Congo',
  GF: 'French Guiana',
  GQ: 'Equatorial Guinea',
  PG: 'Papua New Guinea',
}

// Photos whose text mentions people, or that are clearly not scenery, are skipped:
// landmarks and landscapes only.
const PEOPLE =
  /\b(man|men|woman|women|people|person|persons|girl|girls|boy|boys|child|children|kid|kids|couple|portrait|selfie|crowd|crowds|tourist|tourists|model|face|faces|hiker|hikers|traveler|traveller|bride|groom|wedding|friends|family|baby|lady|guy|guys|human|silhouette|player|soldier|police|worker|monk)\b/i
const NOT_SCENERY =
  /\b(map|flag|passport|money|coin|coins|banknote|logo|poster|illustration|drawing|painting|text|sign|menu|food|dish|meal|coffee|car|cars|bus|train|airplane|aircraft|interior|room|bedroom|kitchen|bathroom|office|shop|store|screen|phone|laptop|animal|dog|cat|bird|horse|cow|sheep|insect|flower|flowers|plant|macro|abstract|texture|pattern|wallpaper)\b/i
const SCENERY =
  /\b(landmark|castle|cathedral|church|old town|skyline|city|coast|beach|mountain|mountains|lake|bridge|tower|palace|harbou?r|village|temple|mosque|ruins|monument|square|landscape|sea|island|river|valley|waterfall|canyon|desert|forest|bay|cliff|fortress|aerial)\b/i

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function parseArgs(argv) {
  const args = {
    only: null,
    refresh: false,
    limit: Infinity,
    dryRun: false,
    wait: false,
    waitMinutes: 61,
    delay: 1200,
    source: 'auto',
    out: DEFAULT_OUT,
    review: REVIEW_FILE,
    countriesFile: null,
    help: false,
  }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--refresh') args.refresh = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--wait') args.wait = true
    else if (arg.startsWith('--only=')) args.only = arg.slice(7).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    else if (arg.startsWith('--limit=')) args.limit = Math.max(1, parseInt(arg.slice(8), 10) || 1)
    else if (arg.startsWith('--delay=')) args.delay = Math.max(0, parseInt(arg.slice(8), 10) || 0)
    else if (arg.startsWith('--wait-minutes=')) args.waitMinutes = Math.max(0.01, parseFloat(arg.slice(15)) || 61)
    else if (arg.startsWith('--source=')) args.source = arg.slice(9)
    else if (arg.startsWith('--out=')) {
      args.out = path.resolve(arg.slice(6))
      args.review = args.out.replace(/\.json$/, '') + '-review.md'
    } else if (arg.startsWith('--countries-file=')) args.countriesFile = path.resolve(arg.slice(17))
    else console.log(`Ignoring unknown option: ${arg}`)
  }
  if (!['auto', 'unsplash', 'pexels'].includes(args.source)) {
    console.log(`Unknown --source=${args.source}, using auto.`)
    args.source = 'auto'
  }
  return args
}

/** Reads the two photo keys from the environment or .env.local (nothing else is read). */
async function readKeys() {
  const wanted = ['UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY']
  const keys = {}
  for (const name of wanted) if (process.env[name]) keys[name] = process.env[name].trim()
  const file = path.join(ROOT, '.env.local')
  if (existsSync(file)) {
    const text = await readFile(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (!m || !wanted.includes(m[1]) || keys[m[1]]) continue
      let value = m[2]
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (value.trim()) keys[m[1]] = value.trim()
    }
  }
  return { unsplash: keys.UNSPLASH_ACCESS_KEY || '', pexels: keys.PEXELS_API_KEY || '' }
}

async function loadFlagIcons() {
  try {
    return JSON.parse(await readFile(FLAG_ICONS_JSON, 'utf8'))
  } catch {
    return []
  }
}

/** Every country the site can show (Travelpayouts' list, the same one the site uses),
 * with the capital city when the flag-icons package knows it. */
async function loadCountries(file) {
  const extra = new Map()
  for (const c of await loadFlagIcons()) {
    if (/^[a-z]{2}$/.test(c.code)) extra.set(c.code.toUpperCase(), { capital: c.capital || '', name: c.name })
  }

  let list = null
  try {
    if (file) list = JSON.parse(await readFile(file, 'utf8'))
    else {
      const res = await fetch(COUNTRIES_URL)
      if (res.ok) list = await res.json()
      else console.log(`Could not load Travelpayouts' country list (HTTP ${res.status}).`)
    }
  } catch (error) {
    console.log(`Could not load Travelpayouts' country list (${error.message}).`)
  }
  if (!list) {
    if (extra.size === 0) throw new Error('No country list available. Run  npm install  and try again.')
    console.log("Using the flag-icons package's country list instead.")
    list = [...extra.entries()].map(([code, v]) => ({ code, name: v.name }))
  }

  const seen = new Set()
  const countries = []
  for (const c of list) {
    const code = String(c?.code || '').toUpperCase()
    const name = String(c?.name || '').trim()
    if (!/^[A-Z]{2}$/.test(code) || !name || seen.has(code)) continue
    seen.add(code)
    countries.push({ code, name, capital: extra.get(code)?.capital || '' })
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

/** A readable list of every chosen photo, so a person can skim it and spot a bad pick. */
async function writeReview(file, countries, data) {
  const names = new Map(countries.map((c) => [c.code, c.name]))
  const rows = Object.entries(data.images)
    .sort(([a], [b]) => (names.get(a) || a).localeCompare(names.get(b) || b))
    .map(([code, img]) => {
      const alt = String(img.alt || '').replace(/\|/g, '/').slice(0, 90)
      return `| ${names.get(code) || code} (${code}) | ${img.source || 'unsplash'} | ${alt} | [${String(img.photographer).replace(/\|/g, '/')}](${img.photographerUrl}) | [photo](${img.photoUrl}) |`
    })
  const missing = countries.filter((c) => !data.images[c.code]).map((c) => `${c.name} (${c.code})`)
  const text = [
    '# Country photos: review list',
    '',
    'Written by `npm run images`. Open the "photo" links to check each pick. To replace a bad one, delete its entry in',
    '`data/country-images.json` and run `npm run images -- --only=CODE --refresh`.',
    '',
    `${rows.length} countries have a photo. ${missing.length} do not (they show a gradient with the flag).`,
    '',
    '| Country | Source | What the photo shows | Photographer | Link |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    missing.length ? `Without a photo: ${missing.join(', ')}` : 'Every country has a photo.',
    '',
  ].join('\n')
  await writeFile(file, text, 'utf8')
}

class RateLimited extends Error {}
class BadKey extends Error {}

/** Shared scoring: prefer landscape-shaped, high-resolution, scenic photos with no people. */
function score(candidate, index, country) {
  if (!candidate.raw) return -Infinity
  const { width, height, text, likes } = candidate
  if (!(width >= 2400 && width / height >= 1.35 && width / height <= 2.2)) return -Infinity
  if (PEOPLE.test(text) || NOT_SCENERY.test(text)) return -Infinity
  let s = 100 - index * 2 // photo sites list the most relevant first
  if (SCENERY.test(text)) s += 12
  const lower = text.toLowerCase()
  if (lower.includes(country.name.toLowerCase()) || (country.capital && lower.includes(country.capital.toLowerCase()))) s += 6
  s += Math.min(likes || 0, 2000) / 400
  return s
}

function pickBest(candidates, country) {
  let best = null
  candidates.forEach((candidate, i) => {
    const s = score(candidate, i, country)
    if (s > (best?.score ?? -Infinity)) best = { candidate, score: s }
  })
  return best?.candidate ?? null
}

/** The search queries to try, best first. Each one costs an API request. */
function queriesFor(country) {
  const base = QUERY_NAME[country.code] || country.name
  const list = [`${base} travel landmark`]
  if (country.capital && !base.includes(country.capital)) list.push(`${country.capital} ${country.name} skyline`)
  list.push(`${base} landscape`)
  return list
}

async function request(provider, url, headers) {
  // The key is only ever sent to that provider's own API address, never anywhere else.
  if (new URL(url).origin !== new URL(provider.api).origin) throw new Error(`Refusing to send a key to ${new URL(url).origin}`)
  if (provider.delay) await sleep(provider.delay)
  const res = await fetch(url, { headers })
  // Unsplash caches search answers for 24 hours, and a cached answer still carries the quota number from the
  // moment it was first made (for example "2 left" at the end of an earlier run). That number is out of date and
  // such an answer used no quota, so only a fresh answer may tell how many requests are really left.
  const cached = Number(res.headers.get('age') || 0) > 0 || /\bhit\b/i.test(res.headers.get('x-cache') || '')
  const left = res.headers.get('x-ratelimit-remaining')
  if (!cached && left !== null && left !== '') provider.remaining = Number(left)
  if (res.status === 401) throw new BadKey(`${provider.label} rejected the key (401).`)
  if (res.status === 403 || res.status === 429) throw new RateLimited(`${provider.label} says the request limit is used up.`)
  if (!res.ok) throw new Error(`${provider.label} answered HTTP ${res.status}`)
  return res.json()
}

function createUnsplash(key, delay) {
  const provider = {
    id: 'unsplash',
    label: 'Unsplash',
    api: UNSPLASH_API,
    delay,
    remaining: null,
    /** Requests one country costs at most: the search plus the download report. */
    cost: 2,
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
    async search(query) {
      const params = new URLSearchParams({
        query,
        orientation: 'landscape',
        per_page: '20',
        content_filter: 'high',
        order_by: 'relevant',
      })
      const data = await request(provider, `${UNSPLASH_API}/search/photos?${params}`, provider.headers)
      return (data.results || [])
        .filter((p) => p?.urls?.raw && p.user)
        .map((p) => ({
          raw: p.urls.raw,
          width: p.width,
          height: p.height,
          likes: p.likes,
          text: [p.alt_description, p.description, ...(p.tags || []).map((t) => t?.title)].filter(Boolean).join(' '),
          photo: p,
        }))
    },
    // Unsplash asks to be told when a photo is used: this is that report.
    async confirm(candidate) {
      const location = candidate.photo.links?.download_location
      if (location) await request(provider, location, provider.headers)
    },
    toRecord(candidate, countryName) {
      const p = candidate.photo
      return {
        source: 'unsplash',
        raw: p.urls.raw,
        alt: p.alt_description || p.description || `${countryName} landscape`,
        color: p.color || null,
        width: p.width,
        height: p.height,
        photographer: p.user.name || p.user.username,
        photographerUrl: p.user.links?.html || `https://unsplash.com/@${p.user.username}`,
        photoUrl: p.links?.html || `https://unsplash.com/photos/${p.id}`,
      }
    },
  }
  return provider
}

function createPexels(key, delay) {
  const provider = {
    id: 'pexels',
    label: 'Pexels',
    api: PEXELS_API,
    delay,
    remaining: null,
    cost: 1,
    headers: { Authorization: key },
    async search(query) {
      const params = new URLSearchParams({ query, orientation: 'landscape', size: 'large', per_page: '20' })
      const data = await request(provider, `${PEXELS_API}/v1/search?${params}`, provider.headers)
      return (data.photos || [])
        .filter((p) => p?.src?.original && p.photographer)
        .map((p) => ({
          raw: p.src.original,
          width: p.width,
          height: p.height,
          likes: 0,
          text: p.alt || '',
          photo: p,
        }))
    },
    async confirm() {},
    toRecord(candidate, countryName) {
      const p = candidate.photo
      return {
        source: 'pexels',
        raw: p.src.original,
        alt: p.alt || `${countryName} landscape`,
        color: p.avg_color || null,
        width: p.width,
        height: p.height,
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        photoUrl: p.url,
      }
    },
  }
  return provider
}

async function findPhoto(provider, country) {
  for (const query of queriesFor(country)) {
    if (provider.remaining !== null && provider.remaining < provider.cost) throw new RateLimited(`${provider.label}: no requests left.`)
    const candidates = await provider.search(query)
    const best = pickBest(candidates, country)
    if (best) return best
  }
  return null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('See the comment at the top of scripts/fetch-country-images.mjs for what the options do.')
    return
  }

  const keys = await readKeys()
  console.log(`UNSPLASH_ACCESS_KEY: ${keys.unsplash ? 'found' : 'missing'} · PEXELS_API_KEY: ${keys.pexels ? 'found' : 'missing'}`)

  const chain = []
  if (args.source !== 'pexels' && keys.unsplash) chain.push(createUnsplash(keys.unsplash, args.delay))
  if (args.source !== 'unsplash' && keys.pexels) chain.push(createPexels(keys.pexels, args.delay))
  if (chain.length === 0) {
    console.log('\nNo usable photo key, so no photos were fetched.')
    console.log('Nothing is broken: the site shows a navy-and-amber gradient with the country flag instead of a photo.')
    console.log('To add photos: create a free app at https://unsplash.com/developers, copy its "Access Key",')
    console.log('add a line  UNSPLASH_ACCESS_KEY=your-key  to .env.local, then run  npm run images  again.')
    console.log('(Optional fallback: a free Pexels key from https://www.pexels.com/api/ as  PEXELS_API_KEY=your-key .)')
    return
  }

  const countries = await loadCountries(args.countriesFile)
  const data = await loadExisting(args.out)
  const wanted = countries.filter((c) => (args.only ? args.only.includes(c.code) : true))
  const todo = wanted
    .filter((c) => args.refresh || (!data.images[c.code] && !data.noPhoto.includes(c.code)))
    .slice(0, args.limit)
  console.log(`${wanted.length} countries in scope, ${wanted.length - todo.length} already done or skipped, ${todo.length} to fetch.`)
  console.log(`Using: ${chain.map((p) => p.label).join(' first, then ')}. Pausing ${args.delay} ms between requests.`)
  if (args.dryRun) {
    console.log(todo.map((c) => `${c.code} ${c.name}`).join('\n'))
    return
  }

  let current = 0
  let added = 0
  const noPhoto = []
  let stoppedEarly = false

  for (let i = 0; i < todo.length; i += 1) {
    const country = todo[i]
    const provider = chain[current]
    if (!provider) break
    try {
      const best = await findPhoto(provider, country)
      if (!best) {
        noPhoto.push(country.code)
        if (!data.noPhoto.includes(country.code)) data.noPhoto.push(country.code)
        await save(args.out, data)
        console.log(`  --  ${country.code} ${country.name}: no suitable photo found`)
        continue
      }
      await provider.confirm(best)
      data.images[country.code] = provider.toRecord(best, country.name)
      data.noPhoto = data.noPhoto.filter((code) => code !== country.code)
      added += 1
      await save(args.out, data) // saved after every country, so nothing is lost if it stops
      console.log(`  ok  ${country.code} ${country.name}: photo by ${data.images[country.code].photographer} (${provider.label})`)
    } catch (error) {
      if (error instanceof BadKey) {
        console.log(`  !!  ${error.message} Check the key in .env.local.`)
        chain.splice(current, 1)
        if (chain.length === 0) {
          process.exitCode = 1
          break
        }
        console.log(`  >>  Continuing with ${chain[current].label}.`)
        i -= 1 // try this country again with the next source
        continue
      }
      if (error instanceof RateLimited) {
        if (current + 1 < chain.length) {
          console.log(`  >>  ${error.message} Continuing with ${chain[current + 1].label}.`)
          current += 1
          i -= 1
          continue
        }
        if (args.wait) {
          console.log(`  ..  ${error.message} Waiting ${args.waitMinutes} minutes for the limit to reset (Ctrl+C to stop; run again to resume).`)
          await sleep(args.waitMinutes * 60 * 1000)
          provider.remaining = null
          i -= 1
          continue
        }
        stoppedEarly = true
        break
      }
      console.log(`  !!  ${country.code} ${country.name}: ${error.message}`)
    }
  }

  await writeReview(args.review, countries, data)
  const left = wanted.filter((c) => !data.images[c.code] && !data.noPhoto.includes(c.code)).length
  console.log(`\nDone: ${added} photo(s) added. ${Object.keys(data.images).length} countries now have a photo.`)
  if (noPhoto.length) console.log(`No suitable photo for: ${noPhoto.join(', ')} (they use the gradient fallback).`)
  if (stoppedEarly) {
    console.log(`Stopped because the hourly limit is used up. ${left} countries still need a photo.`)
    console.log('Run  npm run images  again in about an hour (or use  npm run images -- --wait ): it continues where it stopped.')
  } else if (left > 0) {
    console.log(`${left} countries still have no photo. Run the command again to continue.`)
  }
  console.log(`Please skim ${path.relative(ROOT, args.review)} once and check any photo that looks wrong.`)
}

main().catch((error) => {
  console.error(`Stopped: ${error.message}`)
  process.exitCode = 1
})
