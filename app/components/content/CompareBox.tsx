import Link from 'next/link'
import type { CompareRow } from '../../lib/content/costs'

function euro(n: number) {
  return `€${n}`
}

function difference(n: number) {
  if (n === 0) return 'same'
  return `${n > 0 ? '+' : '−'}€${Math.abs(n)}`
}

function words(n: number) {
  if (n === 0) return 'the same as our estimate'
  return `€${Math.abs(n)} ${n > 0 ? 'above' : 'below'} our estimate`
}

/** The real spend next to the site's estimated daily budget for the destination. Only rows
 * where both numbers exist are shown; with no rows at all the box is not shown. */
export default function CompareBox({ destinationName, destinationHref, rows, day }: { destinationName: string; destinationHref: string; rows: CompareRow[]; day: CompareRow | null }) {
  if (rows.length === 0) return null
  const all = day ? [...rows, day] : rows
  return (
    <section aria-labelledby="compare" className="surface mt-12 p-4 sm:p-5">
      <h2 id="compare" className="h-section mb-1">
        Compare with our estimate
      </h2>
      <p className="mb-4 text-sm text-slate">
        What this trip really cost per person, next to the daily budget we show on the{' '}
        <Link href={destinationHref} className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          {destinationName} page
        </Link>
        . One trip is one person&apos;s spending, so differences are normal.
      </p>
      <table className="w-full text-sm [overflow-wrap:normal]">
        <caption className="sr-only">Real spending compared with our estimate, in euro</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate">
            <th scope="col" className="py-2 pr-2 font-medium">
              &nbsp;
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              This trip
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Estimate
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">
              <span aria-hidden="true" className="sm:hidden">
                Diff.
              </span>
              <span className="sr-only sm:not-sr-only">Difference</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {all.map((row) => {
            const isDay = row === day
            return (
              <tr key={row.label} className={isDay ? 'font-semibold' : ''}>
                <th scope="row" className="py-2 pr-2 text-left font-normal text-slate">
                  <span className={isDay ? 'font-semibold text-ink' : ''}>{row.label}</span>
                </th>
                <td className="num px-2 py-2 text-right">{euro(row.actual)}</td>
                <td className="num px-2 py-2 text-right">{euro(row.estimate)}</td>
                <td className="num py-2 pl-2 text-right">
                  <span aria-hidden="true">{difference(row.difference)}</span>
                  <span className="sr-only">{words(row.difference)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
