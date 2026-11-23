export function parseTcpMode(payload) {
  const raw = String(payload ?? '').trim()
  const parts = raw.split(',').map(part => part.trim())
  const port = Number(parts[0])
  const connectivityType = new Map([['0', 0], ['1', 1], ['ETH', 0], ['ETHERNET', 0], ['WIFI', 1]]).get(parts[1]?.toUpperCase())
  const valid = parts.length === 2 && /^\d+$/.test(parts[0]) && Number.isInteger(port) && port >= 1 && port <= 65535 && connectivityType !== undefined
  return { raw, port: valid ? port : null, connectivityType: valid ? connectivityType : null, valid }
}
