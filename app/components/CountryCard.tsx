'use client'

import { useState } from 'react'
import DrillLink from './DrillLink'
import FlightLeg from './FlightLeg'
import CountryPhoto, { PhotoCredit } from './CountryPhoto'
import Flag from './Flag'
import ShareButton from './ShareButton'
import BudgetBadge from './BudgetBadge'
import PriceAge from './PriceAge'
import type { AnywhereCountry } from '../tripTypes'
import type { TripEstimate } from '../lib/budget'

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
  /** Budget estimate for the trip behind the price (flight + stay). Only set when a budget is. */
  estimate?: TripEstimate | null
}

const PHOTO_SIZES = '(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw'

/** One country as a photo card: picture, name, "from €X", how many destinations,
 * and (under the picture) the cheapest trip that matches the filters. */
export default function CountryCard({ country, href, cheapest = false, eager = false, index = 0, estimate = null }: Props) {
  const [failed, setFailed] = useState(false)
  const city = country.verifiedCity
  const trip = city?.trip
  const destinations = `${country.candidateCityCount} destination${country.candidateCityCount === 1 ? '' : 's'}`
  const kind = trip?.inbound ? (trip.kind === 'fare' ? 'round trip' : 'out + back') : 'one way'
  const credit = country.image && !failed ? country.image : null

  return (
    <li
      className="group rise-in relative transition-transform duration-300 ease-out hover:-translate-y-1 active:scale-[0.985] motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:transform-none"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
    >
      <DrillLink
        href={href}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-deep/25"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-deep">
          <CountryPhoto code={country.code} image={country.image} failed={failed} onFail={() => setFailed(true)} sizes={PHOTO_SIZES} eager={eager} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          {credit && <Flag code={country.code} size="md" className="absolute left-3 top-3 shadow-md" eager={eager} />}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
            <div className="min-w-0">
              {cheapest && (
                <span className="mb-1.5 inline-block rounded-full bg-amber px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-deep shadow-sm">
                  Cheapest
                </span>
              )}
              <h3 className="line-clamp-2 text-xl font-semibold leading-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">{country.name}</h3>
              <p className="text-sm text-white/90">{destinations}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[11px] uppercase tracking-wide text-white/80">from</p>
              <p className="num text-2xl font-semibold leading-none text-amber [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
                €{country.price ?? '—'}
              </p>
              {estimate?.total != null && (
                <p className="mt-1 font-mono text-xs font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
                  ~€{estimate.total} total
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Ticket stub: the trip behind the price. */}
        <div className="flex flex-1 flex-col border-t border-dashed border-faint/70 px-4 pb-8 pt-3">
          {city && trip ? (
            <>
              <p className="mb-1 text-xs text-slate">
                Cheapest match: <span className="font-medium text-ink">{city.name}</span> from {city.origin} · {kind} · <PriceAge seenAt={trip.seenAt} />
              </p>
              {estimate && (
                <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate">
                  <BudgetBadge estimate={estimate} />
                  {estimate.total !== null && <span>flight + {estimate.days} day{estimate.days === 1 ? '' : 's'} of stay, estimate</span>}
                </p>
              )}
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
      <ShareButton
        href={href}
        title={country.name}
        text={`${country.name}${country.price != null ? ` from €${country.price}` : ''} — found on cheapflights`}
        variant="round"
        className="absolute right-3 top-3 z-10"
      />
      {credit && (
        <PhotoCredit image={credit} className="absolute inset-x-4 bottom-1.5 z-10 text-slate [&_a:hover]:text-ink" />
      )}
    </li>
  )
}
