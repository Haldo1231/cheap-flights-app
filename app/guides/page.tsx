import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '../components/PageHero'
import GuideCard from '../components/content/GuideCard'
import { getGuides } from '../lib/content/load'
import { pageMetadata } from '../lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Guides',
  description: 'Guides to help you choose where to fly from and where to go, based on the prices we see.',
  path: '/guides',
})

export default function GuidesPage() {
  const guides = getGuides()

  return (
    <div>
      <PageHero eyebrow="Guides" title="Where to fly, and from where">
        <p>Guides that help you choose, based on the cached prices we see.</p>
      </PageHero>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {guides.length === 0 ? (
          <div className="surface px-5 py-10 text-center sm:px-8">
            <h2 className="text-xl font-semibold">First guides coming soon</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate">Guides will show up here. Meanwhile, the Anywhere search shows the cheapest places to go right now.</p>
            <Link href="/anywhere" className="btn btn-primary mt-5">
              Where can I fly cheaply?
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {guides.map((guide, i) => (
              <GuideCard key={guide.slug} guide={guide} eager={i < 2} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
