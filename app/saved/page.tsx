import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageHero from '../components/PageHero'
import PriceAge from '../components/PriceAge'
import { pageMetadata } from '../lib/seo'
import { AUTH_ENABLED } from '../lib/auth/config'
import { currentUser } from '../lib/auth/server'
import { listSaved } from '../lib/saved/db'
import { priceNow, type PriceNow } from '../lib/saved/price'
import { datesLabel, routeLabel, searchHref, type SavedRow } from '../lib/saved/search'
import { mapWithLimit } from '../lib/pool'
import { formatShortDate } from '../lib/format'
import SignInPanel from './SignInPanel'
import RemoveSaved from './RemoveSaved'
import DeleteAccount from './DeleteAccount'

// Personal page: never in search engines (noindex here, and it is not in app/sitemap.ts).
export const metadata: Metadata = pageMetadata({
  title: 'Saved routes',
  description: 'The routes and dates you saved, with today’s cheapest cached price next to the price when you saved them.',
  noindex: true,
})

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function Change({ then, now }: { then: number; now: number }) {
  const diff = now - then
  const base = 'ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 align-middle text-xs font-medium text-ink'
  if (diff === 0) return <span className={`${base} border-line bg-sand`}>same price</span>
  const cheaper = diff < 0
  return (
    <span className={`${base} ${cheaper ? 'border-ok-line bg-ok-bg' : 'border-danger-line bg-danger-bg'}`}>
      {cheaper ? `−€${-diff} cheaper` : `+€${diff} dearer`}
    </span>
  )
}

function PriceLine({ row, now }: { row: SavedRow; now: PriceNow }) {
  const saved = row.savedPrice
  const when = formatShortDate(row.createdAt.slice(0, 10))
  const thenText = saved !== null ? `€${saved} when you saved it` : `no cached price when you saved it (${when})`

  if (now.kind === 'price') {
    return (
      <div>
        <p className="num text-base">
          <span className="text-slate">{thenText}</span>
          <span aria-hidden="true" className="mx-2 text-slate">→</span>
          <span className="sr-only">, </span>
          <strong className="text-lg font-semibold text-ink">from €{now.price} now</strong>
          {saved !== null && <Change then={saved} now={now.price} />}
        </p>
        <p className="mt-1 text-xs text-slate">
          Saved {when} · today’s price: <PriceAge seenAt={now.seenAt} />
        </p>
      </div>
    )
  }
  const why =
    now.kind === 'past'
      ? 'These dates are over, so there is no price today.'
      : now.kind === 'error'
        ? 'We could not check today’s price just now. Try again in a minute.'
        : 'No cached price for this route and these dates today. Small routes and far-off dates often have none.'
  return (
    <div>
      <p className="num text-base text-slate">{thenText}</p>
      <p className="mt-1 text-sm text-ink">{why}</p>
    </div>
  )
}

export default async function SavedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!AUTH_ENABLED) notFound()
  const query = await searchParams
  const signInFailed = query.signin === 'failed'
  const { client, user } = await currentUser()

  const hero = (
    <PageHero eyebrow="Saved" title="Your saved routes">
      <p>Routes and dates you keep an eye on, with today’s cheapest cached price next to the one you saw.</p>
    </PageHero>
  )

  if (!client || !user) {
    return (
      <div>
        {hero}
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          {query.deleted === '1' && (
            <p role="status" className="mb-6 rounded-sm border border-ok-line bg-ok-bg px-4 py-3 text-sm text-ink">
              Your account and saved routes are deleted.
            </p>
          )}
          <SignInPanel failed={signInFailed} />
        </div>
      </div>
    )
  }

  const { rows, problem } = await listSaved(client)
  const prices = await mapWithLimit(rows, 4, (row) => priceNow(row))

  return (
    <div>
      {hero}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {problem ? (
          <div role="alert" className="surface px-5 py-6">
            <p className="mb-1 font-semibold">{problem === 'missing' ? 'Saved routes are not set up yet' : 'Could not load your saved routes'}</p>
            <p className="text-sm text-slate">
              {problem === 'missing' ? 'This part of the site is still being switched on. Please check back soon.' : 'Please reload the page in a minute.'}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="surface px-5 py-10 text-center sm:px-8">
            <h2 className="text-xl font-semibold">Nothing saved yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate">
              Tap the heart on a search, a city or a route page. We keep the route and the dates, so you can come back and see
              whether the price went down.
            </p>
            <Link href="/search" className="btn btn-primary mt-5">
              Search flights
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate">
              {rows.length} saved {rows.length === 1 ? 'route' : 'routes'}. Prices are cached, so treat them as “from €X”.
            </p>
            <ul className="grid gap-4">
              {rows.map((row, i) => (
                <li key={row.id} className="surface flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">{routeLabel(row)}</p>
                    <p className="mb-3 text-sm text-slate">
                      <span className="font-mono">{row.origins.join(' · ')} → {row.destination}</span> · {datesLabel(row)}
                    </p>
                    <PriceLine row={row} now={prices[i]} />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={searchHref(row)} className="btn btn-primary">
                      Search again
                    </Link>
                    <RemoveSaved id={row.id} label={routeLabel(row)} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {!problem && <DeleteAccount count={rows.length} />}
      </div>
    </div>
  )
}
