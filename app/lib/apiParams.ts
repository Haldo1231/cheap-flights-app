// Cleaning of query parameters for the API routes. Anything that ends up in a
// request to the price provider is checked first, so a hand-edited URL cannot
// add extra parameters, ask for dozens of airports, or crash a route.

import { NextResponse } from 'next/server'

const CODE = /^[A-Z0-9]{2,4}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

export const MAX_ORIGINS = 6

/** One airport/city code, or null if it is not a plain 2-4 letter/digit code. */
export function cleanCode(raw: string | null | undefined): string | null {
  const v = (raw || '').trim().toUpperCase()
  return CODE.test(v) ? v : null
}

/** A comma-separated list of codes: bad entries dropped, duplicates removed, capped. */
export function cleanCodes(raw: string | null | undefined, fallback: string[], max = MAX_ORIGINS): string[] {
  const codes = (raw || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((c) => CODE.test(c))
  const unique = Array.from(new Set(codes)).slice(0, max)
  return unique.length > 0 ? unique : fallback.slice(0, max)
}

export function cleanDate(raw: string | null | undefined): string | null {
  return raw && DATE.test(raw) ? raw : null
}

export function cleanMonth(raw: string | null | undefined): string | null {
  return raw && MONTH.test(raw) ? raw : null
}

/** An integer within [min, max]; the fallback when missing or out of range. */
export function cleanInt(raw: string | null | undefined, fallback: number, min: number, max: number): number {
  const n = parseInt(raw || '', 10)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

/** JSON that browsers and the CDN may keep for a while. The price data behind
 * it is already cached for an hour, so a few minutes more is invisible. */
export function cachedJson<T>(body: T, seconds = 600) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 6}` },
  })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}
