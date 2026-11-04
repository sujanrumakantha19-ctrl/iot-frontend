export const NETWORK_MODES = [
  { id: 'wifi', label: 'WiFi', icon: 'pi pi-wifi' },
  { id: 'eth', label: 'Ethernet', icon: 'pi pi-server' },
  { id: 'lte', label: 'LTE', icon: 'pi pi-mobile' },
]

export function normalizeNetworkMode(value) {
  const mode = String(value ?? '').trim().toLowerCase()
  return ({ wifi: 'wifi', 'wi-fi': 'wifi', eth: 'eth', ethernet: 'eth', lte: 'lte', none: 'none' })[mode] || null
}

export function parseNetworkChoice(payload) {
  const raw = String(payload ?? '').trim()
  const [modesText = '', priorityText = '', ...extra] = raw.split(',')
  const priority = priorityText.trim() ? priorityText.split('->').map(normalizeNetworkMode) : []
  const selection = modesText.trim().toLowerCase()
  let modes
  if (selection === 'both') {
    // Firmware reports "both,eth->wifi" rather than listing modes before
    // the comma. The priority chain identifies which interfaces were chosen.
    modes = priority.length >= 2 ? [...priority] : ['wifi', 'eth']
  } else if (['all', 'all three', 'all3', 'all 3', 'three'].includes(selection)) {
    modes = NETWORK_MODES.map(mode => mode.id)
  } else {
    modes = modesText.split('+').map(normalizeNetworkMode)
  }
  const validModes = modes.length > 0 && modes.every(mode => mode && mode !== 'none')
  const validPriority = priority.every(mode => mode && modes.includes(mode))
  const valid = !!raw && extra.length === 0 && validModes && validPriority &&
    new Set(modes).size === modes.length && new Set(priority).size === priority.length
  return { raw, modes: valid ? modes : [], priority: valid ? priority : [], valid }
}

export function parsePhysicalStatus(payload) {
  const raw = String(payload ?? '').trim()
  const mode = normalizeNetworkMode(raw)
  return { raw, mode, valid: mode !== null }
}

export function getActiveNetworkLabel(payload) {
  if (payload === null || payload === undefined) return 'Not read yet'
  const { raw, mode } = parsePhysicalStatus(payload)
  return ({ wifi: 'WiFi', eth: 'ETH', lte: 'LTE', none: 'None' })[mode] || raw || 'Unknown'
}
