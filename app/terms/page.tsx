import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '../components/PageHero'
import OwnerTodo from '../components/OwnerTodo'
import { pageMetadata } from '../lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Terms of use',
  description: 'The simple rules of cheapflights: cached prices that can be out of date, and booking happens with our partners, not with us.',
  path: '/terms',
})

const UPDATED = '25 Nov 2026'

export default function TermsPage() {
  return (
    <div>
      <PageHero eyebrow="Trust" title="Terms of use">
        <p>The few rules of this site, and what it can and cannot promise.</p>
      </PageHero>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="article">
          <p className="text-sm text-slate">Last updated: {UPDATED}</p>

          <h2>What this site is</h2>
          <p>
            cheapflights compares cached flight prices from Bratislava, Vienna, Budapest, Košice and Prague. It is free to use. By
            using it you accept these terms.
          </p>
          <OwnerTodo>Who runs the site (your name or the name the site is run under) and a contact e-mail address.</OwnerTodo>

          <h2>We do not sell tickets</h2>
          <ul>
            <li>We are not an airline, a travel agency or a ticket seller. You cannot buy anything on this site.</li>
            <li>
              A booking link takes you to a partner (Aviasales, through the Travelpayouts network). The booking, the payment, the ticket,
              changes, refunds and customer service are all between you and that partner or the airline, under their terms. We are not
              responsible for them.
            </li>
            <li>
              We may earn a commission when you book through our links, at no extra cost to you (see the{' '}
              <Link href="/disclosure">affiliate disclosure</Link>).
            </li>
          </ul>

          <h2>Prices can be out of date</h2>
          <ul>
            <li>
              The prices come from an outside source (the Travelpayouts data service) and are stored by us. They show what was found
              recently, not a live price, which is why every price says &ldquo;from €X&rdquo; and how old it is.
            </li>
            <li>A fare can be gone or cost more by the time you open the booking site. The price there is the one that counts.</li>
            <li>Airline names, times and stops come from the same data and can be missing or wrong. We do not fill in what is missing.</li>
            <li>The stay costs and budgets are rough estimates, not quotes.</li>
          </ul>
          <p>
            Always check the final price, the dates, the airports and the baggage rules on the booking site before you pay. We cannot
            promise that the information here is complete, correct or always available, and we are not liable for losses that come
            from relying on it, as far as the law allows.
          </p>

          <h2>Accounts</h2>
          <p>
            Signing in (with Google) is optional and only used to save routes. You can delete your account and saved routes at any
            time on the <Link href="/saved">Saved routes</Link> page. We may close an account that is used to misuse the site.
          </p>

          <h2>Fair use</h2>
          <p>
            Please use the site like a person would. Do not try to break it, overload it, or copy its data in bulk with automated tools.
          </p>

          <h2>Changes</h2>
          <p>
            We may change the site and these terms. The date at the top says when they last changed. How we handle personal data is in
            the <Link href="/privacy">privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
