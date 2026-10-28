'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AirportPicker from '../components/AirportPicker'
import Flag from '../components/Flag'
import { CloseIcon, PlaneIcon } from '../components/Icons'
import WeekdayFilterPanel from '../components/WeekdayFilterPanel'
import { AIRPORTS, airportCountryCode } from '../airportsList'
import { HOME_AIRPORTS } from '../homeAirports'
import { ALL_WEEKDAYS, serializeDays } from '../weekdays'
import { formatMonth } from '../lib/format'
import { validateSearch, todayString, MAX_NIGHTS, MAX_RANGE_DAYS, type SearchErrors } from '../lib/searchValidation'

const CARD = 'surface mb-5 p-4 sm:p-5'
const INPUT = 'field'

function getNext12Months() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

/** A pill that is really a radio button or checkbox, so keyboard and screen readers just work. */
function Chip({
  type,
  name,
  checked,
  onChange,
  children,
  tone = 'navy',
}: {
  type: 'radio' | 'checkbox'
  name: string
  checked: boolean
  onChange: () => void
  children: React.ReactNode
  tone?: 'navy' | 'amber'
}) {
  return (
    <label className="relative inline-flex">
      <input type={type} name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={`pill min-h-11 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
          tone === 'navy'
            ? 'border-line bg-surface text-ink hover:border-ink peer-checked:border-ink peer-checked:bg-navy peer-checked:text-white'
            : 'border-line bg-surface text-ink hover:border-ink peer-checked:border-amber peer-checked:bg-amber-soft'
        }`}
      >
        {children}
      </span>
    </label>
  )
}

function Heading({ n, id, children }: { n: number; id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 flex items-center gap-3 text-base font-semibold">
      <span className="num inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs text-white">{n}</span>
      {children}
    </h2>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {message}
    </p>
  )
}

function DateField({
  id,
  label,
  value,
  onChange,
  min,
  error,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  min: string
  error?: string
  hint?: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-sm text-slate">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        suppressHydrationWarning
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={INPUT}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-slate">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className={`${INPUT} w-24`}
      />
    </div>
  )
}

