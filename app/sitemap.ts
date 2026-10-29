import type { MetadataRoute } from 'next'
import { DESTINATIONS } from './destinationsList'
import { getGuides, getTrips } from './lib/content/load'
import { absoluteUrl } from './lib/site'

// The list of pages for search engines. Trip reports and guides are included only when they are
// published (getTrips/getGuides leave drafts out in production builds). The About page is left
// out while it still has TODO text. Search results and trip detail pages are not listed on purpose.
export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ['/', '/search', '/anywhere', '/deals', '/trips', '/guides', '/disclosure'].map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: 'weekly' as const,
    priority: path === '/' ? 1 : 0.7,
  }))

  const destinations = DESTINATIONS.map((d) => ({
    url: absoluteUrl(`/destinations/${d.slug}`),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }))

  const trips = getTrips().map((t) => ({
    url: absoluteUrl(`/trips/${t.slug}`),
    lastModified: t.date,
    changeFrequency: 'yearly' as const,
    priority: 0.8,
  }))

  const guides = getGuides().map((g) => ({
    url: absoluteUrl(`/guides/${g.slug}`),
    lastModified: g.date,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...fixed, ...destinations, ...trips, ...guides]
}
