export function parseTcpMode(payload) {
  const raw = String(payload ?? '').trim()
  const parts = raw.split(',').map(part => part.trim())
  const port = Number(parts[0])
  const connectivityType = Number(parts[1])
  const valid = parts.length === 2 && /^\d+$/.test(parts[0]) && Number.isInteger(port) && port >= 1 && port <= 65535 && ['0', '1'].includes(parts[1])
  return { raw, port: valid ? port : null, connectivityType: valid ? connectivityType : null, valid }
}
