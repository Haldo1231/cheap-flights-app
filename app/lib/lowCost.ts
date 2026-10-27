// IATA codes of well-known low-cost carriers. A fixed list on purpose: it works
// without any lookup and only contains airlines that are clearly low-cost, so
// an unknown airline simply gets no label instead of a wrong one.
const LOW_COST_CODES = new Set([
  'FR', // Ryanair
  'RK', // Ryanair UK
  'W6', // Wizz Air
  'W9', // Wizz Air UK
  'W4', // Wizz Air Malta
  '5W', // Wizz Air Abu Dhabi
  'U2', // easyJet
  'EC', // easyJet Europe
  'DS', // easyJet Switzerland
  'VY', // Vueling
  'V7', // Volotea
  'HV', // Transavia
  'TO', // Transavia France
  'PC', // Pegasus
  'LS', // Jet2
  'DY', // Norwegian
  'D8', // Norwegian Air Sweden
  'DI', // Norwegian Air UK
  'G9', // Air Arabia
  'FZ', // flydubai
  'F9', // Frontier
  'NK', // Spirit
  'WN', // Southwest
  '6E', // IndiGo
  'AK', // AirAsia
])

export function isLowCostCarrier(code: string | null | undefined): boolean {
  return !!code && LOW_COST_CODES.has(code.toUpperCase())
}
