import test from 'node:test'
import assert from 'node:assert/strict'
import { gatewayWorkspaces, allowedGatewayWorkspace } from './gatewayProtocol.js'

test('ALL and legacy gateways retain both protocols and Settings', () => {
  for (const protocol of [undefined, 'all', null]) {
    assert.deepEqual(gatewayWorkspaces(protocol).map(item => item.id), ['rtu', 'tcp', 'settings'])
  }
})
test('single protocol selections hide the other workspace while preserving Settings', () => {
  assert.deepEqual(gatewayWorkspaces('rtu').map(item => item.id), ['rtu', 'settings'])
  assert.deepEqual(gatewayWorkspaces('tcp').map(item => item.id), ['tcp', 'settings'])
})
test('workspace selection falls back immediately when the stored protocol excludes it', () => {
  assert.equal(allowedGatewayWorkspace('rtu', 'tcp'), 'tcp')
  assert.equal(allowedGatewayWorkspace('tcp', 'rtu'), 'rtu')
  assert.equal(allowedGatewayWorkspace('settings', 'tcp'), 'settings')
  assert.equal(allowedGatewayWorkspace('tcp', 'all'), 'tcp')
})
