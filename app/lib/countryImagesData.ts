// Server-only lookup of the saved country photos. The JSON file is generated
// ahead of time by scripts/fetch-country-images.mjs, so showing a photo never
// calls Unsplash's API (no rate limits, no waiting). Do not import this from a
// 'use client' file: the API routes add the photo to their answer instead.

import imagesFile from '../../data/country-images.json'
import type { CountryImage } from './countryImage'

type ImagesFile = { images: Record<string, Partial<CountryImage> | undefined> }

const images = (imagesFile as unknown as ImagesFile).images ?? {}

function isUsable(image: Partial<CountryImage> | undefined): image is CountryImage {
  return (
    !!image &&
    typeof image.raw === 'string' &&
    image.raw.startsWith('https://images.unsplash.com/') &&
    typeof image.photographer === 'string' &&
    typeof image.photographerUrl === 'string' &&
    typeof image.photoUrl === 'string'
  )
}

/** The saved photo for a country code ("IT"), or null when there is none. */
export function getCountryImage(code: string): CountryImage | null {
  const image = images[code.toUpperCase()]
  if (!isUsable(image)) return null
  return {
    raw: image.raw,
    alt: image.alt || '',
    color: typeof image.color === 'string' ? image.color : null,
    width: Number(image.width) || 0,
    height: Number(image.height) || 0,
    photographer: image.photographer,
    photographerUrl: image.photographerUrl,
    photoUrl: image.photoUrl,
  }
}
