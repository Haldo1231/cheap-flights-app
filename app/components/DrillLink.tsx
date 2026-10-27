'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { requestScrollTop } from '../lib/scroll'

/** A link to a deeper level (country, city, trip). The screen it opens starts at the top. */
export default function DrillLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e)
        // Ctrl/Cmd/Shift-click opens a new tab: this page stays where it is.
        const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
        if (plain) requestScrollTop()
      }}
    />
  )
}
