import { getCityInfo } from '../../geoData'
import { badRequest, cachedJson, cleanCode } from '../../lib/apiParams'

// City code -> city name + country (from Travelpayouts' cached reference data),
// so screens can say "Lisbon, Portugal" instead of "LIS".
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = cleanCode(searchParams.get('city'))
  if (!code) return badRequest('Missing or invalid city')
  const info = await getCityInfo(code)
  return cachedJson(
    {
      city: info ? { code: info.code, name: info.name } : null,
      country: info ? info.country : null,
    },
    86400
  )
}
