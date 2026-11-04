import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSocketUrl } from './socketUrl.js'

test('local frontend connects to the Socket.IO worker, not the REST API', () => {
  for (const port of ['5173', '3000', '4173', '5000', '']) {
    assert.equal(resolveSocketUrl({ hostname: 'localhost', protocol: 'http:', port }), 'http://localhost:4000')
  }
  assert.equal(resolveSocketUrl({ hostname: '127.0.0.1', protocol: 'http:' }), 'http://127.0.0.1:4000')
  assert.equal(resolveSocketUrl({ hostname: '[::1]', protocol: 'http:' }), 'http://[::1]:4000')
})

test('deployed hosts retain the existing same-origin Socket.IO proxy', () => {
  assert.equal(resolveSocketUrl({ hostname: 'iot.example.com', protocol: 'https:', origin: 'https://iot.example.com' }), 'https://iot.example.com')
})

test('an explicit socket URL takes precedence', () => {
  assert.equal(resolveSocketUrl({ hostname: 'localhost', protocol: 'http:' }, 'https://socket.example.com'), 'https://socket.example.com')
})
