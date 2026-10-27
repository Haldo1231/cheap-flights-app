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
}

/** One cached fare. A round-trip fare shows BOTH flights; its single price
 * covers them together, which the card says plainly. */
export default function FareCard({ fare, isCheapest = false, detailsHref, onPreview, isPreviewed = false, stayLine }: Props) {
  const isRoundTrip = fare.kind === 'round-trip' && fare.inbound
  const nights = fare.inbound ? nightsBetweenDates(fare.outbound.date, fare.inbound.date) : 0
  // Nothing about the flights themselves is known: say it once for the whole fare.
  const detailsUnknown = [fare.outbound, fare.inbound].every(
    (leg) => !leg || (!leg.time && !leg.airlineName && !leg.airlineCode)
  )

  const body = (
    <div className="px-4 pt-4 pb-2 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {isCheapest && (
            <span className="rounded-sm bg-[#FCA311] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#14213D]">
              Cheapest
            </span>
          )}
          <span className="rounded-sm border border-[#E5E1D8] bg-[#FBF9F4] px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-[#5B6472]">
            {isRoundTrip ? `Round trip · ${formatNights(nights)}` : 'One way'}
          </span>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#14213D]">€{fare.price}</p>
          <p className="text-xs text-[#5B6472]">{isRoundTrip ? 'both flights' : 'per person'}</p>
        </div>
      </div>

      <div className="mt-2 divide-y divide-[#E5E1D8]">
        <FlightLeg label="Outbound" leg={fare.outbound} hideMissing={detailsUnknown} />
        {fare.inbound && <FlightLeg label="Return" leg={fare.inbound} hideMissing={detailsUnknown} />}
      </div>

      <div className="mt-1 space-y-1 text-xs text-[#5B6472]">
        {detailsUnknown && <p>Airline and times are not in the cached data for this fare — they show on the booking site.</p>}
        {isRoundTrip && (
          <p>
            One cached price for both flights, not split per flight.
            {fare.gate ? ` Found via ${fare.gate}.` : ''}
            {fare.returnMatchesRequest === false ? ' Different return date than you asked for.' : ''}
          </p>
        )}
        {stayLine && <p className="font-medium text-[#14213D]">{stayLine}</p>}
      </div>
    </div>
  )

  return (
    <li
      onMouseEnter={onPreview}
      onFocus={onPreview}
      className={`rounded-sm border bg-white transition-colors ${
        isPreviewed ? 'border-[#FCA311] shadow-sm' : 'border-[#E5E1D8]'
      }`}
    >
      {detailsHref ? (
        <DrillLink
          href={detailsHref}
          className="block rounded-t-sm hover:bg-[#FBF9F4]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14213D]"
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
          className="inline-block rounded-sm bg-[#FCA311] px-4 py-2 text-sm font-semibold text-[#14213D] transition-colors hover:bg-[#e8940a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D]"
        >
          {isRoundTrip ? 'Book round trip →' : 'Book on Aviasales →'}
        </a>
        {detailsHref && (
          <DrillLink
            href={detailsHref}
            className="rounded-sm text-sm font-medium text-[#14213D] underline decoration-[#14213D]/30 decoration-2 underline-offset-4 hover:decoration-[#FCA311] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D]"
          >
            Trip details →
          </DrillLink>
        )}
        {fare.inbound && (
          <a
            href={fare.inbound.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="rounded-sm text-xs font-medium text-[#5B6472] underline decoration-[#E5E1D8] decoration-2 underline-offset-4 hover:text-[#14213D] hover:decoration-[#FCA311] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D]"
          >
            Return flight only (one-way search)
          </a>
        )}
      </div>
    </li>
  )
}
