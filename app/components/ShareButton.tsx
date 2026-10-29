'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, ShareIcon } from './Icons'

type Props = {
  /** What to share: a path or full address. Leave out to share the page you are on. */
  href?: string
  /** Shown in the share sheet, e.g. "Italy from €30". */
  title: string
  /** The sentence that goes with it. */
  text: string
  /** `round` is an icon on top of a photo; `button` is a normal button with a label. */
  variant?: 'round' | 'button'
  className?: string
}

/** Share a trip: the phone's share sheet where there is one (WhatsApp, Instagram, Discord ...),
 * otherwise the link is copied. The pasted link shows a picture card (see /api/og). */
export default function ShareButton({ href, title, text, variant = 'button', className = '' }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function flash() {
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2200)
  }

  async function share() {
    const url = href ? new URL(href, window.location.origin).toString() : window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (error) {
        // Closing the share sheet is not a problem; anything else falls back to copying.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      flash()
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  const label = copied ? 'Link copied' : `Share ${title}`

  return (
    <span className={className}>
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={share}
          aria-label={label}
          title={copied ? 'Link copied' : 'Share this'}
          className={
            variant === 'round'
              ? 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition duration-150 hover:bg-black/65 active:scale-95 motion-reduce:transition-none motion-reduce:active:transform-none'
              : 'btn btn-outline'
          }
        >
          {copied ? <CheckIcon className="h-5 w-5" /> : <ShareIcon className="h-5 w-5" />}
          {variant === 'button' && <span>{copied ? 'Link copied' : 'Share'}</span>}
        </button>
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? 'Link copied' : ''}
        </span>
        {copied && variant === 'round' && (
          <span aria-hidden="true" className="fade-in pointer-events-none absolute right-0 top-11 whitespace-nowrap rounded-md bg-deep px-2.5 py-1 text-xs font-medium text-white shadow-lift">
            Link copied
          </span>
        )}
      </span>
    </span>
  )
}
