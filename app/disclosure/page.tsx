import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '../components/PageHero'
import { pageMetadata } from '../lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Affiliate disclosure',
  description: 'Some links on cheapflights are affiliate links. We may earn a commission at no extra cost to you.',
  path: '/disclosure',
})

export default function DisclosurePage() {
  return (
    <div>
      <PageHero eyebrow="Trust" title="Affiliate disclosure">
        <p>How this site earns money, in plain words.</p>
      </PageHero>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="article">
          <p>
            <strong>Some links on this site are affiliate links.</strong> If you book through one of them, we may earn a commission, at no
            extra cost to you.
          </p>
          <h2>Which links</h2>
          <ul>
            <li>
              The flight links (&ldquo;Book on Aviasales&rdquo; and similar buttons) go to Aviasales through the Travelpayouts affiliate
              network. They open in a new tab and are marked as sponsored for search engines.
            </li>
            <li>
              Other links, for example to hostels, are normal links today. If that changes, they will be marked as affiliate links and
              this page will say so.
            </li>
          </ul>
          <h2>What it changes</h2>
          <ul>
            <li>The price you pay is the same with or without our link.</li>
            <li>Flights are sorted by price, not by who pays us.</li>
            <li>The prices we show are cached and can differ on the booking site. Always check the final price before you book.</li>
          </ul>
          <p>
            More about the site and how prices work is on the <Link href="/about">About page</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
