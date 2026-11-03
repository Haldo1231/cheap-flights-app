/** One line under the filters of an Anywhere screen while the "fly back to a different airport" switch is on. The trips back to
 * a different airport are asked for in a second request: this says they are still being looked for (the round trips are
 * already on screen and the list re-sorts when they arrive), what was found, or that they could not be loaded.
 * `found` = destinations that have such a trip at all; `used` = how many of them are cheaper than the round trip and now
 * show up in the list. */
export default function JawStatus({ loading, error, found, used, noun }: { loading: boolean; error: boolean; found: number; used: number; noun: string }) {
  if (loading) {
    return (
      <p role="status" className="mb-4 flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-slate">
        <span aria-hidden="true" className="skeleton inline-block h-3 w-3 rounded-full" />
        Also checking trips that come back to a different airport… The list below shows the round trips for now and sorts itself again when we find cheaper trips.
      </p>
    )
  }
  if (error) {
    return (
      <p role="status" className="mb-4 rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-sm text-ink">
        We could not check trips back to a different airport right now. The {noun} below are the round trips only.
      </p>
    )
  }
  return (
    <p role="status" className="mb-4 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-slate">
      {found === 0
        ? 'No cached fares for returning to a different airport on these dates.'
        : used > 0
        ? `${used} of the ${noun} below ${used === 1 ? 'is' : 'are'} cheaper as two one-way tickets that come back to a different airport. Every trip says where it comes back to; the list is sorted by total price.`
        : 'Trips back to a different airport exist, but none is cheaper than the round trips below.'}
    </p>
  )
}
