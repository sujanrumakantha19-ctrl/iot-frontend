import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTcpMode } from './tcpMode.js'

test('TCP mode read accepts Ethernet and WiFi at valid port boundaries', () => {
  for (const port of [1, 502, 65535]) {
    for (const connectivityType of [0, 1]) {
      const result = parseTcpMode(` ${port} , ${connectivityType} `)
      assert.equal(result.valid, true)
      assert.equal(result.port, port)
      assert.equal(result.connectivityType, connectivityType)
    }
  }
})

test('malformed TCP mode readings do not overwrite the form with invented values', () => {
  for (const payload of ['', null, '502', '502,', ',0', '0,0', '65536,1', '1.5,0', '502,2', '502,wifi', '502,1,extra', 'abc,0']) {
    const result = parseTcpMode(payload)
    assert.equal(result.valid, false, String(payload))
    assert.equal(result.port, null)
    assert.equal(result.connectivityType, null)
  }
})
