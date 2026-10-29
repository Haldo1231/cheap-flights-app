import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Breadcrumbs from '../../components/Breadcrumbs'
import ArticleBody from '../../components/content/ArticleBody'
import ContentImage from '../../components/content/ContentImage'
import JsonLd from '../../components/content/JsonLd'
import RelatedDestinations from '../../components/content/RelatedDestinations'
import { longDate } from '../../lib/content/costs'
import { getGuide, getGuides } from '../../lib/content/load'
import { articleJsonLd, breadcrumbJsonLd } from '../../lib/content/seo'
import { pageMetadata } from '../../lib/seo'

// Guide files are read at build time; the prices in "related destinations" refresh about hourly.
export const revalidate = 3600
export const dynamicParams = false

type Params = Promise<{ slug: string }>

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) return { title: 'Guide not found' }
  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}`,
    type: 'article',
    publishedTime: guide.date,
    ...(guide.cover
      ? { image: { url: `/guides/${guide.slug}/${guide.cover.src}`, alt: guide.cover.alt } }
      : { card: { title: guide.title, eyebrow: 'Guide', price: null, note: '', line: guide.tags.slice(0, 3).join(' · '), cc: '' } }),
    noindex: guide.draft,
  })
}

export default async function GuidePage({ params }: { params: Params }) {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) notFound()
  const path = `/guides/${guide.slug}`

  return (
    <article lang={guide.language} className="mx-auto max-w-3xl px-4 py-8 pb-16 sm:px-6">
      <JsonLd
        data={articleJsonLd({
          title: guide.title,
          description: guide.description,
          path,
          date: guide.date,
          language: guide.language,
          imageUrl: guide.cover ? `/guides/${guide.slug}/${guide.cover.src}` : undefined,
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: guide.title, path }])} />

      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Guides', href: '/guides' }, { label: guide.title }]} />

      {guide.draft && (
        <p role="note" className="mb-4 rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-sm text-danger">
          Draft: this page only shows while you run the site on your own computer. It is hidden on the live site.
        </p>
      )}

      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wide text-slate">{longDate(guide.date)}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">{guide.title}</h1>
        <p className="mt-3 text-lg text-slate">{guide.description}</p>
        {guide.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
            {guide.tags.map((tag) => (
              <li key={tag} className="rounded-full border border-line bg-paper px-2.5 py-0.5 font-mono text-[11px] text-slate">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      {guide.cover && (
        <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-lg border border-line bg-sand">
          <ContentImage kind="guides" slug={guide.slug} src={guide.cover.src} alt={guide.cover.alt} sizes="(min-width: 768px) 720px, 100vw" eager />
        </div>
      )}

      {guide.body && <ArticleBody markdown={guide.body} lang={guide.language} />}

      <RelatedDestinations slugs={guide.relatedDestinations} />

      <p className="mt-10 text-sm text-slate">
        Prices on this site are cached and can differ on the booking sites. See{' '}
        <Link href="/disclosure" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          how we earn money
        </Link>
        .
      </p>
    </article>
  )
}
