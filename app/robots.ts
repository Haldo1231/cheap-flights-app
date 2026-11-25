import type { MetadataRoute } from 'next'
import { absoluteUrl } from './lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', // /results, /trip and /back are NOT blocked here: they carry a noindex tag, and a search
    // engine can only see that tag on a page it is allowed to fetch.
    disallow: ['/api/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
