// One place that builds the page titles and the "link preview" tags (Open Graph and Twitter
// cards), so every page looks right when its link is pasted somewhere.

import type { Metadata } from 'next'
import { ogImagePath, type OgCard } from './ogCard'

type Input = {
  /** Page title; the site name is added by the layout. */
  title: string
  description: string
  /** Path of the page, e.g. "/deals" (used as the preview's address). */
  path?: string
  /** A signed picture card for the preview; without it the plain brand picture is used. */
  card?: OgCard | null
  /** Title shown in the preview when it should differ from the page title. */
  previewTitle?: string
  noindex?: boolean
  /** A ready-made preview picture (for example a cover photo); used instead of the signed card. */
  image?: { url: string; alt: string }
  /** "article" for trip reports and guides. */
  type?: 'website' | 'article'
  /** Article dates (YYYY-MM-DD). */
  publishedTime?: string
}

// Google cuts a result's title at roughly 60 characters. When the page's own title plus
// " — cheapflights" would be longer, the site name is left off so the words that matter stay visible.
const TITLE_LIMIT = 60
const SUFFIX = ' — cheapflights'

/** Google Search Console's ownership tag, only when GOOGLE_SITE_VERIFICATION is set. */
export function siteVerification(): Metadata['verification'] | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim()
  return google ? { google } : undefined
}

export function pageMetadata({ title, description, path, card, previewTitle, noindex, image: given, type = 'website', publishedTime }: Input): Metadata {
  const image = given ? { url: given.url, alt: given.alt } : { url: ogImagePath(card ?? null), width: 1200, height: 630, alt: previewTitle ?? title }
  const shown = `${previewTitle ?? title}${SUFFIX}`
  return {
    title: title.length + SUFFIX.length > TITLE_LIMIT ? { absolute: title } : title,
    description,
    ...(noindex ? { robots: { index: false } } : {}),
    // The canonical address tells search engines which one address is "the" page.
    ...(path && !noindex ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type,
      siteName: 'cheapflights',
      title: shown,
      description,
      ...(path ? { url: path } : {}),
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: shown, description, images: [image.url] },
  }
}
