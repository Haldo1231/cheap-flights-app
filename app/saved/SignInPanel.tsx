'use client'

import { useState } from 'react'
import { signInWithGoogle } from '../lib/auth/browser'

/** /saved for a visitor who is not signed in. */
export default function SignInPanel({ failed }: { failed: boolean }) {
  const [problem, setProblem] = useState<string | null>(failed ? 'Sign-in did not finish. Please try again.' : null)
  return (
    <div className="surface px-5 py-10 text-center sm:px-8">
      <h2 className="text-xl font-semibold">Sign in to see your saved routes</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate">
        Save a route with its dates and we show you how its cheapest cached price moved since. Sign-in is with Google; we keep
        your name, e-mail and the routes you save, nothing else.
      </p>
      {problem && (
        <p role="alert" className="mx-auto mt-4 max-w-md rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-sm text-ink">
          {problem}
        </p>
      )}
      <button type="button" onClick={async () => setProblem(await signInWithGoogle({ next: '/saved' }))} className="btn btn-primary mt-5">
        Continue with Google
      </button>
    </div>
  )
}
