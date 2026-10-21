import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="font-mono text-sm text-[#5B6472] mb-4">404</p>
      <h1 className="text-3xl font-semibold mb-4">Page not found</h1>
      <p className="text-[#5B6472] mb-8">
        That page doesn&apos;t exist. Try searching for a flight instead.
      </p>
      <Link
        href="/"
        className="inline-block px-6 py-3 bg-[#14213D] text-white rounded-sm font-medium hover:bg-[#1c2d52] transition-colors"
      >
        Go home
      </Link>
    </div>
  )
}
