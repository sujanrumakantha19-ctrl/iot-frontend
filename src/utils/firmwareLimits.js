export const parameterLimit = gateway => Math.min(1000, gateway?.maxParameters || (gateway?.maxGroups ? gateway.maxGroups * 50 : 1000))

export function rtuFirmwareErrors(rows, groupNumber) {
  const errors = []
  if (groupNumber != null && (!Number.isInteger(Number(groupNumber)) || Number(groupNumber) < 1 || Number(groupNumber) > 20)) {
    errors.push('Firmware supports only G1–G20. Existing groups are preserved; remove unsupported groups from the database before publishing.')
  }
  for (const row of rows) {
    if (![3, 4].includes(Number(row.functionCode))) errors.push(`${row.parameterName}: Function code must be 3 or 4.`)
    if (![1, 2].includes(Number(row.length))) errors.push(`${row.parameterName}: Length must be 1 or 2.`)
  }
  return errors
}