export default function SearchForm() {
  const router = useRouter()
  const toParam = (useSearchParams().get('to') || '').toUpperCase()
  const prefill = AIRPORTS.find((a) => a.code === toParam)

  const [selectedAirports, setSelectedAirports] = useState<string[]>(HOME_AIRPORTS)
  const [extraOrigins, setExtraOrigins] = useState<{ code: string; city: string }[]>([])

  const [destinationCode, setDestinationCode] = useState(toParam === 'ANYWHERE' ? 'ANYWHERE' : prefill?.code ?? '')
  const [destinationCity, setDestinationCity] = useState(toParam === 'ANYWHERE' ? 'Anywhere' : prefill?.city ?? '')

  const [oneWay, setOneWay] = useState(false)
  const [openJaw, setOpenJaw] = useState(false)
  const [dateMode, setDateMode] = useState<'exact' | 'month' | 'range'>('exact')

  const [departDate, setDepartDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [month, setMonth] = useState('')
  const [returnMonth, setReturnMonth] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [minDays, setMinDays] = useState(2)
  const [maxDays, setMaxDays] = useState(8)

  const [outDays, setOutDays] = useState<number[]>(ALL_WEEKDAYS)
  const [backDays, setBackDays] = useState<number[]>(ALL_WEEKDAYS)
  const [minNights, setMinNights] = useState(1)
  const [maxNights, setMaxNights] = useState(14)

  const [errors, setErrors] = useState<SearchErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)

  const today = todayString()
  const months = getNext12Months()
  const isAnywhere = destinationCode === 'ANYWHERE'
  const errorList = Object.values(errors)

  function toggleAirport(code: string) {
    setSelectedAirports((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  function addExtraOrigin(code: string, city: string) {
    if (extraOrigins.find((o) => o.code === code) || selectedAirports.includes(code)) return
    setExtraOrigins((prev) => [...prev, { code, city }])
  }

  function chooseMonth(value: string) {
    setMonth(value)
    // Most trips return in the same month: start there, the traveller can change it.
    setReturnMonth((prev) => (!prev || prev < value ? value : prev))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const allOrigins = [...selectedAirports, ...extraOrigins.map((o) => o.code)]

    const found = validateSearch({
      origins: allOrigins,
      destination: destinationCode,
      oneWay,
      dateMode,
      departDate,
      returnDate,
      month,
      returnMonth,
      rangeStart,
      rangeEnd,
      minDays,
      maxDays,
      outDays,
      backDays,
      minNights,
      maxNights,
      today,
    })
    setErrors(found)
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => {
        summaryRef.current?.focus()
        summaryRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }

    // Open-jaw only works for exact dates and a whole month.
    const useOpenJaw = !isAnywhere && !oneWay && dateMode !== 'range' && openJaw

    const params = new URLSearchParams({
      origins: allOrigins.join(','),
      oneWay: String(oneWay),
      dateMode,
      openJaw: String(useOpenJaw),
    })
    if (isAnywhere) params.set('anywhere', 'true')
    else params.set('destination', destinationCode)

    if (dateMode === 'exact') {
      params.set('departDate', departDate)
      if (!oneWay && returnDate) params.set('returnDate', returnDate)
    } else if (dateMode === 'month') {
      params.set('month', month)
      if (!oneWay) params.set('returnMonth', returnMonth || month)
      // Weekday limits are only written when the person chose some; no limit = any day.
      if (outDays.length < ALL_WEEKDAYS.length) params.set('outDays', serializeDays(outDays))
      if (!oneWay) {
        if (backDays.length < ALL_WEEKDAYS.length) params.set('backDays', serializeDays(backDays))
        params.set('minNights', String(minNights))
        params.set('maxNights', String(maxNights))
      }
    } else {
      params.set('rangeStart', rangeStart)
      params.set('rangeEnd', rangeEnd)
      params.set('minDays', String(minDays))
      params.set('maxDays', String(maxDays))
    }

    router.push(`/results?${params.toString()}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-8 sm:px-6">
      {errorList.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mb-5 rounded-sm border border-danger-line bg-danger-bg p-4 text-sm text-ink"
        >
          <p className="mb-1 font-semibold">
            {errorList.length === 1 ? 'One thing to fix before searching:' : `${errorList.length} things to fix before searching:`}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <section className={CARD} aria-labelledby="h-from">
          <Heading n={1} id="h-from">
            Flying from
          </Heading>
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Home airports">
            {HOME_AIRPORTS.map((code) => {
              const a = AIRPORTS.find((x) => x.code === code)
              return (
                <Chip key={code} type="checkbox" name="origin" checked={selectedAirports.includes(code)} onChange={() => toggleAirport(code)}>
                  <Flag code={a?.countryCode} size="xs" className="mr-2" eager />
                  <span className="num">{code}</span>
                  <span className="ml-2">{a?.city}</span>
                </Chip>
              )
            })}
            {extraOrigins.map((o) => (
              <button
                key={o.code}
                type="button"
                onClick={() => setExtraOrigins((prev) => prev.filter((x) => x.code !== o.code))}
                aria-label={`Remove ${o.city}`}
                className="pill min-h-11 border-amber bg-amber-soft text-ink hover:bg-amber-soft-hover"
              >
                <Flag code={airportCountryCode(o.code)} size="xs" className="mr-2" eager />
                <span className="num">{o.code}</span>
                <span className="ml-2">{o.city}</span>
                <CloseIcon className="ml-2 h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <AirportPicker label="Add another airport to fly from" placeholder="Add another airport, e.g. Barcelona" onSelect={addExtraOrigin} />
          <FieldError id="origins-error" message={errors.origins} />
        </section>

        <section className={CARD} aria-labelledby="h-to">
          <Heading n={2} id="h-to">
            Flying to
          </Heading>
          {destinationCode ? (
            <button
              type="button"
              onClick={() => {
                setDestinationCode('')
                setDestinationCity('')
              }}
              aria-label={`Change destination, currently ${isAnywhere ? 'anywhere' : destinationCity}`}
              className="pill min-h-11 border-amber bg-amber-soft text-ink hover:bg-amber-soft-hover"
            >
              {isAnywhere ? (
                <>
                  <PlaneIcon className="h-4 w-4 text-amber-ink" />
                  <span className="ml-2">Anywhere</span>
                </>
              ) : (
                <>
                  <Flag code={airportCountryCode(destinationCode)} size="xs" className="mr-2" eager />
                  <span className="num">{destinationCode}</span>
                  <span className="ml-2">{destinationCity}</span>
                </>
              )}
              <CloseIcon className="ml-2 h-3.5 w-3.5" />
            </button>
          ) : (
            <AirportPicker
              label="Destination"
              placeholder="Type a city, e.g. Rome"
              onSelect={(code, city) => {
                setDestinationCode(code)
                setDestinationCity(city)
              }}
              onSelectAnywhere={() => {
                setDestinationCode('ANYWHERE')
                setDestinationCity('Anywhere')
              }}
            />
          )}
          {isAnywhere && (
            <p className="mt-2 text-sm text-slate">
              Searches every destination we have cached flight data for, grouped by country, cheapest first.
            </p>
          )}
          <FieldError id="destination-error" message={errors.destination} />
        </section>

        <section className={CARD} aria-labelledby="h-trip">
          <Heading n={3} id="h-trip">
            Trip type
          </Heading>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="h-trip">
            <Chip type="radio" name="trip" checked={!oneWay} onChange={() => setOneWay(false)}>
              Round trip
            </Chip>
            <Chip
              type="radio"
              name="trip"
              checked={oneWay}
              onChange={() => {
                setOneWay(true)
                setOpenJaw(false)
              }}
            >
              One way
            </Chip>
          </div>
          {!oneWay && !isAnywhere && dateMode !== 'range' && (
            <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" checked={openJaw} onChange={(e) => setOpenJaw(e.target.checked)} className="mt-1 h-5 w-5 accent-ink" />
              <span>
                Fly back to a different airport
                <span className="block text-slate">Works with exact dates or a whole month.</span>
              </span>
            </label>
          )}
        </section>

        <section className={CARD} aria-labelledby="h-dates">
          <Heading n={4} id="h-dates">
            Dates
          </Heading>
          <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="h-dates">
            <Chip type="radio" name="mode" checked={dateMode === 'exact'} onChange={() => setDateMode('exact')}>
              Exact dates
            </Chip>
            <Chip type="radio" name="mode" checked={dateMode === 'month'} onChange={() => setDateMode('month')}>
              Whole month
            </Chip>
            <Chip type="radio" name="mode" checked={dateMode === 'range'} onChange={() => setDateMode('range')}>
              Date range
            </Chip>
          </div>

          {dateMode === 'exact' && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <DateField id="departDate" label="Departure" value={departDate} onChange={setDepartDate} min={today} error={errors.departDate} />
              {!oneWay && (
                <DateField
                  id="returnDate"
                  label="Return (optional)"
                  value={returnDate}
                  onChange={setReturnDate}
                  min={departDate || today}
                  error={errors.returnDate}
                  hint="Leave empty to see every return date."
                />
              )}
            </div>
          )}

          {dateMode === 'month' && (
            <div>
              <div role="radiogroup" aria-label={oneWay ? 'Month' : 'Departure month'} className="mb-1">
                <p className="mb-2 text-sm text-slate">{oneWay ? 'Month' : 'Departure month'}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {months.map((m) => (
                    <Chip key={m} type="radio" name="month" checked={month === m} onChange={() => chooseMonth(m)}>
                      {formatMonth(m)}
                    </Chip>
                  ))}
                </div>
              </div>
              <FieldError id="month-error" message={errors.month} />

              {!oneWay && (
                <div role="radiogroup" aria-label="Return month" className="mt-4">
                  <p className="mb-2 text-sm text-slate">Return month</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {months.map((m) => (
                      <Chip key={m} type="radio" name="returnMonth" checked={returnMonth === m} onChange={() => setReturnMonth(m)}>
                        {formatMonth(m)}
                      </Chip>
                    ))}
                  </div>
                  <FieldError id="returnMonth-error" message={errors.returnMonth} />
                </div>
              )}

              <div className="mt-5">
                <p className="mb-1 text-sm text-slate">Optional: only look at certain weekdays.</p>
                <WeekdayFilterPanel
                  outDays={outDays}
                  backDays={backDays}
                  oneWay={oneWay}
                  minNights={minNights}
                  maxNights={maxNights}
                  onChangeOutDays={setOutDays}
                  onChangeBackDays={setBackDays}
                  onChangeMinNights={(v) => setMinNights(v === '' ? NaN : Number(v))}
                  onChangeMaxNights={(v) => setMaxNights(v === '' ? NaN : Number(v))}
                />
                <FieldError id="outDays-error" message={errors.outDays} />
                <FieldError id="backDays-error" message={errors.backDays} />
                <FieldError id="nights-error" message={errors.nights} />
                <p className="mt-1 text-xs text-slate">Nights can be 1 to {MAX_NIGHTS}.</p>
              </div>
            </div>
          )}

          {dateMode === 'range' && (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <DateField id="rangeStart" label="Leave from" value={rangeStart} onChange={setRangeStart} min={today} error={errors.rangeStart} />
                <DateField id="rangeEnd" label="Leave until" value={rangeEnd} onChange={setRangeEnd} min={rangeStart || today} error={errors.rangeEnd} />
              </div>
              {!oneWay && (
                <div className="flex flex-wrap items-end gap-3">
                  <NumberField id="minDays" label="Min days away" value={minDays} onChange={setMinDays} min={1} max={MAX_RANGE_DAYS} />
                  <NumberField id="maxDays" label="Max days away" value={maxDays} onChange={setMaxDays} min={1} max={MAX_RANGE_DAYS} />
                </div>
              )}
              <FieldError id="days-error" message={errors.days} />
              <p className="mt-3 text-xs text-slate">
                Experimental — fewer cached results may be available than the other two modes.
              </p>
            </div>
          )}
        </section>

        {/* On phones the main button stays at the bottom of the screen while you scroll the form. */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-paper/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button type="submit" className="btn btn-amber btn-lg w-full sm:w-auto">
            Search flights
          </button>
        </div>
      </form>
    </div>
  )
}
