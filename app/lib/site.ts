// The site's public address and name, used for canonical links, the sitemap and JSON-LD.
// (The root layout uses the same address for `metadataBase`.)

export const SITE_URL = 'https://cheap-flights-app.vercel.app'
export const SITE_NAME = 'cheapflights'

/** A path ("/trips/rome") as a full address. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}
