// Loading placeholders that have the same shape as the real content, so the
// page does not jump when the data arrives.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-line/70 ${className}`} />
}

function Status({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

export function FareCardSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-sm border border-line bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="mt-4 h-4 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <Skeleton className="mt-5 h-9 w-40" />
    </div>
  )
}

export function FareListSkeleton({ count = 3, label = 'Loading flights' }: { count?: number; label?: string }) {
  return (
    <Status label={label}>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <FareCardSkeleton key={i} />
        ))}
      </div>
    </Status>
  )
}

export function RowListSkeleton({ count = 5, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <Status label={label}>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} aria-hidden="true" className="flex items-center justify-between rounded-sm border border-line bg-white px-5 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </Status>
  )
}

/** Same shape as a country photo card, so the grid does not jump when the data arrives. */
export function CountryCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full animate-pulse bg-line/70">
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <div className="space-y-2">
            <div className="h-5 w-28 rounded-sm bg-white/60" />
            <div className="h-3 w-20 rounded-sm bg-white/50" />
          </div>
          <div className="h-7 w-16 rounded-sm bg-white/60" />
        </div>
      </div>
      <div className="space-y-2 border-t border-dashed border-faint/70 px-4 pb-8 pt-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

export function CountryGridSkeleton({ count = 6, label = 'Loading countries' }: { count?: number; label?: string }) {
  return (
    <Status label={label}>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <CountryCardSkeleton key={i} />
        ))}
      </div>
    </Status>
  )
}

export function CalendarSkeleton({ label = 'Loading the calendar' }: { label?: string }) {
  return (
    <Status label={label}>
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </Status>
  )
}

export function PageHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="mb-6">
      <Skeleton className="mb-4 h-4 w-56" />
      <Skeleton className="h-8 w-72" />
    </div>
  )
}
