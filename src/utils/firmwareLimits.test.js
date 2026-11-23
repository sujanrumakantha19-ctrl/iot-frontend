import test from 'node:test'
import assert from 'node:assert/strict'
import { parameterLimit, rtuFirmwareErrors } from './firmwareLimits.js'
import { validateTcpGroups, importTcpRows } from './tcpConfig.js'

test('legacy limits are capped without changing the gateway or hiding saved row errors', () => {
  const gateway = { maxParameters: 5000, maxGroups: 100 }
  assert.equal(parameterLimit(gateway), 1000)
  assert.equal(gateway.maxParameters, 5000)
  assert.equal(parameterLimit({ maxParameters: 70 }), 70)
  assert.equal(parameterLimit(), 1000)
  assert.equal(rtuFirmwareErrors([{ parameterName: 'P1', functionCode: 4, length: 1 }], 20).length, 0)
  assert.match(rtuFirmwareErrors([], 21)[0], /G1–G20/)
  const rows = [{ parameterName: 'P1', functionCode: 6, length: 4 }]
  assert.equal(rtuFirmwareErrors(rows, 1).length, 2)
  assert.equal(rows[0].functionCode, 6)
  assert.equal(rows[0].length, 4)
})

test('TCP validation and spreadsheet imports reject G21 even under a legacy capacity', () => {
  const device = { deviceName: 'Device1', slaveId: 1, ipAddress: '192.168.1.10' }
  const rows = [{ ...device, parameterName: 'T1001', functionCode: 4, address: 100, length: 1, scaleFactor: 1, decimal: 'None' }]
  assert.ok(validateTcpGroups([{ groupNum: 21, rows }], [device], 5000).length)
  const result = importTcpRows([{ 'Device Name': 'Device1', 'Slave ID': '1', 'IP Address': device.ipAddress, 'Group Name': 'G21', 'Parameter Name': 'T1001', 'Function Code': '4', Address: '100', 'Data Type': 'Int', Length: '1' }], 5000)
  assert.ok(result.errors.length)
})
