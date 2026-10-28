import Link from 'next/link'
import PageHero from './components/PageHero'
import { HOME_AIRPORTS } from './homeAirports'
import { AIRPORTS } from './airportsList'
import { DESTINATIONS } from './destinationsList'

const STEPS = [
  { n: '01', title: 'Say where and when', text: 'Pick a city or "anywhere", then exact dates, a whole month, or a date range.' },
  { n: '02', title: 'We check all 5 airports', text: 'Bratislava, Vienna, Budapest, Košice and Prague are compared in one go.' },
  { n: '03', title: 'See the whole trip', text: 'Flights with airlines and times, plus what the stay will cost, cheapest first.' },
]

type IconName = 'calendar' | 'globe' | 'ticket' | 'shield'

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'calendar',
    title: 'A whole month at a glance',
    text: 'A price calendar with weekday filters — for example depart Thursday, come back Tuesday — so you only see days that really work.',
  },
  {
    icon: 'globe',
    title: 'Anywhere, ranked by country',
    text: 'Not sure where to go? We rank countries by the cheapest price that matches your dates, then open up the cities.',
  },
  {
    icon: 'ticket',
    title: 'Flights plus the stay',
    text: 'Every trip shows hostel, food and transport costs for the days you stay, so you compare the whole bill, not just the ticket.',
  },
  {
    icon: 'shield',
    title: 'Honest about the data',
    text: 'Prices are cached, so we say so. When an airline or time is not in the data, we tell you instead of guessing.',
  },
]

function Icon({ name }: { name: IconName }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9S14.6 18.4 12 21c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
        </svg>
      )
    case 'ticket':
      return (
        <svg {...common}>
          <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
          <path d="M14 6v12" strokeDasharray="2 3" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 10 4.1-1.7 7-5.6 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
  }
}

/** The airport codes as little flip tiles, like a departure board. */
function DepartureBoard() {
  return (
    <section className="rise-in rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur-sm" aria-labelledby="board-title">
      <div className="mb-2 flex items-center justify-between border-b border-white/15 pb-3">
        <h2 id="board-title" className="num text-sm font-semibold uppercase tracking-widest text-amber">
          Departures
        </h2>
        <span className="num text-xs text-white/60">compared at once</span>
      </div>
      <ul className="divide-y divide-white/10">
        {HOME_AIRPORTS.map((code, row) => {
          const airport = AIRPORTS.find((a) => a.code === code)
          return (
            <li key={code} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3">
                <span className="flex gap-1">
                  <span className="sr-only">{code}</span>
                  {Array.from(code).map((ch, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      style={{ animationDelay: `${200 + row * 110 + i * 60}ms` }}
                      className="flap-in num relative inline-flex h-9 w-7 items-center justify-center rounded-[5px] bg-white/10 text-lg font-semibold text-amber after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/40"
                    >
                      {ch}
                    </span>
                  ))}
                </span>
                <span className="font-medium">{airport?.city}</span>
              </span>
              <span className="num text-xs uppercase tracking-wide text-white/60">{airport?.country}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Home() {
  return (
    <div>
      <PageHero
        size="lg"
        eyebrow={HOME_AIRPORTS.join(' · ')}
        title={
          <>
            Find the <span className="text-amber">cheapest</span> way to fly
          </>
        }
        actions={
          <>
            <Link href="/search" className="btn btn-amber btn-lg">
              Search flights
            </Link>
            <Link href="/anywhere" className="btn btn-outline-light btn-lg">
              Where can I fly cheaply?
            </Link>
          </>
        }
        aside={<DepartureBoard />}
      >
        <p>
          One search compares Vienna, Bratislava, Budapest, Košice and Prague — so you stop checking five sites
          separately.
        </p>
        <p className="mt-4 text-sm text-white/70 sm:text-base">
          Or{' '}
          <Link
            href="/search?to=ANYWHERE"
            className="inline-block py-1 font-medium text-white underline decoration-amber decoration-2 underline-offset-4 transition-colors hover:text-amber"
          >
            search anywhere with your own dates →
          </Link>
        </p>
      </PageHero>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6" aria-labelledby="how">
        <p className="eyebrow mb-2">Simple</p>
        <h2 id="how" className="h-section mb-8">
          How it works
        </h2>
        <ol className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="border-t-2 border-ink pt-4">
              <p className="num mb-2 text-3xl font-semibold text-amber-ink">{step.n}</p>
              <p className="mb-1 text-lg font-semibold">{step.title}</p>
              <p className="text-slate">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-white" aria-labelledby="features">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <p className="eyebrow mb-2">Why it is different</p>
          <h2 id="features" className="h-section mb-8">
            Built for planning, not just price-checking
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="group rounded-lg border border-line bg-paper p-5 transition duration-200 hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-card motion-reduce:transition-none motion-reduce:hover:transform-none"
              >
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-ink text-amber">
                  <Icon name={f.icon} />
                </span>
                <p className="mb-1 font-semibold">{f.title}</p>
                <p className="text-sm text-slate">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6" aria-labelledby="popular">
        <p className="eyebrow mb-2">Popular</p>
        <h2 id="popular" className="h-section mb-1">
          Popular city breaks
        </h2>
        <p className="mb-6 text-slate">Open a destination for the cheapest cached flight, a stay estimate and hostel picks.</p>
        <ul className="flex flex-wrap gap-2">
          {DESTINATIONS.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/destinations/${d.slug}`}
                className="pill border-line bg-white hover:border-ink hover:bg-ink hover:text-white"
              >
                {d.name}
                <span className="num text-xs opacity-75">{d.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-6 sm:px-6" aria-labelledby="cta">
        <div className="hero-surface flex flex-col items-start justify-between gap-5 rounded-lg px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 id="cta" className="text-2xl font-semibold tracking-tight">
              Not sure where to go?
            </h2>
            <p className="mt-1 text-white/75">Give us your dates and home airports. We show the cheapest countries first.</p>
          </div>
          <Link href="/search?to=ANYWHERE" className="btn btn-amber btn-lg shrink-0">
            Search anywhere
          </Link>
        </div>
      </section>
    </div>
  )
}
