import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Breadcrumbs from '../../components/Breadcrumbs'
import ArticleBody from '../../components/content/ArticleBody'
import CompareBox from '../../components/content/CompareBox'
import ContentImage from '../../components/content/ContentImage'
import JsonLd from '../../components/content/JsonLd'
import PhotoGallery from '../../components/content/PhotoGallery'
import TripFacts from '../../components/content/TripFacts'
import { AIRPORTS } from '../../airportsList'
import { DESTINATIONS } from '../../destinationsList'
import { supabase } from '../../supabase'
import { compareWithEstimate, longDate, tripCosts, type EstimateInfo } from '../../lib/content/costs'
import { getTrip, getTrips } from '../../lib/content/load'
import { articleJsonLd, breadcrumbJsonLd } from '../../lib/content/seo'
import { pageMetadata } from '../../lib/seo'

// Trip files are read at build time; the destination estimate is refreshed about hourly.
export const revalidate = 3600
export const dynamicParams = false

type Params = Promise<{ slug: string }>

export function generateStaticParams() {
  return getTrips().map((t) => ({ slug: t.slug }))
}

function describe(trip: NonNullable<ReturnType<typeof getTrip>>): string {
  if (trip.description) return trip.description
  const origin = AIRPORTS.find((a) => a.code === trip.origin)?.city ?? trip.origin
  return `${trip.nights} nights in ${trip.country}, flying from ${origin}: what the flights, the stay and the food really cost. €${tripCosts(trip).total} per person in total.`
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const trip = getTrip(slug)
  if (!trip) return { title: 'Trip not found' }
  const costs = tripCosts(trip)
  return pageMetadata({
    title: trip.title,
    description: describe(trip),
    path: `/trips/${trip.slug}`,
    type: 'article',
    publishedTime: trip.date,
    // The cover photo is the preview picture; without one a card with the real total is drawn.
    ...(trip.cover
      ? { image: { url: `/trips/${trip.slug}/${trip.cover.src}`, alt: trip.cover.alt } }
      : {
          card: { title: trip.title, eyebrow: 'Trip report', price: costs.total, note: 'per person, all in', line: `${trip.nights} nights in ${trip.country}`, cc: '' },
        }),
    noindex: trip.draft,
  })
}

/** Our estimate for the destination, or null when it is not linked or not available. */
async function estimateFor(slug: string | undefined): Promise<EstimateInfo | null> {
  if (!slug) return null
  try {
    const { data } = await supabase
      .from('destinations')
      .select('hostel_avg_price, food_avg_price, transport_avg_price, other_avg_price')
      .eq('slug', slug)
      .maybeSingle()
    return (data as EstimateInfo | null) ?? null
  } catch {
    return null
  }
}

export default async function TripPage({ params }: { params: Params }) {
  const { slug } = await params
  const trip = getTrip(slug)
  if (!trip) notFound()

  const destination = trip.destination ? DESTINATIONS.find((d) => d.slug === trip.destination) : undefined
  const estimate = await estimateFor(trip.destination)
  const { rows, day } = compareWithEstimate(trip, estimate)
  const path = `/trips/${trip.slug}`

  return (
    <article lang={trip.language} className="mx-auto max-w-5xl px-4 py-8 pb-16 sm:px-6">
      <JsonLd
        data={articleJsonLd({
          title: trip.title,
          description: describe(trip),
          path,
          date: trip.date,
          language: trip.language,
          imageUrl: trip.cover ? `/trips/${trip.slug}/${trip.cover.src}` : undefined,
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Trips', path: '/trips' }, { name: trip.title, path }])} />

      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Trips', href: '/trips' }, { label: trip.title }]} />

      {trip.draft && (
        <p role="note" className="mb-4 rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-sm text-danger">
          Draft: this page only shows while you run the site on your own computer. It is hidden on the live site.
        </p>
      )}

      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wide text-slate">
          {longDate(trip.date)} · {trip.country} · {trip.nights} night{trip.nights === 1 ? '' : 's'} · {trip.travellers}
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">{trip.title}</h1>
      </header>

      {trip.cover && (
        <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-lg border border-line bg-sand">
          <ContentImage kind="trips" slug={trip.slug} src={trip.cover.src} alt={trip.cover.alt} sizes="(min-width: 1024px) 960px, 100vw" eager />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 lg:order-1">
          {trip.body && <ArticleBody markdown={trip.body} lang={trip.language} />}

          {trip.tips.length > 0 && (
            <section aria-labelledby="tips" className="mt-10 rounded-lg border border-line bg-amber-soft p-4 sm:p-5">
              <h2 id="tips" className="h-section mb-2">
                Tips
              </h2>
              <ul className="list-disc space-y-1.5 pl-5">
                {trip.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          )}

          {trip.mistakes.length > 0 && (
            <section aria-labelledby="mistakes" className="mt-6 surface p-4 sm:p-5">
              <h2 id="mistakes" className="h-section mb-2">
                What I&apos;d do differently
              </h2>
              <ul className="list-disc space-y-1.5 pl-5">
                {trip.mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
          )}

          <PhotoGallery kind="trips" slug={trip.slug} photos={trip.photos} />

          {destination && <CompareBox destinationName={destination.name} destinationHref={`/destinations/${destination.slug}`} rows={rows} day={day} />}

          <section aria-labelledby="next" className="hero-surface mt-12 rounded-lg p-5 text-white sm:p-8">
            <h2 id="next" className="text-2xl font-semibold tracking-tight">
              {destination ? `Going to ${destination.name}?` : 'Want to plan your own trip?'}
            </h2>
            <p className="mt-1 text-white/75">Prices are cached and can differ on the booking sites. Check the final price before you book.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={destination ? `/search?to=${destination.code}` : '/search'} className="btn btn-amber btn-lg">
                {destination ? `Search flights to ${destination.name}` : 'Search flights'}
              </Link>
              {destination && (
                <Link href={`/destinations/${destination.slug}`} className="btn btn-outline-light btn-lg">
                  See the {destination.name} page
                </Link>
              )}
            </div>
          </section>
        </div>

        <div className="lg:order-2">
          <div className="lg:sticky lg:top-6">
            <TripFacts trip={trip} />
          </div>
        </div>
      </div>
    </article>
  )
}
