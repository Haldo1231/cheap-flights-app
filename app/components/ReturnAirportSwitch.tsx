'use client'

/** The on/off switch "Fly back to a different airport". One component for the search form and for every results screen,
 * so the wording and the behaviour are the same everywhere. A real switch button: keyboard (Space) and screen readers work. */
export default function ReturnAirportSwitch({
  on,
  onChange,
  id = 'open-jaw',
  description = 'Also show trips that come back to another of BTS, VIE, BUD, KSC or PRG (two one-way tickets).',
  className = '',
}: {
  on: boolean
  onChange: (next: boolean) => void
  id?: string
  description?: string
  className?: string
}) {
  return (
    <div className={`flex items-start justify-between gap-4 rounded-lg border border-line bg-paper/60 px-3 py-2 ${className}`}>
      <div className="min-w-0 text-sm">
        <p id={`${id}-label`} className="font-semibold text-ink">
          Fly back to a different airport
        </p>
        <p id={`${id}-help`} className="text-slate">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        onClick={() => onChange(!on)}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="mr-2 text-sm font-medium text-ink">{on ? 'On' : 'Off'}</span>
        <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition-colors duration-200 motion-reduce:transition-none ${on ? 'bg-amber' : 'bg-faint'}`}>
          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${on ? 'translate-x-5' : ''}`} />
        </span>
      </button>
    </div>
  )
}
