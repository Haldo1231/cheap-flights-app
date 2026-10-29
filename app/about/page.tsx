import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '../components/PageHero'
import { pageMetadata } from '../lib/seo'

// While any TODO below is still unwritten the page is kept out of search engines.
// When the personal text is written, delete the TODO box and set this to false.
const HAS_TODO = true

export const metadata: Metadata = pageMetadata({
  title: 'About',
  description: 'Who builds cheapflights, why, and how the prices on the site work.',
  path: '/about',
  noindex: HAS_TODO,
})

/** A clearly marked gap for text only the site's owner can write. */
function Todo({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="rounded-sm border-2 border-dashed border-amber bg-amber-soft px-4 py-3 text-sm">
      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-amber-ink">TODO (to be written by the site owner)</p>
      <p className="mt-1 text-ink">{children}</p>
    </div>
  )
}

export default function AboutPage() {
  return (
    <div>
      <PageHero eyebrow="About" title="About cheapflights">
        <p>Who builds this site, why, and how the prices work.</p>
      </PageHero>

      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
        <section aria-labelledby="who">
          <h2 id="who" className="h-section mb-3">
            Who builds this site
          </h2>
          <Todo>A few honest sentences about you: your name (or the name you want to use), where you travel from and what you do. Write it in your own words.</Todo>
        </section>

        <section aria-labelledby="why">
          <h2 id="why" className="h-section mb-3">
            Why it exists
          </h2>
          <Todo>Why you built it, for example what annoyed you about comparing flights from several airports. One short paragraph is enough.</Todo>
        </section>

        <section aria-labelledby="prices">
          <h2 id="prices" className="h-section mb-3">
            How the prices work
          </h2>
          <div className="article">
            <p>
              The flight prices on this site come from cached data of a flight search partner (Travelpayouts / Aviasales). Cached means the
              price was found by someone searching recently, not at the moment you look. So:
            </p>
            <ul>
              <li>A price can be out of date, and it is always shown as &ldquo;from €X&rdquo;.</li>
              <li>The price on the booking site can be different. Always check the final price there before you pay.</li>
              <li>Small routes can have no cached price at all. When data is missing we say so instead of guessing.</li>
              <li>The stay costs (hostel, food, transport) are rough daily averages, estimates and not quotes.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="money">
          <h2 id="money" className="h-section mb-3">
            How the site earns money
          </h2>
          <p className="article">
            Some links are affiliate links. Read the details on the{' '}
            <Link href="/disclosure" className="font-medium underline decoration-amber decoration-2 underline-offset-4">
              affiliate disclosure page
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="contact">
          <h2 id="contact" className="h-section mb-3">
            Contact
          </h2>
          <Todo>How people can reach you (an email address you are happy to publish). Leave this out if you prefer not to be contacted.</Todo>
        </section>
      </div>
    </div>
  )
}
