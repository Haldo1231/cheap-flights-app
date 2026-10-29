import Link from 'next/link'
import type { Trip } from '../../lib/content/schema'
import { tripCosts } from '../../lib/content/costs'
import ContentImage from './ContentImage'
import { PlaneIcon } from '../Icons'

/** One trip report in a grid: cover photo, title, country, nights and the real total cost. */
export default function TripCard({ trip, eager = false }: { trip: Trip; eager?: boolean }) {
  const { total } = tripCosts(trip)
  return (
    <li className="group relative transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:transform-none">
      <Link
        href={`/trips/${trip.slug}`}
        lang={trip.language}
        className="surface flex h-full flex-col overflow-hidden transition-shadow duration-300 group-hover:shadow-lift"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-deep">
          {trip.cover ? (
            <ContentImage
              kind="trips"
              slug={trip.slug}
              src={trip.cover.src}
              alt={trip.cover.alt}
              sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
              eager={eager}
              className="transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <div className="hero-surface flex h-full w-full items-center justify-center text-amber" aria-hidden="true">
              <PlaneIcon className="h-12 w-12 opacity-80" />
            </div>
          )}
          {trip.draft && (
            <span className="absolute left-3 top-3 rounded-full bg-danger-bg px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-danger ring-1 ring-danger-line">
              Draft, development only
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="font-mono text-xs uppercase tracking-wide text-slate">
            {trip.country} · {trip.nights} night{trip.nights === 1 ? '' : 's'} · {trip.travellers}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{trip.title}</h2>
          <p className="mt-auto pt-3">
            <span className="num text-2xl font-semibold text-ink underline decoration-amber decoration-[3px] underline-offset-[6px]">€{total}</span>
            <span className="ml-2 text-xs text-slate">total per person, all in</span>
          </p>
        </div>
      </Link>
    </li>
  )
}
