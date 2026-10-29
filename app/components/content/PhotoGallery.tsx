import type { Photo } from '../../lib/content/schema'
import ContentImage, { contentImagePath } from './ContentImage'

/** The photos of a trip: a grid of equal frames, each with its description and optional caption.
 * Click a photo to open the full-size file in a new tab. */
export default function PhotoGallery({ kind, slug, photos }: { kind: 'trips' | 'guides'; slug: string; photos: Photo[] }) {
  if (photos.length === 0) return null
  return (
    <section aria-labelledby="gallery" className="mt-12">
      <h2 id="gallery" className="h-section mb-4">
        Photos
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {photos.map((photo) => (
          <li key={photo.src}>
            <figure>
              <a
                href={contentImagePath(kind, slug, photo.src)}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-[4/3] overflow-hidden rounded-lg border border-line bg-sand"
              >
                <ContentImage
                  kind={kind}
                  slug={slug}
                  src={photo.src}
                  alt={photo.alt}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw"
                  className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                />
                <span className="sr-only"> (opens the full photo in a new tab)</span>
              </a>
              {photo.caption && <figcaption className="mt-2 text-sm text-slate">{photo.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}
