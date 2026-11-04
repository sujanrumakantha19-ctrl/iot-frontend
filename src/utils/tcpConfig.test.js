import test from 'node:test'
import assert from 'node:assert/strict'
import { isIPv4, importTcpRows, newTcpRow, parseTcpPayload, reconcileTcpGroups, retainTcpImportIdentities, validateTcpDevices, validateTcpGroups } from './tcpConfig.js'
const device = { deviceName: 'Device1', slaveId: 1, ipAddress: '192.168.1.10' }
const row = { ...newTcpRow(device, 1), address: 1024 }

test('TCP read decodes the exact seven-column firmware format without RTU serial settings', () => {
  const result = parseTcpPayload('T1,192.168.1.10,1,4,1024,i,1;T2,192.168.1.10,1,4,1025,f,2;')
  assert.equal(result.errors.length, 0)
  assert.equal(result.rows[0].parameterName, 'T1')
  assert.equal(result.rows[0].ipAddress, device.ipAddress)
  assert.equal(result.rows[1].dataType, 'f')
  assert.equal(Object.hasOwn(result.rows[0], 'baudRate'), false)
  assert.equal(Object.hasOwn(result.rows[0], 'serialConfig'), false)
  assert.equal(parseTcpPayload('P1,1,4,1024,i,1,12,8N1;').errors.length, 1)
})

test('device validation enforces unique IPv4, name and slave independently', () => {
  assert.equal(validateTcpDevices([device]).length, 0)
  assert.ok(validateTcpDevices([device, { ...device, slaveId: 2, deviceName: 'Device2' }]).length)
  assert.ok(validateTcpDevices([device, { ...device, ipAddress: '192.168.1.11', deviceName: 'Device2' }]).length)
  for (const ip of ['256.1.1.1', '192.168.1', '', '::1', '192.168.01.1']) assert.equal(isIPv4(ip), false)
})

test('TCP row creation uses T identifiers and preserves separate group ranges', () => {
  assert.equal(newTcpRow(device, 51).parameterName, 'T51')
  assert.equal(validateTcpGroups([{ groupNum: 2, rows: [{ ...row, parameterName: 'T51' }] }], [device], 1000).length, 0)
  assert.ok(validateTcpGroups([{ groupNum: 2, rows: [row] }], [device], 1000).length)
  assert.ok(validateTcpGroups([{ groupNum: 1, rows: [row, { ...row, parameterName: 'T2' }] }], [device], 1000).length)
})

test('TCP Excel import round trip keeps IP mappings, T names, zero scale and no serial fields', () => {
  const records = [{ 'Device Name': 'Device1', 'IP Address': device.ipAddress, 'Slave ID': 1, 'Group Name': 'G1', 'Parameter Name': 'T1', 'Function Code': 4, Address: 1024, 'Data Type': 'Int', Length: 1, 'Scale Factor': 0, Decimal: 'None' }]
  const result = importTcpRows(records, 1000)
  assert.equal(result.errors.length, 0)
  assert.equal(result.devices[0].ipAddress, device.ipAddress)
  assert.equal(result.groups[0].rows[0].scaleFactor, 0)
  assert.equal(result.groups[0].rows[0].parameterName, 'T1')
  assert.equal(Object.hasOwn(result.groups[0].rows[0], 'baudRate'), false)
  assert.ok(importTcpRows([{ ...records[0], 'Parameter Name': 'P1' }], 1000).errors.length)
  assert.ok(importTcpRows([{ ...records[0], 'Group Name': 'G2', 'Parameter Name': 'T51' }], 1000).errors.length)
})

test('reloading saved TCP groups follows stable device identity after every device field changes', () => {
  const original = { ...row, deviceId: 'stable-device' }
  const changed = { deviceId: 'stable-device', deviceName: 'Changed', slaveId: 7, ipAddress: '172.16.0.20' }
  const result = reconcileTcpGroups([{ groupNum: 1, rows: [original], dirty: false }], [changed])
  assert.equal(result[0].rows[0].deviceName, 'Changed')
  assert.equal(result[0].rows[0].ipAddress, '172.16.0.20')
  assert.equal(result[0].rows[0].slaveId, 7)
  assert.equal(result[0].rows[0].parameterName, 'T1')
  assert.equal(result[0].dirty, true)
  const unchanged = reconcileTcpGroups([{ groupNum: 1, rows: [original], dirty: false }], [{ ...device, deviceId: 'stable-device' }])
  assert.equal(unchanged[0].dirty, false)
  const removed = reconcileTcpGroups([{ groupNum: 1, rows: [original] }], [{ ...device, deviceId: 'different-device' }])
  assert.equal(removed[0].rows[0].deviceId, 'stable-device', 'must not silently bind a removed device to another device with the same slave ID')
})

test('reimporting the same TCP devices retains their identities across all imported rows', () => {
  const imported = { devices: [{ ...device, deviceId: 'temporary-import-id' }], groups: [{ groupNum: 1, rows: [{ ...row, deviceId: 'temporary-import-id' }, { ...row, parameterName: 'T2', address: 1025, deviceId: 'temporary-import-id' }] }] }
  const result = retainTcpImportIdentities(imported, [{ ...device, deviceId: 'saved-id' }])
  assert.equal(result.devices[0].deviceId, 'saved-id')
  assert.ok(result.groups[0].rows.every(item => item.deviceId === 'saved-id'))
  assert.equal(validateTcpGroups(result.groups, result.devices, 1000).length, 0)
})
