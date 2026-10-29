import { ImageResponse } from 'next/og'
import { readOgCard, type OgCard } from '../../lib/ogCard'
import { getCountryImage } from '../../lib/countryImagesData'
import { photoLoader, PHOTO_SITES } from '../../lib/countryImage'

// The "link preview" picture (1200 x 630) shown when a link to the site is pasted into a chat.
// Only cards signed by our own server (lib/ogCard.ts) are drawn; anything else gets the plain
// brand picture. The card shows the cached price with a "cached" note, like the site does.

const AMBER = '#FCA311'
const NAVY = '#14213D'

const BRAND: OgCard = {
  title: 'Find the cheapest way to fly',
  eyebrow: 'BTS · VIE · BUD · KSC · PRG',
  price: null,
  note: '',
  line: 'One search across five airports. Airlines, times and the whole trip cost.',
  cc: '',
}

/** Downloads a picture and returns it as a data address, or null if it takes too long or fails. */
async function asDataUri(url: string, fallbackType: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || fallbackType
    if (!type.startsWith('image/')) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > 2_500_000) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const card = readOgCard(url.searchParams) ?? BRAND
  const isBrand = card === BRAND

  // The country photo (when one is saved) and the flag. Both are optional extras.
  const photoInfo = card.cc ? getCountryImage(card.cc) : null
  const photoUrl = photoInfo ? photoLoader({ src: photoInfo.raw, width: 1200, quality: 70 }) : null
  const [photo, flag] = await Promise.all([
    photoUrl ? asDataUri(photoUrl, 'image/jpeg') : Promise.resolve(null),
    card.cc ? asDataUri(new URL(`/flags/${card.cc.toLowerCase()}.svg`, url.origin).toString(), 'image/svg+xml') : Promise.resolve(null),
  ])
  const credit = photo && photoInfo ? `Photo: ${photoInfo.photographer} / ${PHOTO_SITES[photoInfo.source].name}` : ''

  const titleSize = card.title.length > 22 ? 64 : card.title.length > 14 ? 78 : 92

  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: NAVY, color: '#fff' }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- drawn by ImageResponse, not shown in the page
          <img src={photo} alt="" style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, objectFit: 'cover' }} />
        )}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            display: 'flex',
            background: photo
              ? 'linear-gradient(90deg, rgba(8,16,31,0.94) 0%, rgba(8,16,31,0.7) 55%, rgba(8,16,31,0.3) 100%)'
              : 'radial-gradient(circle at 88% 0%, rgba(252,163,17,0.38) 0%, rgba(20,33,61,0) 52%), linear-gradient(135deg, #14213D 0%, #0B1226 100%)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', fontSize: 36, letterSpacing: -1, WebkitTextStroke: '1px #fff' }}>
              <span>cheap</span>
              <span style={{ color: AMBER }}>flights</span>
            </div>
            <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.8)', letterSpacing: 3 }}>{card.eyebrow.toUpperCase()}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {flag && (
                // eslint-disable-next-line @next/next/no-img-element -- drawn by ImageResponse, not shown in the page
                <img src={flag} alt="" width={96} height={72} style={{ marginRight: 28, borderRadius: 8 }} />
              )}
              <div style={{ display: 'flex', fontSize: titleSize, lineHeight: 1.05, letterSpacing: -2, WebkitTextStroke: '2px #fff' }}>{card.title}</div>
            </div>
            {card.line && <div style={{ display: 'flex', marginTop: 18, fontSize: 34, color: 'rgba(255,255,255,0.85)' }}>{card.line}</div>}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {card.price !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <div style={{ display: 'flex', fontSize: 40, color: 'rgba(255,255,255,0.8)', marginRight: 20 }}>from</div>
                <div style={{ display: 'flex', fontSize: 150, lineHeight: 1, color: AMBER, letterSpacing: -4, WebkitTextStroke: '5px #FCA311' }}>{`€${card.price}`}</div>
                {card.note && <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.75)', marginLeft: 24 }}>{card.note}</div>}
              </div>
            ) : (
              <div style={{ display: 'flex', fontSize: 30, color: AMBER }}>{isBrand ? 'Compare · Pick · Go' : ''}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 20, color: 'rgba(255,255,255,0.65)' }}>
              <div style={{ display: 'flex' }}>Cached prices: check the final price on the booking site</div>
              {credit && <div style={{ display: 'flex', marginTop: 6 }}>{credit}</div>}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )

  image.headers.set('Cache-Control', 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400')
  return image
}
