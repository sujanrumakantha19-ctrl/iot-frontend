/**
 * Formats a telemetry parameter/tag label for display across all UI screens.
 * 
 * Rules:
 * 1. If a custom display label (`displayName`) is assigned and non-empty, use it.
 * 2. If NO custom display label is assigned (e.g. raw `P1`, `P2`, etc.):
 *    - If gateway prefix (or name) is available, format as: `P1 (GATEWAY_PREFIX)`
 *    - Otherwise, fallback to parameterName or topicName.
 * 
 * @param {Object} tag - The tag / parameter object.
 * @param {Object|string} [gateway] - Optional gateway object or prefix string.
 * @returns {string} The formatted display label.
 */
export function formatTagDisplayName(tag, gateway = null) {
  if (!tag) return ''

  const trimmedDisplay = (tag.displayName || '').trim()
  if (trimmedDisplay) {
    return trimmedDisplay
  }

  // Determine parameter identifier (e.g., 'P1', 'P2', 'temp_1')
  let rawParam = (tag.parameterName || tag.topicName || '').trim()
  if (!rawParam) rawParam = 'Tag'

  // Determine gateway prefix
  const gwPrefix =
    (typeof gateway === 'string' ? gateway : null) ||
    tag.gateway?.prefix ||
    tag.gatewayPrefix ||
    gateway?.prefix ||
    tag.gateway?.name ||
    gateway?.name ||
    ''

  if (gwPrefix) {
    return `${rawParam} (${gwPrefix})`
  }

  return rawParam
}

export default formatTagDisplayName
