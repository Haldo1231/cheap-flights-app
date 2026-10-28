'use client'

import Image from 'next/image'
import { useState } from 'react'
import { FLAG_CODES } from '../lib/flagCodes'
import { GlobeIcon } from './Icons'

const SIZES = {
  xs: { w: 18, h: 14, box: 'h-[14px] w-[18px]' },
  sm: { w: 24, h: 18, box: 'h-[18px] w-[24px]' },
  md: { w: 32, h: 24, box: 'h-6 w-8' },
  xl: { w: 72, h: 54, box: 'h-[54px] w-[72px]' },
} as const

type Props = {
  /** Two-letter country code, any case ("SK", "sk"). */
  code: string | null | undefined
  size?: keyof typeof SIZES
  className?: string
}

/** A country flag as a real picture (not emoji, which Windows cannot show). Decorative:
 * the country name is always written next to it. A code without a flag, or a flag
 * that fails to load, shows a neutral globe instead. */
export default function Flag({ code, size = 'sm', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const lower = (code || '').toLowerCase()
  const { w, h, box } = SIZES[size]
  const shape = `inline-block shrink-0 rounded-[3px] align-middle ${box} ${className}`

  if (!FLAG_CODES.has(lower) || failed) {
    return (
      <span aria-hidden="true" className={`${shape} inline-flex items-center justify-center bg-sand text-slate ring-1 ring-inset ring-line`}>
        <GlobeIcon className="h-[70%] w-[70%]" />
      </span>
    )
  }

  return (
    // The flags are tiny SVG files already in /public, so there is nothing to optimize.
    <Image
      src={`/flags/${lower}.svg`}
      alt=""
      width={w}
      height={h}
      unoptimized
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${shape} object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.12)]`}
    />
  )
}
