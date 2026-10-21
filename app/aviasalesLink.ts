// Travelpayouts affiliate link for this site's Aviasales account.
// campaign_id/p/trs are fixed values generated for this project in the Travelpayouts dashboard.
const TP_MARKER = '765816'
const TP_CAMPAIGN_ID = '100'
const TP_P = '4114'
const TP_TRS = '588622'

function ddmm(dateStr: string) {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}${month}`
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
