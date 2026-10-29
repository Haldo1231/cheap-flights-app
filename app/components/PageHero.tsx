import type { ReactNode } from 'react'

type Props = {
  /** Small capital label above the title. */
  eyebrow?: string
  title: ReactNode
  /** The sentence(s) under the title. */
  children?: ReactNode
  /** Buttons / links under the text. */
  actions?: ReactNode
  /** Something on the right on wide screens (the home page puts the departure board here). */
  aside?: ReactNode
  /** `lg` is for the home page, `md` for every other page. */
  size?: 'md' | 'lg'
}

/** The dark band at the top of a page: big title, one calm sentence, a clear next step. */
export default function PageHero({ eyebrow, title, children, actions, aside, size = 'md' }: Props) {
  const big = size === 'lg'
  return (
    <section className="hero-surface border-t border-white/10 text-white">
      <div
        className={`mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 ${big ? 'py-14 sm:py-20' : 'py-10 sm:py-14'} ${
          aside ? 'lg:grid-cols-[1.25fr_1fr]' : ''
        }`}
      >
        <div className="rise-in">
          {eyebrow && <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-amber">{eyebrow}</p>}
          <h1
            className={`font-semibold tracking-tight text-balance ${
              big ? 'text-5xl leading-[0.98] tracking-tighter sm:text-7xl lg:text-[5.25rem]' : 'text-4xl leading-[1.02] tracking-tighter sm:text-6xl'
            }`}
          >
            {title}
          </h1>
          {children && (
            <div className={`mt-5 max-w-xl leading-relaxed text-white/80 ${big ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>
              {children}
            </div>
          )}
          {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {aside}
      </div>
    </section>
  )
}
