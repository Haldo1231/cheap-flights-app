'use client'

import Image from 'next/image'
import { countryFlag, unsplashLoader, UNSPLASH_HOME, withUnsplashUtm, type CountryImage } from '../lib/countryImage'

type PhotoProps = {
  code: string
  image: CountryImage | null | undefined
  /** True once the picture failed to load: the gradient takes over. */
  failed: boolean
  onFail: () => void
  /** Tells the browser how wide the picture is shown, so it downloads the right size. */
  sizes: string
  /** Load right away (first row) instead of when scrolled near. */
  eager?: boolean
}

/** The country picture. It fills its parent, which must be `relative` with a fixed
 * height or aspect ratio (so nothing jumps when the picture arrives). With no
 * photo, or a photo that does not load, it shows a gradient with the flag. */
export default function CountryPhoto({ code, image, failed, onFail, sizes, eager = false }: PhotoProps) {
  if (!image || failed) return <FallbackArt code={code} />

  return (
    // The photo's main colour shows while it loads.
    <div className="absolute inset-0" style={{ backgroundColor: image.color ?? 'var(--color-ink)' }}>
      <Image
        loader={unsplashLoader}
        src={image.raw}
        alt=""
        fill
        sizes={sizes}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        onError={onFail}
        className="object-cover object-[center_40%] transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
      />
    </div>
  )
}

/** A small number from the country code, so each country gets its own glow position. */
function seed(code: string): number {
  return Array.from(code).reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 1000, 7)
}

/** Navy-to-amber gradient with the flag and the country code as a big watermark. */
function FallbackArt({ code }: { code: string }) {
  const x = 15 + (seed(code) % 70)
  const flag = countryFlag(code)
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `radial-gradient(110% 85% at ${x}% -15%, rgba(252,163,17,0.9) 0%, rgba(252,163,17,0) 62%), linear-gradient(165deg, #1c2d52 0%, #14213D 70%)`,
      }}
    >
      <span className="num absolute -bottom-6 right-2 select-none text-[9rem] font-semibold leading-none text-white/[0.07]">
        {code}
      </span>
      {flag && <span className="absolute left-4 top-3 text-5xl leading-none drop-shadow-sm">{flag}</span>}
    </div>
  )
}

/** "Photo by NAME on Unsplash", linked the way Unsplash's guidelines ask. A very long
 * name is shortened with "…" so the "on Unsplash" part always stays visible. */
export function PhotoCredit({ image, className = '' }: { image: CountryImage; className?: string }) {
  const link =
    'inline-block underline decoration-current/40 underline-offset-2 hover:decoration-current focus-visible:outline-offset-1'
  return (
    <p className={`overflow-hidden whitespace-nowrap text-[11px] leading-6 ${className}`}>
      Photo by{' '}
      <a
        href={withUnsplashUtm(image.photographerUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${link} max-w-[10.5rem] truncate align-bottom`}
      >
        {image.photographer}
      </a>{' '}
      on{' '}
      <a href={withUnsplashUtm(UNSPLASH_HOME)} target="_blank" rel="noopener noreferrer" className={link}>
        Unsplash
      </a>
    </p>
  )
}
