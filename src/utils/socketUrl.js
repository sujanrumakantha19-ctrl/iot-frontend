export function resolveSocketUrl(location, configuredUrl) {
  if (configuredUrl) return configuredUrl
  const hostname = location.hostname.replace(/^\[|\]$/g, '')
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    const host = hostname.includes(':') ? `[${hostname}]` : hostname
    return `${location.protocol}//${host}:4000`
  }
  return location.origin
}
