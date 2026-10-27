// Travelpayouts affiliate link for this site's Aviasales account.
// campaign_id/p/trs are fixed values generated for this project in the Travelpayouts dashboard.
const TP_MARKER = '765816'
const TP_CAMPAIGN_ID = '100'
const TP_P = '4114'
const TP_TRS = '588622'

// Takes the day and month straight from the "YYYY-MM-DD..." text so the link
// never depends on the server's or browser's timezone (new Date() could shift
// an early-morning departure to the previous day).
function ddmm(dateStr: string) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return ''
  return `${m[2]}${m[1]}`
}

function searchPath(origin: string, destination: string, departDate?: string, returnDate?: string) {
  let path = origin
  if (departDate) path += ddmm(departDate)
  path += destination
  if (departDate && returnDate) path += ddmm(returnDate)
  path += '1' // 1 passenger
  return path
}

export function buildBookingLink(
  origin: string,
  destination: string,
  departDate?: string,
  returnDate?: string
) {
  const searchUrl = `https://www.aviasales.com/search/${searchPath(origin, destination, departDate, returnDate)}`
  const u = encodeURIComponent(searchUrl)
  return `https://tp.media/r?campaign_id=${TP_CAMPAIGN_ID}&marker=${TP_MARKER}&p=${TP_P}&trs=${TP_TRS}&u=${u}`
}
