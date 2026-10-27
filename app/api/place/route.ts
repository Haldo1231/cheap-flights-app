import { NextResponse } from 'next/server'
import { getCityInfo } from '../../geoData'

// City code -> city name + country (from Travelpayouts' cached reference data),
// so screens can say "Lisbon, Portugal" instead of "LIS".
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('city') || '').toUpperCase()
  if (!/^[A-Z0-9]{2,4}$/.test(code)) {
    return NextResponse.json({ error: 'Missing or invalid city' }, { status: 400 })
  }
  const info = await getCityInfo(code)
  return NextResponse.json({
    city: info ? { code: info.code, name: info.name } : null,
    country: info ? info.country : null,
  })
}
