import { PageHeaderSkeleton, FareListSkeleton } from '../components/Skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageHeaderSkeleton />
      <FareListSkeleton count={2} label="Loading your trip" />
    </div>
  )
}
