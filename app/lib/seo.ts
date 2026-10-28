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
}

export function pageMetadata({ title, description, path, card, previewTitle, noindex }: Input): Metadata {
  const image = { url: ogImagePath(card ?? null), width: 1200, height: 630, alt: previewTitle ?? title }
  const shown = `${previewTitle ?? title} — cheapflights`
  return {
    title,
    description,
    ...(noindex ? { robots: { index: false } } : {}),
    openGraph: { type: 'website', siteName: 'cheapflights', title: shown, description, ...(path ? { url: path } : {}), images: [image] },
    twitter: { card: 'summary_large_image', title: shown, description, images: [image.url] },
  }
}
