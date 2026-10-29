// Structured data (JSON-LD) and metadata pieces shared by trip reports and guides.

import { SITE_NAME, SITE_URL, absoluteUrl } from '../site'

type Crumb = { name: string; path: string }

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  }
}

export function articleJsonLd(input: { title: string; description: string; path: string; date: string; language: string; imageUrl?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.date,
    dateModified: input.date,
    inLanguage: input.language,
    mainEntityOfPage: absoluteUrl(input.path),
    ...(input.imageUrl ? { image: [absoluteUrl(input.imageUrl)] } : {}),
    // The site is written by one person; no personal details are made up here.
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }
}
