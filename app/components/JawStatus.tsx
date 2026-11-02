/** One line under the filters of an Anywhere screen while the "different airport" switch is on: says the extra trips are still
 * being looked for (the normal results are already on screen), or that they are included, or that they could not be loaded. */
export default function JawStatus({ loading, error, found, noun }: { loading: boolean; error: boolean; found: number; noun: string }) {
  if (loading) {
    return (
      <p role="status" className="mb-4 flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-slate">
        <span aria-hidden="true" className="skeleton inline-block h-3 w-3 rounded-full" />
        Also checking trips that come back to a different airport… The {noun} below are the normal results and update when this is done.
      </p>
    )
  }
  if (error) {
    return (
      <p role="status" className="mb-4 rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-sm text-ink">
        We could not check trips back to a different airport right now. The {noun} below are the normal results.
      </p>
    )
  }
  return (
    <p role="status" className="mb-4 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-slate">
      {found > 0
        ? `Trips that fly back to a different airport are included (found for ${found} ${found === 1 ? 'destination' : 'destinations'}). Marked "back to …" on the card.`
        : 'No cached fares for returning to a different airport on these dates, so these are the normal results.'}
    </p>
  )
}
