'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="font-mono text-sm text-[#5B6472] mb-4">Oops</p>
      <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
      <p className="text-[#5B6472] mb-8">
        This page hit an unexpected error. Try again, or head back home.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="px-6 py-3 bg-[#14213D] text-white rounded-sm font-medium hover:bg-[#1c2d52] transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-6 py-3 border border-[#14213D] text-[#14213D] rounded-sm font-medium hover:bg-[#14213D] hover:text-white transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  )
}
