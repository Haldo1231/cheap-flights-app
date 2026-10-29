import Image from 'next/image'

type Props = {
  /** Folder under /public ("trips" or "guides"), the entry's slug and the file name. */
  kind: 'trips' | 'guides'
  slug: string
  src: string
  alt: string
  /** How wide the picture is shown at different screen sizes (so the right file size is sent). */
  sizes: string
  /** First picture on the page: load right away. */
  eager?: boolean
  className?: string
}

export function contentImagePath(kind: 'trips' | 'guides', slug: string, src: string): string {
  return `/${kind}/${slug}/${src}`
}

/** A picture that fills its parent (which must have a fixed aspect ratio, so nothing jumps while it loads). */
export default function ContentImage({ kind, slug, src, alt, sizes, eager = false, className = '' }: Props) {
  return (
    <Image
      src={contentImagePath(kind, slug, src)}
      alt={alt}
      fill
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      className={`object-cover ${className}`}
    />
  )
}
