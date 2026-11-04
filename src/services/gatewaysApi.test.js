import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

test('gateway save API exposes protocol acknowledgement on request while preserving existing callers', async () => {
  const gateway = { _id: 'gateway', protocol: 'tcp' }
  const response = { data: { success: true, gateway, protocolSync: { status: 'acknowledged' } } }
  const api = { post: async () => response, put: async () => response }
  const context = { api }
  const source = fs.readFileSync(new URL('./gatewaysApi.js', import.meta.url), 'utf8')
    .replace("import api from './axios'", '')
    .replace('export const gatewaysApi =', 'globalThis.gatewaysApi =')
  vm.runInNewContext(source, context)
  assert.equal(await context.gatewaysApi.create(gateway), gateway)
  assert.equal(await context.gatewaysApi.update('gateway', gateway), gateway)
  assert.equal(await context.gatewaysApi.create(gateway, { withProtocolStatus: true }), response.data)
  assert.equal(await context.gatewaysApi.update('gateway', gateway, { withProtocolStatus: true }), response.data)
})
