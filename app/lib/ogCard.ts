// The picture shown when a link to this site is pasted into WhatsApp, Discord, Instagram
// DMs and so on ("Open Graph" image). The picture is drawn by /api/og from a few short
// values in its address. To stop anyone typing their own words or prices into that
// address (the picture would carry OUR name), the server signs the values it puts there
// and /api/og refuses anything that is not signed. Server code only.

import { createHmac, timingSafeEqual } from 'node:crypto'

export type OgCard = {
  /** Big line: the country or city. */
  title: string
  /** Small line above it, e.g. "From Vienna +2". */
  eyebrow: string
  /** Price in euro, or null when the card has none. */
  price: number | null
  /** Under the price, e.g. "round trip · both flights". */
  note: string
  /** The line under the title, e.g. "Thu 12 Nov → Tue 17 Nov". */
  line: string
  /** Two-letter country code (for the flag and the country photo), or "". */
  cc: string
}

const MAX = 70

function clean(value: string): string {
  // Plain text only, short, no control characters.
  return value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX)
}

/** The key that signs cards. It is derived from a secret the site already has, with its own
 * label, so the signature cannot be reused for anything else. Without a secret, nothing is
 * signed in production and the plain brand picture is used instead. */
function key(): string | null {
  const secret = process.env.OG_SECRET || process.env.CRON_SECRET
  if (secret) return `og-card-v1:${secret}`
  return process.env.NODE_ENV === 'production' ? null : 'og-card-v1:local-dev-only'
}

function sign(card: OgCard, k: string): string {
  const text = [card.title, card.eyebrow, card.price ?? '', card.note, card.line, card.cc].join('|')
  return createHmac('sha256', k).update(text).digest('hex').slice(0, 32)
}

/** The address of the picture for a card, or the plain brand picture when it cannot be signed. */
export function ogImagePath(card: OgCard | null): string {
  const k = key()
  if (!card || !k) return '/api/og'
  const c: OgCard = {
    title: clean(card.title),
    eyebrow: clean(card.eyebrow),
    price: card.price !== null && Number.isFinite(card.price) ? Math.max(0, Math.min(99999, Math.round(card.price))) : null,
    note: clean(card.note),
    line: clean(card.line),
    cc: /^[A-Za-z]{2}$/.test(card.cc) ? card.cc.toUpperCase() : '',
  }
  const q = new URLSearchParams({ t: c.title, e: c.eyebrow, p: c.price === null ? '' : String(c.price), n: c.note, l: c.line, c: c.cc })
  q.set('s', sign(c, k))
  return `/api/og?${q.toString()}`
}

/** Reads a card back from an address; null when it is missing, edited or not signed by us. */
export function readOgCard(params: URLSearchParams): OgCard | null {
  const k = key()
  const given = params.get('s')
  if (!k || !given || !params.get('t')) return null
  const price = params.get('p')
  const card: OgCard = {
    title: clean(params.get('t') || ''),
    eyebrow: clean(params.get('e') || ''),
    price: price ? Number(price) : null,
    note: clean(params.get('n') || ''),
    line: clean(params.get('l') || ''),
    cc: params.get('c') || '',
  }
  const expected = Buffer.from(sign(card, k))
  const actual = Buffer.from(given)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  return card
}
