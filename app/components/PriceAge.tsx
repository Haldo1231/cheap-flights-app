import { priceAgeText } from '../lib/priceAge'

/** "price seen 6 h ago" (or "price age not in the data") for a cached price. The time is read when the page
 * is drawn, so the words are marked as allowed to differ between the server's and the browser's clock. */
export default function PriceAge({ seenAt, className = '' }: { seenAt: string | null | undefined; className?: string }) {
  return (
    <span suppressHydrationWarning className={className}>
      {priceAgeText(seenAt)}
    </span>
  )
}
