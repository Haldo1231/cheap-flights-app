/** A clearly marked gap for text only the site's owner can write (shown on the page until it is filled in). */
export default function OwnerTodo({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="rounded-sm border-2 border-dashed border-amber bg-amber-soft px-4 py-3 text-sm">
      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-amber-ink">TODO (to be written by the site owner)</p>
      <p className="mt-1 text-ink">{children}</p>
    </div>
  )
}
