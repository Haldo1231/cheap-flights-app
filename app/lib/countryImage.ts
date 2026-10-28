// Country photos (from Unsplash) and the helpers that show them.
// Safe to use in both server and browser code: it holds no photo data itself.
// The photo list lives in data/country-images.json and is read on the server
// only (see countryImagesData.ts), so it never bloats the browser download.

export type CountryImage = {
  /** Original photo address on Unsplash's image server (kept exactly as the API gave it). */
  raw: string
  alt: string
  /** Dominant colour of the photo, shown while the picture loads. */
  color: string | null
  width: number
  height: number
  photographer: string
  /** The photographer's Unsplash profile page (no tracking parameters; added when shown). */
  photographerUrl: string
  /** The photo's own page on Unsplash. */
  photoUrl: string
}

/** The name Unsplash asks us to put in credit links (?utm_source=...). */
export const UNSPLASH_APP_NAME = 'cheapflights'

export const UNSPLASH_HOME = 'https://unsplash.com/'

/** A link to Unsplash with the referral parameters its guidelines ask for. */
export function withUnsplashUtm(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('utm_source', UNSPLASH_APP_NAME)
    u.searchParams.set('utm_medium', 'referral')
    return u.toString()
  } catch {
    return url
  }
}

const UNSPLASH_IMAGE_HOST = 'images.unsplash.com'

/** next/image loader: asks Unsplash's own image server for the size we need.
 * Unsplash requires its photos to be loaded straight from its servers
 * (hotlinking) and this also keeps them out of Vercel's image quota. The
 * `ixid` part of the address stays in place: it is how Unsplash counts views. */
export function unsplashLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  try {
    const u = new URL(src)
    if (u.hostname !== UNSPLASH_IMAGE_HOST) return src
    u.searchParams.set('w', String(width))
    u.searchParams.set('q', String(quality ?? 75))
    u.searchParams.set('fit', 'max')
    u.searchParams.set('auto', 'format')
    return u.toString()
  } catch {
    return src
  }
}

/** The flag emoji for a 2-letter country code ("IT" -> the Italian flag), or "" if it is not one. */
export function countryFlag(code: string): string {
  const c = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(...Array.from(c, (ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}
