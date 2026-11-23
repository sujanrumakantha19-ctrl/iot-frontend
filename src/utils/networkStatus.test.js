import test from 'node:test'
import assert from 'node:assert/strict'
import { getActiveNetworkLabel, parseNetworkChoice, parsePhysicalStatus } from './networkStatus.js'

test('active network card displays saved interfaces with ETH for Ethernet', () => {
  for (const [payload, label] of [[null, 'Not read yet'], [undefined, 'Not read yet'], ['WiFi', 'WiFi'], ['ETH', 'ETH'], [' ethernet ', 'ETH'], ['LTE', 'LTE'], ['none', 'None'], ['future-interface', 'future-interface'], ['', 'Unknown']]) {
    assert.equal(getActiveNetworkLabel(payload), label)
  }
})

test('detailed physical responses keep the header interface separate from connection details', () => {
  for (const [payload, label, mode, details] of [
    ['WiFi,192.168.1.24,MySSID,mypassword', 'WiFi', 'wifi', { ipAddress: '192.168.1.24', ssid: 'MySSID', password: 'mypassword' }],
    ['ETH,Dynamic,192.168.1.15', 'ETH', 'eth', { addressMode: 'Dynamic', ipAddress: '192.168.1.15' }],
    ['ETH,Static,192.168.1.15', 'ETH', 'eth', { addressMode: 'Static', ipAddress: '192.168.1.15' }],
    ['LTE,jionet', 'LTE', 'lte', { apn: 'jionet' }],
    ['none', 'None', 'none', {}],
  ]) {
    const parsed = parsePhysicalStatus(payload)
    assert.equal(parsed.valid, true)
    assert.equal(parsed.mode, mode)
    assert.deepEqual(parsed.details, details)
    assert.equal(getActiveNetworkLabel(payload), label)
  }
})

test('WiFi raw response preview never exposes the returned password', () => {
  const parsed = parsePhysicalStatus('WiFi,192.168.1.24,MySSID,my,secret,password')
  assert.equal(parsed.details.password, 'my,secret,password')
  assert.equal(parsed.displayRaw, 'WiFi,192.168.1.24,MySSID,[hidden]')
  assert.ok(!parsed.displayRaw.includes('secret'))
  assert.equal(parsePhysicalStatus('WiFi,192.168.1.24,OpenWiFi,').details.password, '')
})

test('legacy and incomplete detail responses do not invent network values', () => {
  assert.deepEqual(parsePhysicalStatus('LTE').details, {})
  assert.deepEqual(parsePhysicalStatus('ETH,Dynamic,').details, { addressMode: 'Dynamic', ipAddress: '' })
  assert.deepEqual(parsePhysicalStatus(' WiFi , 192.168.1.24 , MySSID ').details, { ipAddress: '192.168.1.24', ssid: 'MySSID' })
  assert.equal(getActiveNetworkLabel('unknown,details'), 'unknown')
})

test('network parser supports every selected-mode combination and priority order', async () => {
  const modes = ['wifi', 'eth', 'lte']
  for (let mask = 1; mask < 8; mask++) {
    const selected = modes.filter((_, index) => mask & (1 << index))
    const priority = [...selected].reverse()
    const parsed = parseNetworkChoice(`${selected.join('+')},${priority.join('->')}`)
    assert.equal(parsed.valid, true)
    assert.deepEqual(parsed.modes, selected)
    assert.deepEqual(parsed.priority, priority)
    assert.equal(parseNetworkChoice(selected.join('+')).valid, true)
  }
  assert.deepEqual(parseNetworkChoice(' WiFi + Ethernet , ETH -> WIFI ').priority, ['eth', 'wifi'])
  for (const invalid of ['', 'satellite', 'wifi+wifi', 'wifi,eth->wifi', 'wifi,wifi->wifi', 'wifi,,extra']) {
    assert.equal(parseNetworkChoice(invalid).valid, false, invalid)
  }
})

test('active interface parser distinguishes WiFi, ETH, LTE, none, and malformed responses', async () => {
  for (const [payload, mode] of [['WiFi', 'wifi'], ['ETH', 'eth'], ['LTE', 'lte'], ['none', 'none'], [' Ethernet ', 'eth']]) {
    assert.equal(parsePhysicalStatus(payload).mode, mode)
    assert.equal(parsePhysicalStatus(payload).valid, true)
  }
  for (const payload of ['', 'connected', 'wifi+eth']) assert.equal(parsePhysicalStatus(payload).valid, false)
})

test('firmware both response displays the selected interfaces and their priority', () => {
  for (const [payload, expected] of [
    ['both,eth->wifi', ['eth', 'wifi']],
    ['both,wifi->eth', ['wifi', 'eth']],
    ['both,lte->wifi', ['lte', 'wifi']],
    ['both,eth->lte', ['eth', 'lte']],
    [' BOTH , ETH -> WiFi ', ['eth', 'wifi']],
    ['both,eth->wifi->lte', ['eth', 'wifi', 'lte']],
  ]) {
    const result = parseNetworkChoice(payload)
    assert.equal(result.valid, true, payload)
    assert.deepEqual(result.modes, expected)
    assert.deepEqual(result.priority, expected)
  }
  assert.deepEqual(parseNetworkChoice('both').modes, ['wifi', 'eth'])
})

test('all three selected interfaces are displayed independently of the one active interface', () => {
  for (const payload of ['all,lte->eth->wifi', 'all three,lte->eth->wifi', 'all3,lte->eth->wifi', 'three,lte->eth->wifi', 'wifi+eth+lte,lte->eth->wifi']) {
    const choice = parseNetworkChoice(payload)
    assert.equal(choice.valid, true, payload)
    assert.equal(choice.modes.length, 3)
    assert.deepEqual(choice.priority, ['lte', 'eth', 'wifi'])
  }
  assert.equal(parsePhysicalStatus('ETH').mode, 'eth')
  assert.equal(getActiveNetworkLabel('ETH'), 'ETH')
  for (const payload of ['both,eth->wifi', 'both', 'all', 'wifi+eth+lte']) {
    assert.equal(parsePhysicalStatus(payload).valid, false)
  }
})
