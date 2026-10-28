import type { Fare } from '../tripTypes'
import { formatNights, nightsBetweenDates } from '../lib/format'
import FlightLeg from './FlightLeg'
import DrillLink from './DrillLink'

type Props = {
  fare: Fare
  isCheapest?: boolean
  /** Opens the full trip detail screen. When set, the whole card is a link to it. */
  detailsHref?: string
  /** Called when the card is hovered or focused (lets the page preview its cost). */
  onPreview?: () => void
  /** Highlight this card (e.g. it is the one the cost panel is showing). */
  isPreviewed?: boolean
  /** One line with the fare plus the stay, e.g. "≈ €328 with 5 days of stay costs". */
  stayLine?: string | null
  /** A title shown at the top of the card (e.g. the destination's name). */
  heading?: React.ReactNode
}

/** One cached fare. A round-trip fare shows BOTH flights; its single price
 * covers them together, which the card says plainly. */
export default function FareCard({ fare, isCheapest = false, detailsHref, onPreview, isPreviewed = false, stayLine, heading }: Props) {
  const isRoundTrip = fare.kind === 'round-trip' && fare.inbound
  const nights = fare.inbound ? nightsBetweenDates(fare.outbound.date, fare.inbound.date) : 0
  // Nothing about the flights themselves is known: say it once for the whole fare.
  const detailsUnknown = [fare.outbound, fare.inbound].every(
    (leg) => !leg || (!leg.time && !leg.airlineName && !leg.airlineCode)
  )

  // One quiet line of fine print instead of several.
  const notes: string[] = []
  if (isRoundTrip) notes.push('One cached price for both flights, not split per flight')
  if (fare.gate) notes.push(`found via ${fare.gate}`)
  if (detailsUnknown) notes.push('airline and times not in the cached data — see the booking site')
  if (fare.returnMatchesRequest === false) notes.push('different return date than you asked for')

  const body = (
    <div className="px-4 pt-4 pb-2 sm:px-5">
      {heading && <div className="mb-2 text-lg font-semibold text-ink">{heading}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {isCheapest && (
            <span className="rounded-full bg-amber px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink">
              Cheapest
            </span>
          )}
          <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-slate">
            {isRoundTrip ? `Round trip · ${nights === 0 ? 'same day' : formatNights(nights)}` : 'One way'}
          </span>
        </div>
        <div className="whitespace-nowrap text-right">
          <p className={`font-mono text-3xl font-semibold leading-none tabular-nums text-ink ${isCheapest ? 'underline decoration-amber decoration-[3px] underline-offset-[6px]' : ''}`}>€{fare.price}</p>
          <p className="mt-1.5 text-xs text-slate">{isRoundTrip ? 'both flights' : 'per person'}</p>
        </div>
      </div>

      <div className="mt-2 divide-y divide-line">
        <FlightLeg label="Outbound" leg={fare.outbound} hideMissing={detailsUnknown} />
        {fare.inbound && <FlightLeg label="Return" leg={fare.inbound} hideMissing={detailsUnknown} />}
      </div>

      <div className="mt-1 space-y-1 text-xs text-slate">
        {notes.length > 0 && <p>{notes.join(' · ')}.</p>}
        {stayLine && <p className="font-medium text-ink">{stayLine}</p>}
      </div>
    </div>
  )

  return (
    <li
      onMouseEnter={onPreview}
      onFocus={onPreview}
      className={`relative overflow-hidden rounded-lg border shadow-card transition duration-200 motion-reduce:transition-none ${
        isPreviewed
          ? 'border-amber bg-white shadow-lift'
          : isCheapest
          ? 'border-amber/70 bg-gradient-to-br from-amber-soft to-white'
          : 'border-line bg-white hover:border-ink/25 hover:shadow-lift'
      }`}
    >
      {isCheapest && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-amber" />}
      {detailsHref ? (
        <DrillLink
          href={detailsHref}
          className="block transition-colors hover:bg-paper/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
        >
          {body}
        </DrillLink>
      ) : (
        body
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-1 sm:px-5">
        <a
          href={fare.bookingUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="btn btn-amber"
        >
          {isRoundTrip ? 'Book round trip →' : 'Book on Aviasales →'}
        </a>
        {detailsHref && (
          <DrillLink
            href={detailsHref}
            className="btn btn-outline"
          >
            Trip details →
          </DrillLink>
        )}
        {fare.inbound && (
          <a
            href={fare.inbound.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex min-h-10 items-center rounded-sm text-xs font-medium text-slate underline decoration-line decoration-2 underline-offset-4 hover:text-ink hover:decoration-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Return flight only (one-way search)
          </a>
        )}
      </div>
    </li>
  )
}
