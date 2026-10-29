'use client'

import { useJson } from './useJson'
import type { DestinationCostsResponse } from './budget'

const NONE: DestinationCostsResponse['destinations'] = {}

/** The cost numbers of every destination we have them for (one small, cached request).
 * Pass false to skip the request (no budget set = no need for it). */
export function useDestinationCosts(enabled: boolean) {
  const { data, loading, error } = useJson<DestinationCostsResponse>(enabled ? '/api/destination-costs' : null)
  return { costs: data?.destinations ?? NONE, loading, error }
}
