export const isIPv4 = value => {
  const parts = String(value ?? '').trim().split('.')
  return parts.length === 4 && parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
}
export const tcpDeviceId = () => globalThis.crypto?.randomUUID?.() || `tcp-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function reconcileTcpGroups(groups, devices) {
  return groups.map(group => {
    let changed = false
    const rows = group.rows.map(row => {
      const device = row.deviceId ? devices.find(item => item.deviceId === row.deviceId)
        : devices.find(item => item.deviceName === row.deviceName) || devices.find(item => Number(item.slaveId) === Number(row.slaveId)) || devices.find(item => item.ipAddress === row.ipAddress)
      if (!device) return row
      if (row.deviceName !== device.deviceName || Number(row.slaveId) !== Number(device.slaveId) || row.ipAddress !== device.ipAddress) changed = true
      return { ...row, ...device }
    })
    return { ...group, rows, dirty: !!group.dirty || changed }
  })
}

export function retainTcpImportIdentities(result, existingDevices) {
  const remapped = new Map()
  const devices = result.devices.map(device => {
    const existing = existingDevices.find(item => item.deviceName === device.deviceName && Number(item.slaveId) === Number(device.slaveId) && item.ipAddress === device.ipAddress)
    const deviceId = existing?.deviceId || device.deviceId
    remapped.set(device.deviceId, deviceId)
    return { ...device, deviceId }
  })
  const groups = result.groups.map(group => ({ ...group, rows: group.rows.map(row => ({ ...row, deviceId: remapped.get(row.deviceId) || row.deviceId })) }))
  return { devices, groups }
}
const integer = (value, min, max) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max

export function validateTcpDevices(devices) {
  const errors = [], names = new Set(), slaves = new Set(), ips = new Set()
  devices.forEach((device, index) => {
    const name = String(device.deviceName || '').trim(), ip = String(device.ipAddress || '').trim()
    if (!name || /\s/.test(name)) errors.push(`Device ${index + 1}: Enter a name without spaces.`)
    if (!integer(device.slaveId, 1, 247)) errors.push(`Device ${index + 1}: Slave ID must be 1–247.`)
    if (!isIPv4(ip)) errors.push(`Device ${index + 1}: Enter a valid IPv4 address.`)
    if (names.has(name) || slaves.has(Number(device.slaveId)) || ips.has(ip)) errors.push('Device names, Slave IDs and IP addresses must each be unique.')
    names.add(name); slaves.add(Number(device.slaveId)); ips.add(ip)
  })
  return errors
}

export function newTcpRow(device, number) {
  return { deviceId: device?.deviceId, deviceName: device?.deviceName || 'Device1', slaveId: device?.slaveId || 1, ipAddress: device?.ipAddress || '',
    parameterName: `T${number}`, functionCode: 4, address: '', dataType: 'i', length: 1, scaleFactor: 1, decimal: 'None', unit: '' }
}

export function validateTcpGroups(groups, devices, maxParameters) {
  const errors = [...validateTcpDevices(devices)], parameters = new Set(), numbers = new Set()
  if (!groups.length) errors.push('Create at least one TCP group.')
  if (groups.reduce((sum, group) => sum + group.rows.length, 0) > maxParameters) errors.push(`Gateway limit is ${maxParameters} TCP parameters.`)
  groups.forEach(group => {
    const capacity = Math.min(50, maxParameters - (group.groupNum - 1) * 50), addresses = new Set()
    if (!integer(group.groupNum, 1, Math.ceil(maxParameters / 50)) || numbers.has(group.groupNum)) errors.push('Invalid or duplicate group number.')
    numbers.add(group.groupNum)
    if (!group.rows.length || group.rows.length > capacity) errors.push(`G${group.groupNum} requires 1–${capacity} parameters.`)
    group.rows.forEach(row => {
      const match = String(row.parameterName).match(/^T([1-9]\d*)$/i)
      if (!match || Number(match[1]) <= (group.groupNum - 1) * 50 || Number(match[1]) > Math.min(group.groupNum * 50, maxParameters) || parameters.has(String(row.parameterName).toUpperCase())) errors.push(`G${group.groupNum}: Invalid or duplicate parameter ${row.parameterName}.`)
      parameters.add(String(row.parameterName).toUpperCase())
      const device = devices.find(item => (!row.deviceId || item.deviceId === row.deviceId) && Number(item.slaveId) === Number(row.slaveId) && item.deviceName === row.deviceName)
      if (!device) errors.push(`${row.parameterName}: Select a device from TCP Device List.`)
      if (!integer(row.address, 0, 65535)) errors.push(`${row.parameterName}: Address is required, from 0 to 65535.`)
      if (!integer(row.functionCode, 1, 255) || !integer(row.length, 1, 65535)) errors.push(`${row.parameterName}: Invalid function code or length.`)
      if (row.scaleFactor === '' || !Number.isFinite(Number(row.scaleFactor))) errors.push(`${row.parameterName}: Enter a valid scale factor.`)
      if (row.decimal !== 'None' && !integer(row.decimal, 0, 6)) errors.push(`${row.parameterName}: Invalid decimal precision.`)
      const key = `${row.slaveId}:${row.address}`
      if (row.address !== '' && addresses.has(key)) errors.push(`G${group.groupNum}: Duplicate address ${row.address} for Slave ID ${row.slaveId}.`)
      addresses.add(key)
    })
  })
  return [...new Set(errors)]
}

export function parseTcpPayload(payload) {
  let raw = String(payload || '').trim()
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1)
  const entries = raw.split(';').filter(entry => entry.trim())
  const rows = [], errors = []
  for (const entry of entries) {
    const fields = entry.split(',').map(field => field.trim())
    const [parameterName, ipAddress, slaveId, functionCode, address, dataType, length] = fields
    if (fields.length !== 7 || !/^T[1-9]\d*$/i.test(parameterName) || !isIPv4(ipAddress) || !integer(slaveId, 1, 247) || !integer(functionCode, 1, 255) || !integer(address, 0, 65535) || !integer(length, 1, 65535) || !['i', 'f'].includes(dataType.toLowerCase())) {
      errors.push(`Invalid board row: ${entry}`); continue
    }
    rows.push({ parameterName: parameterName.toUpperCase(), ipAddress, slaveId: Number(slaveId), functionCode: Number(functionCode),
      address: Number(address), dataType: dataType.toLowerCase(), length: Number(length) })
  }
  return { rows, errors }
}

export const TCP_HEADERS = ['Device Name', 'IP Address', 'Slave ID', 'Group Name', 'Parameter Name', 'Function Code', 'Address', 'Data Type', 'Length', 'Scale Factor', 'Decimal']
export function importTcpRows(records, maxParameters) {
  const groups = new Map(), devices = new Map(), errors = []
  records.forEach((record, index) => {
    const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.toLowerCase().replace(/[\s_-]+/g, ''), String(value ?? '').trim()]))
    const groupMatch = (normalized.groupname || normalized.group || '').match(/^(?:g|group\s*)?([1-9]\d*)$/i)
    if (!groupMatch) { errors.push(`Row ${index + 2}: Group Name must be G1, G2, etc.`); return }
    const groupNum = Number(groupMatch[1])
    const device = { deviceName: normalized.devicename || '', ipAddress: normalized.ipaddress || normalized.ip || '', slaveId: Number(normalized.slaveid) }
    const priorDevice = devices.get(device.deviceName)
    device.deviceId = priorDevice?.deviceId || tcpDeviceId()
    if (priorDevice && (priorDevice.ipAddress !== device.ipAddress || priorDevice.slaveId !== device.slaveId)) errors.push(`Row ${index + 2}: Inconsistent mapping for ${device.deviceName}.`)
    devices.set(device.deviceName, device)
    if (!groups.has(groupNum)) groups.set(groupNum, { groupNum, rows: [], publishStatus: 'draft', dirty: true })
    groups.get(groupNum).rows.push({ ...device, parameterName: (normalized.parametername || normalized.tagname || '').toUpperCase(),
      functionCode: Number(normalized.functioncode), address: normalized.address === '' || normalized.address == null ? '' : Number(normalized.address),
      dataType: ['float', 'f'].includes((normalized.datatype || '').toLowerCase()) ? 'f' : 'i',
      length: Number(normalized.length || 1), scaleFactor: normalized.scalefactor === '' || normalized.scalefactor == null ? 1 : Number(normalized.scalefactor),
      decimal: !normalized.decimal || normalized.decimal.toLowerCase() === 'none' ? 'None' : Number(normalized.decimal) })
    if (!['int', 'i', 'float', 'f'].includes((normalized.datatype || '').toLowerCase())) errors.push(`Row ${index + 2}: Data Type must be Int or Float.`)
  })
  const result = { devices: [...devices.values()], groups: [...groups.values()].sort((a, b) => a.groupNum - b.groupNum) }
  errors.push(...validateTcpGroups(result.groups, result.devices, maxParameters))
  const maxGroup = Math.max(0, ...result.groups.map(group => group.groupNum))
  for (let number = 1; number < maxGroup; number++) {
    const group = result.groups.find(item => item.groupNum === number)
    if (group?.rows.length !== 50) errors.push(`Fill G${number} with 50 parameters before importing later groups.`)
  }
  return { ...result, errors: [...new Set(errors)] }
}
