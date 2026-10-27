import Link from 'next/link'
import { HOME_AIRPORTS } from './homeAirports'
import { AIRPORTS } from './airportsList'
import { DESTINATIONS } from './destinationsList'

const STEPS = [
  { n: '01', title: 'Say where and when', text: 'Pick a city or "anywhere", then exact dates, a whole month, or a date range.' },
  { n: '02', title: 'We check all 5 airports', text: 'Bratislava, Vienna, Budapest, Košice and Prague are compared in one go.' },
  { n: '03', title: 'See the whole trip', text: 'Flights with airlines and times, plus what the stay will cost, cheapest first.' },
]

const FEATURES = [
  {
    title: 'A whole month at a glance',
    text: 'A price calendar with weekday filters — for example depart Thursday, come back Tuesday — so you only see days that really work.',
  },
  {
    title: 'Anywhere, ranked by country',
    text: 'Not sure where to go? We rank countries by the cheapest price that matches your dates, then open up the cities.',
  },
  {
    title: 'Flights plus the stay',
    text: 'Every trip shows hostel, food and transport costs for the days you stay, so you compare the whole bill, not just the ticket.',
  },
  {
    title: 'Honest about the data',
    text: 'Prices are cached, so we say so. When an airline or time is not in the data, we tell you instead of guessing.',
  },
]

export default function Home() {
  return (
    <div>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="num mb-4 text-sm text-slate">{HOME_AIRPORTS.join(' · ')}</p>
            <h1 className="mb-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Find the cheapest way to fly
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate">
              One search compares Vienna, Bratislava, Budapest, Košice and Prague — so you stop checking five sites
              separately.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/search"
                className="inline-flex min-h-12 items-center rounded-sm bg-ink px-6 font-medium text-white transition-colors hover:bg-ink-hover"
              >
                Search flights
              </Link>
              <Link
                href="/anywhere"
                className="inline-flex min-h-12 items-center rounded-sm border border-ink px-6 font-medium text-ink transition-colors hover:bg-ink hover:text-white"
              >
                Where can I fly cheaply?
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate">
              Or{' '}
              <Link
                href="/search?to=ANYWHERE"
                className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4 hover:text-amber-ink"
              >
                search anywhere with your own dates →
              </Link>
            </p>
          </div>

          <section className="rounded-sm bg-ink p-5 text-white shadow-sm" aria-labelledby="board-title">
            <div className="mb-3 flex items-center justify-between border-b border-white/15 pb-3">
              <h2 id="board-title" className="num text-sm font-semibold uppercase tracking-widest text-amber">
                Departures
              </h2>
              <span className="num text-xs text-white/60">compared at once</span>
            </div>
            <ul className="divide-y divide-white/10">
              {HOME_AIRPORTS.map((code) => {
                const airport = AIRPORTS.find((a) => a.code === code)
                return (
                  <li key={code} className="flex items-center justify-between py-2.5">
                    <span className="flex items-baseline gap-3">
                      <span className="num w-10 text-lg font-semibold text-amber">{code}</span>
                      <span>{airport?.city}</span>
                    </span>
                    <span className="num text-xs uppercase tracking-wide text-white/60">{airport?.country}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="mb-6 text-xl font-semibold">
          How it works
        </h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n}>
              <p className="num mb-1 text-sm font-semibold text-amber-ink">{step.n}</p>
              <p className="mb-1 font-semibold">{step.title}</p>
              <p className="text-slate">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-white" aria-labelledby="features">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="features" className="mb-6 text-xl font-semibold">
            Built for planning, not just price-checking
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-sm border border-line bg-paper p-5">
                <p className="mb-1 font-semibold">{f.title}</p>
                <p className="text-sm text-slate">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6" aria-labelledby="popular">
        <h2 id="popular" className="mb-1 text-xl font-semibold">
          Popular city breaks
        </h2>
        <p className="mb-5 text-slate">Open a destination for the cheapest cached flight, a stay estimate and hostel picks.</p>
        <ul className="flex flex-wrap gap-2">
          {DESTINATIONS.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/destinations/${d.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line bg-white px-4 transition-colors hover:border-ink"
              >
                {d.name}
                <span className="num text-xs text-slate">{d.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
