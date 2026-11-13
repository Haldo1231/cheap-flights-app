// One door for every call to the Travelpayouts price service. The token travels in the X-Access-Token header,
// never in the address: addresses end up in logs and error messages, headers do not. `token` is TRAVELPAYOUTS_TOKEN.
export const TP_BASE = 'https://api.travelpayouts.com'

export type TpFetchInit = RequestInit & { next?: { revalidate?: number | false } }

export function tpFetch(url: string, token: string | undefined, init: TpFetchInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set('X-Access-Token', token)
  return fetch(url, { ...init, headers })
}
