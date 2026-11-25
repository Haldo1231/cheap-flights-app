import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '../components/PageHero'
import OwnerTodo from '../components/OwnerTodo'
import { pageMetadata } from '../lib/seo'

// Written from what the code really does (Nov 2026). When a feature that touches personal data changes, change this page with it.
export const metadata: Metadata = pageMetadata({
  title: 'Privacy policy',
  description: 'What personal data cheapflights keeps, why, with whom it is shared, how long it is kept and how to have it deleted.',
  path: '/privacy',
})

const UPDATED = '25 Nov 2026'

export default function PrivacyPage() {
  return (
    <div>
      <PageHero eyebrow="Trust" title="Privacy policy">
        <p>What we keep about you, why, and how to have it deleted. In plain words.</p>
      </PageHero>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="article">
          <p className="text-sm text-slate">Last updated: {UPDATED}</p>

          <h2>Who is responsible</h2>
          <p>
            cheapflights is a small site run by one person. The site&rsquo;s owner is responsible for the personal data described here
            (the &ldquo;controller&rdquo; under the EU General Data Protection Regulation, GDPR).
          </p>
          <OwnerTodo>
            Your name (or the name the site is run under), the country you run it from, and an e-mail address for privacy questions and
            deletion requests.
          </OwnerTodo>

          <h2>The short version</h2>
          <ul>
            <li>You can use the whole site without an account. Searching, the calendars and the guides need no sign-in.</li>
            <li>
              If you sign in with Google, we keep your e-mail address, your name and your profile picture address from Google, and the
              routes you save. You can delete all of it yourself at any time.
            </li>
            <li>We count searches and clicks on booking links, without anything that identifies you.</li>
            <li>We do not sell data, we show no ads, and we set no advertising or tracking cookies of our own.</li>
          </ul>

          <h2>If you sign in with Google</h2>
          <p>
            Signing in is optional and only needed to save routes. It works through Google: Google asks you to agree, then tells our
            login provider (Supabase) who you are. From your Google profile we receive and keep:
          </p>
          <ul>
            <li>your e-mail address,</li>
            <li>your name as shown on your Google profile,</li>
            <li>the address of your Google profile picture (shown in the top bar when you are signed in),</li>
            <li>your Google account ID, which Google uses to tell us it is you the next time.</li>
          </ul>
          <p>
            Supabase also keeps the technical details of your sign-ins, such as when you signed in and, for your open sessions, the IP
            address and browser name it saw. We do not use these for anything else.
          </p>
          <p>
            While you are signed in, your browser keeps a sign-in cookie for this site. It is needed for the login to work and is
            removed when you sign out. We never see or keep your Google password.
          </p>
          <p>
            <strong>Why:</strong> to give you an account and keep your saved routes (the contract with you, GDPR Article 6(1)(b)).
          </p>

          <h2>Saved routes</h2>
          <p>
            When you tap the heart, we save the search, not a ticket: the home airport(s), the destination, one way or round trip, how
            you picked the dates and the dates themselves, plus the cheapest price we had for it at that moment and when we saw it. The
            saved routes are linked to your account. Only you can see them; the database refuses anyone else&rsquo;s request for them.
          </p>

          <h2>What we count without knowing who you are</h2>
          <p>We keep our own small counts, so we know which parts of the site are used and which links earn money:</p>
          <ul>
            <li>
              <strong>A search was started:</strong> the date mode (exact dates, date range or whole month), one way or round trip, and
              whether it was an &ldquo;Anywhere&rdquo; search. Not the airports, places or dates you searched.
            </li>
            <li>
              <strong>A booking link was clicked:</strong> which screen it was on, the kind of trip and the home airport it leaves from.
            </li>
          </ul>
          <p>
            Each count is stored with its time only. No IP address, no browser details, no cookie and no account are stored with it,
            so it cannot be linked to you. <strong>Why:</strong> our legitimate interest in knowing how the site is used (GDPR Article
            6(1)(f)).
          </p>
          <p>
            Page views are counted with <strong>Vercel Web Analytics</strong>. It uses no cookies; it counts visits to a page together
            with things like the page address, the site you came from, your country and the type of browser and device.
          </p>

          <h2>Booking links and other sites</h2>
          <p>
            Flight booking links go to Aviasales through the Travelpayouts affiliate network (see the{' '}
            <Link href="/disclosure">affiliate disclosure</Link>). The link says which part of our site it came from, but nothing
            about you. Once you click it, you are on their sites, and their own privacy policies and cookies apply: they need them to
            know that a booking came from us.
          </p>
          <p>
            The country photos are loaded straight from Unsplash or Pexels, and hostel links go to the hostel booking sites. Like any
            website you load something from, those services see your IP address.
          </p>

          <h2>Who handles the data for us</h2>
          <ul>
            <li>
              <strong>Supabase</strong>: our database and login service (accounts, saved routes, the counts above).
            </li>
            <li>
              <strong>Vercel</strong>: hosts the site and runs Web Analytics. Like every web host, it handles the technical details of
              each request, such as your IP address, to deliver the page.
            </li>
            <li>
              <strong>Google</strong>: only if you choose to sign in with Google.
            </li>
          </ul>
          <p>
            These companies may store or process data outside the European Union. They do this under their own data protection terms,
            which include the safeguards the GDPR requires for such transfers.
          </p>

          <h2>How long we keep it</h2>
          <ul>
            <li>Your account and saved routes: until you delete a saved route or your account. Deleting is immediate.</li>
            <li>The anonymous counts: with no end date, because they contain nothing about you.</li>
            <li>The theme you chose (light or dark): only in your own browser, until you clear it.</li>
            <li>
              Our providers&rsquo; technical logs and backups are kept for a limited time under their own rules, and then removed.
            </li>
          </ul>

          <h2>Deleting your data and your other rights</h2>
          <p>
            <strong>Delete it yourself:</strong> sign in, open <Link href="/saved">Saved routes</Link> and use &ldquo;Delete my
            account&rdquo; at the bottom. It deletes your saved routes and your account straight away. To remove a single saved route,
            use its &ldquo;Remove&rdquo; button.
          </p>
          <p>
            You also have the right to see the data we hold about you, to have it corrected, to get a copy of it, to object to its use
            and to have it deleted. Write to the contact address above. You can also complain to a data protection authority, in
            Slovakia the Office for Personal Data Protection of the Slovak Republic (Úrad na ochranu osobných údajov Slovenskej
            republiky), or the one in the country where you live.
          </p>

          <h2>Changes</h2>
          <p>
            If the site starts keeping something new about you, this page changes first, and the date at the top says when it last
            changed. See also the <Link href="/terms">terms of use</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
