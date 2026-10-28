'use client'

import { useState } from 'react'
import DrillLink from './DrillLink'
import FlightLeg from './FlightLeg'
import CountryPhoto, { PhotoCredit } from './CountryPhoto'
import Flag from './Flag'
import type { AnywhereCountry } from '../tripTypes'

type Props = {
  country: AnywhereCountry
  /** Where the card opens (the country's cities). */
  href: string
  /** Mark this country as the cheapest of the list. */
  cheapest?: boolean
  /** First row: load the picture right away. */
  eager?: boolean
  /** Position in the grid (only used to stagger the entrance). */
  index?: number
}

const PHOTO_SIZES = '(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw'

/** One country as a photo card: picture, name, "from €X", how many destinations,
 * and (under the picture) the cheapest trip that matches the filters. */
export default function CountryCard({ country, href, cheapest = false, eager = false, index = 0 }: Props) {
  const [failed, setFailed] = useState(false)
  const city = country.verifiedCity
  const trip = city?.trip
  const destinations = `${country.candidateCityCount} destination${country.candidateCityCount === 1 ? '' : 's'}`
  const kind = trip?.inbound ? (trip.kind === 'fare' ? 'round trip' : 'out + back') : 'one way'
  const credit = country.image && !failed ? country.image : null

  return (
    <li
      className="group rise-in relative transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:transform-none"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
    >
      <DrillLink
        href={href}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white shadow-sm transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-ink/15"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
          <CountryPhoto code={country.code} image={country.image} failed={failed} onFail={() => setFailed(true)} sizes={PHOTO_SIZES} eager={eager} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          {credit && <Flag code={country.code} size="md" className="absolute left-3 top-3 shadow-md" />}
          {cheapest && (
            <span className="absolute right-3 top-3 rounded-full bg-amber px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink shadow-sm">
              Cheapest
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-xl font-semibold leading-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">{country.name}</h3>
              <p className="text-sm text-white/90">{destinations}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[11px] uppercase tracking-wide text-white/80">from</p>
              <p className="num text-2xl font-semibold leading-none text-amber [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
                €{country.price ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Ticket stub: the trip behind the price. */}
        <div className="flex flex-1 flex-col border-t border-dashed border-faint/70 px-4 pb-8 pt-3">
          {city && trip ? (
            <>
              <p className="mb-1 text-xs text-slate">
                Cheapest match: <span className="font-medium text-ink">{city.name}</span> from {city.origin} · {kind}
              </p>
              <div className="divide-y divide-line">
                <FlightLeg compact label="Out" leg={trip.outbound} price={trip.outbound.price} />
                {trip.inbound && <FlightLeg compact label="Back" leg={trip.inbound} price={trip.inbound.price} />}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate">Open to see every city and its flights.</p>
          )}
        </div>
      </DrillLink>
      {credit && (
        <PhotoCredit image={credit} className="absolute inset-x-4 bottom-1.5 z-10 text-slate [&_a:hover]:text-ink" />
      )}
    </li>
  )
}
