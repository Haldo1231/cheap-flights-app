// Country photos (from Unsplash) and the helpers that show them.
// Safe to use in both server and browser code: it holds no photo data itself.
// The photo list lives in data/country-images.json and is read on the server
// only (see countryImagesData.ts), so it never bloats the browser download.

export type PhotoSource = 'unsplash' | 'pexels'

export type CountryImage = {
  /** Which photo site the picture comes from (decides the credit text and links). */
  source: PhotoSource
  /** Original photo address on the photo site's image server (kept exactly as the API gave it). */
  raw: string
  alt: string
  /** Dominant colour of the photo, shown while the picture loads. */
  color: string | null
  width: number
  height: number
  photographer: string
  /** The photographer's profile page on the photo site (no tracking parameters; added when shown). */
  photographerUrl: string
  /** The photo's own page on the photo site. */
  photoUrl: string
}

export const PHOTO_SITES: Record<PhotoSource, { name: string; home: string; imageHost: string; pageHost: string }> = {
  unsplash: { name: 'Unsplash', home: 'https://unsplash.com/', imageHost: 'images.unsplash.com', pageHost: 'https://unsplash.com/' },
  pexels: { name: 'Pexels', home: 'https://www.pexels.com/', imageHost: 'images.pexels.com', pageHost: 'https://www.pexels.com/' },
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

/** A credit link for the photo site: Unsplash wants the referral parameters, Pexels a plain link. */
export function creditLink(source: PhotoSource, url: string): string {
  return source === 'unsplash' ? withUnsplashUtm(url) : url
}

/** next/image loader: asks the photo site's own image server for the size we need.
 * Unsplash requires its photos to be loaded straight from its servers
 * (hotlinking) and this also keeps them out of Vercel's image quota. The
 * `ixid` part of an Unsplash address stays in place: it is how Unsplash counts views. */
export function photoLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  try {
    const u = new URL(src)
    if (u.hostname === PHOTO_SITES.unsplash.imageHost) {
      u.searchParams.set('w', String(width))
      u.searchParams.set('q', String(quality ?? 75))
      u.searchParams.set('fit', 'max')
      u.searchParams.set('auto', 'format')
      return u.toString()
    }
    if (u.hostname === PHOTO_SITES.pexels.imageHost) {
      u.searchParams.set('auto', 'compress')
      u.searchParams.set('cs', 'tinysrgb')
      u.searchParams.set('w', String(width))
      return u.toString()
    }
    return src
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
