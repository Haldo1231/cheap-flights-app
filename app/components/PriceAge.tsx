import { describeAge } from '../lib/priceAge'

/** How old a cached price is, in words ("price seen 6 h ago"). When the data does not say, it says
 * "age not in data" instead of guessing. An old or no-longer-valid price is marked "may be out of date". */
export default function PriceAge({
  foundAt,
  outdated = false,
  className = '',
}: {
  foundAt: string | null | undefined
  outdated?: boolean
  className?: string
}) {
  const age = describeAge(foundAt, { outdated })
  return (
    <span suppressHydrationWarning className={`${age.warn ? 'text-danger' : 'text-slate'} ${className}`.trim()}>
      {age.text}
    </span>
  )
}
