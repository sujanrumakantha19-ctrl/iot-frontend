import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Dialog } from 'primereact/dialog'
import * as XLSX from 'xlsx'
import { gatewaysApi } from '../../services/gatewaysApi'
import { companiesApi } from '../../services/companiesApi'
import { getSocket } from '../../services/socketClient'
import { getSession } from '../../services/auth'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import CountdownModal from '../../components/shared/CountdownModal'
import GatewayNetworkPanel from '../../components/shared/GatewayNetworkPanel'
import ActiveNetworkCard from '../../components/shared/ActiveNetworkCard'
import TcpModeSelection from '../../components/shared/TcpModeSelection'
import TcpGatewayWorkspace from './TcpGatewayWorkspace'

const MAX_GROUP_SIZE = 50
const MAX_GROUPS_PER_GATEWAY = 20

const computeDeviceNameSpans = (rows) => {
  const map = new Map()
  let i = 0
  while (i < rows.length) {
    let j = i
    while (j + 1 < rows.length && rows[j + 1].deviceName === rows[i].deviceName) {
      j++
    }
    map.set(i, j - i + 1)
    i = j + 1
  }
  return map
}

const resolveSlaveConflicts = (rows) => {
  const updated = rows.map(r => ({ ...r }))
  const used = new Map()
  let i = 0
  while (i < updated.length) {
    const deviceName = updated[i].deviceName
    let slaveId = Number(updated[i].slaveId) || 1
    let j = i
    while (j + 1 < updated.length && updated[j + 1].deviceName === deviceName) {
      j++
    }
    let candidate = slaveId
    while (used.has(candidate) && used.get(candidate) !== deviceName) {
      candidate++
    }
    used.set(candidate, deviceName)
    for (let k = i; k <= j; k++) {
      updated[k].slaveId = candidate
    }
    i = j + 1
  }
  return updated
}

const getUsedSlaveIds = (rows, excludeDeviceName) => {
  const used = new Set()
  let i = 0
  while (i < rows.length) {
    let j = i
    while (j + 1 < rows.length && rows[j + 1].deviceName === rows[i].deviceName) {
      j++
    }
    if (rows[i].deviceName !== excludeDeviceName) {
      used.add(Number(rows[i].slaveId))
    }
    i = j + 1
  }
  return used
}

const BAUD_RATES = [110, 300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
const SERIAL_CONFIGS = ['8N1', '8E1', '8O1', '8N2', '7E1', '7O1', '7N1']

// Map 1-based hardware protocol index (1..15) or raw number to actual baud rate (e.g. 12 -> 115200, 115200 -> 115200)
const normalizeBaudRate = (rate) => {
  const num = Number(rate)
  if (isNaN(num) || num <= 0) return 115200
  if (num >= 1 && num <= 15) return BAUD_RATES[num - 1] || 115200
  if (BAUD_RATES.includes(num)) return num
  return 115200
}

// Map actual baud rate to its 1-based index (e.g. 115200 -> 12)
const getBaudRateIndex = (rate) => {
  const num = Number(rate)
  if (num >= 1 && num <= 15) return num
  const idx = BAUD_RATES.indexOf(num)
  return idx !== -1 ? idx + 1 : 12 // default to 12 (115200)
}

// Map 1-based index back to actual baud rate (e.g. 12 -> 115200)
const getBaudRateFromIndex = (index) => {
  return normalizeBaudRate(index)
}

// Map dataType "Int"/"Float" <-> "i"/"f"
const getDataTypeForMqtt = (type) => {
  if (!type) return 'i'
  const t = type.trim().toLowerCase()
  if (t === 'float' || t === 'f') return 'f'
  return 'i'
}

const getDataTypeForUi = (type) => {
  if (!type) return 'Int'
  const t = type.trim().toLowerCase()
  if (t === 'f' || t === 'float') return 'Float'
  return 'Int'
}

const parseConfigPayload = (payload) => {
  console.log('[parseConfigPayload] input:', JSON.stringify(payload))
  const raw = payload.trim()
  if (!raw) {
    console.warn('[parseConfigPayload] empty payload after trim')
    return []
  }

  const rowStrings = raw.split(';').filter(Boolean)
  console.log('[parseConfigPayload] row strings:', rowStrings)
  const rows = []

  for (const rowStr of rowStrings) {
    const cols = rowStr.split(',')
    console.log('[parseConfigPayload] cols:', cols)
    if (cols.length < 8) {
      console.warn('[parseConfigPayload] skipping row, expected at least 8 cols got', cols.length)
      continue
    }

    if (cols.length >= 10) {
      // Legacy 10-column payload
      rows.push({
        parameterName: cols[0].replace(/^[tp](\d+)$/i, 'P$1'),
        deviceName: '',
        slaveId: parseInt(cols[1], 10),
        functionCode: parseInt(cols[2], 10),
        address: parseInt(cols[3], 10),
        dataType: getDataTypeForUi(cols[4]),
        length: parseInt(cols[5], 10),
        scaleFactor: parseFloat(cols[6]),
        decimal: parseInt(cols[7], 10) === 0 ? 'None' : String(cols[7]),
        baudRate: getBaudRateFromIndex(cols[8]),
        serialConfig: cols[9] || '8N1'
      })
    } else {
      // New 8-column payload without scaleFactor & decimal over MQTT
      rows.push({
        parameterName: cols[0].replace(/^[tp](\d+)$/i, 'P$1'),
        deviceName: '',
        slaveId: parseInt(cols[1], 10),
        functionCode: parseInt(cols[2], 10),
        address: parseInt(cols[3], 10),
        dataType: getDataTypeForUi(cols[4]),
        length: parseInt(cols[5], 10),
        scaleFactor: null,
        decimal: null,
        baudRate: getBaudRateFromIndex(cols[6]),
        serialConfig: cols[7] || '8N1'
      })
    }
  }

  console.log('[parseConfigPayload] returning rows:', rows)
  return rows
}

const EMPTY_ROW = {
  deviceName: 'Device1',
  slaveId: 1,
  parameterName: 'P1',
  functionCode: 4,
  address: '',
  length: 1,
  dataType: 'Int',
  scaleFactor: 1,
  decimal: 'None',
  baudRate: 115200,
  serialConfig: '8N1'
}

const mapDbToUiRow = (r) => {
  if (!r) return { ...EMPTY_ROW }
  const parityChar = { 0: 'N', 1: 'E', 2: 'O' }[r.parity] || 'N'
  const serialConfig = r.serialConfig || `${r.dataBits || 8}${parityChar}${r.stopBits || 1}`
  return {
    ...r,
    dataType: getDataTypeForUi(r.dataType),
    baudRate: getBaudRateFromIndex(r.baudRate),
    decimal: r.decimal === 0 || r.decimal === undefined ? 'None' : String(r.decimal),
    serialConfig
  }
}

// ---- Excel/CSV Import Parser & Validator ----
const parseCSV = (text) => {
  const lines = text.split('\n')
  const results = []
  
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      headerIdx = i
      break
    }
  }
  
  if (headerIdx === -1) return { error: 'Empty file or paste content.' }
  
  const splitCSVRow = (row) => {
    const cols = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < row.length; i++) {
      const char = row[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    cols.push(current.trim())
    return cols
  }
  
  const headerCols = splitCSVRow(lines[headerIdx]).map(h => h.replace(/^\uFEFF/, '').replace(/["']/g, '').trim().toLowerCase())
  const headerAliases = {
    'device name': ['device name', 'devicename', 'device', 'dev name', 'node'],
    'slave id': ['slave id', 'slaveid', 'slave', 'slave no', 'slave_id'],
    'group name': ['group name', 'groupname', 'group', 'group no', 'group_name'],
    'parameter name': ['parameter name', 'parametername', 'parameter', 'param name', 'param', 'register name', 'tag'],
    'function code': ['function code', 'functioncode', 'function', 'fc', 'func code'],
    'address': ['address', 'addr', 'register address', 'reg address', 'modbus address'],
    'data type': ['data type', 'datatype', 'type', 'format'],
    'length': ['length', 'len', 'word count', 'words'],
    'scale factor': ['scale factor', 'scalefactor', 'scale', 'multiplier', 'factor'],
    'decimal': ['decimal', 'decimals', 'dec', 'precision'],
    'baud rate': ['baud rate', 'baudrate', 'baud', 'speed'],
    'serial config': ['serial config', 'serialconfig', 'serial', 'parity', 'config']
  }
  
  const headerMap = {}
  Object.entries(headerAliases).forEach(([standardName, aliases]) => {
    const idx = headerCols.findIndex(col => {
      const clean = col.replace(/[\s_-]+/g, '')
      return aliases.some(a => col === a || clean === a.replace(/[\s_-]+/g, ''))
    })
    headerMap[standardName] = idx
  })
  
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVRow(lines[i])
    if (cols.length < 3) continue
    
    const getVal = (name, fallbackIdx) => {
      const colIdx = headerMap[name] !== undefined ? headerMap[name] : -1
      const finalIdx = colIdx !== -1 ? colIdx : fallbackIdx
      return cols[finalIdx] !== undefined ? cols[finalIdx].replace(/["']/g, '').trim() : ''
    }
    
    results.push({
      rowNum: i + 1,
      deviceName: getVal('device name', 0),
      slaveId: getVal('slave id', 1),
      groupName: getVal('group name', 2),
      parameterName: getVal('parameter name', 3),
      functionCode: getVal('function code', 4),
      address: getVal('address', 5),
      dataType: getVal('data type', 6),
      length: getVal('length', 7),
      scaleFactor: getVal('scale factor', 8),
      decimal: getVal('decimal', 9),
      baudRate: getVal('baud rate', 10),
      serialConfig: getVal('serial config', 11)
    })
  }

  if (results.length === 0) {
    return { error: 'No valid data rows found in the uploaded document. Please check the header row and row values.' }
  }

  return { results, headers: headerCols }
}

const isAddressFilled = (address) => {
  return address !== '' && address !== null && address !== undefined && !isNaN(Number(address))
}

const findDuplicateAddressInGroup = (rows, slaveId, address, excludeIndex = -1) => {
  if (!isAddressFilled(address)) return null
  const sid = Number(slaveId)
  const addr = Number(address)
  for (let i = 0; i < rows.length; i++) {
    if (i === excludeIndex) continue
    const r = rows[i]
    if (!isAddressFilled(r.address)) continue
    if (Number(r.slaveId) === sid && Number(r.address) === addr) {
      return i
    }
  }
  return null
}

const getDuplicateAddressIndices = (rows) => {
  const seen = new Map()
  const duplicates = new Set()
  rows.forEach((row, idx) => {
    if (!isAddressFilled(row.address)) return
    const key = `${Number(row.slaveId)}:${Number(row.address)}`
    if (seen.has(key)) {
      duplicates.add(idx)
      duplicates.add(seen.get(key))
    } else {
      seen.set(key, idx)
    }
  })
  return duplicates
}

const validateGroupAddressUniqueness = (rows, groupLabel = 'Group') => {
  const errors = []
  const seen = new Map()
  rows.forEach((row, idx) => {
    if (!isAddressFilled(row.address)) return
    const key = `${Number(row.slaveId)}:${Number(row.address)}`
    if (seen.has(key)) {
      const firstIdx = seen.get(key)
      errors.push(
        `${groupLabel}: Duplicate address ${Number(row.address)} for Slave ID ${Number(row.slaveId)} (parameters ${rows[firstIdx].parameterName} and ${row.parameterName})`
      )
    } else {
      seen.set(key, idx)
    }
  })
  return errors
}

const collectGroupsAddressErrors = (allGroups, groupNums) => {
  const errors = []
  allGroups.forEach((group, g) => {
    const label = `G${groupNums[g] ?? g + 1}`
    errors.push(...validateGroupAddressUniqueness(group, label))
  })
  return errors
}

const ADDRESS_DUPLICATE_DEBOUNCE_MS = 3000

const validateParsedData = (rows, existingDevicesList = [], maxAllowedParams = 1000) => {
  const maxGroups = Math.ceil(maxAllowedParams / 50)
  const errors = []
  const warnings = []
  const deviceSlaves = new Map()
  const slaveDevices = new Map()
  const groupParams = new Map()
  const groupSlaveAddresses = new Map()
  const groupRowsMap = new Map() // gNum -> list of rows

  if (rows.length > maxAllowedParams) {
    errors.push(`Total parameters in CSV (${rows.length}) exceeds the maximum allowed limit of ${maxAllowedParams} parameters for this gateway.`)
  }

  // Seed existing devicesList mapping if available
  if (Array.isArray(existingDevicesList)) {
    existingDevicesList.forEach(d => {
      if (d.deviceName && d.slaveId != null) {
        const cleanName = String(d.deviceName).replace(/\s+/g, '')
        const sid = Number(d.slaveId)
        if (cleanName && !isNaN(sid)) {
          deviceSlaves.set(cleanName, sid)
          slaveDevices.set(sid, cleanName)
        }
      }
    })
  }

  rows.forEach((row) => {
    const rNum = row.rowNum

    if (!row.deviceName) errors.push(`Row ${rNum}: Device Name is required.`)
    if (!row.slaveId) errors.push(`Row ${rNum}: Slave ID is required.`)
    if (!row.groupName) errors.push(`Row ${rNum}: Group Name is required.`)
    if (!row.parameterName) errors.push(`Row ${rNum}: Parameter Name is required.`)

    const sid = parseInt(row.slaveId, 10)
    if (isNaN(sid) || sid < 1 || sid > 247) {
      errors.push(`Row ${rNum}: Slave ID must be a valid integer between 1 and 247.`)
    }

    const fc = parseInt(row.functionCode, 10)
    if (isNaN(fc) || (fc !== 3 && fc !== 4)) {
      errors.push(`Row ${rNum}: Function Code must be either 3 or 4.`)
    }

    const addr = parseInt(row.address, 10)
    if (isNaN(addr) || addr < 0) {
      errors.push(`Row ${rNum}: Address must be a valid non-negative integer.`)
    }

    const dt = (row.dataType || '').toLowerCase()
    if (!['int', 'float'].includes(dt)) {
      errors.push(`Row ${rNum}: Data Type must be either "Int" or "Float".`)
    }

    const len = parseInt(row.length, 10)
    if (isNaN(len) || len < 1) {
      errors.push(`Row ${rNum}: Length must be a positive integer.`)
    }

    const br = parseInt(row.baudRate, 10)
    if (isNaN(br) || !BAUD_RATES.includes(br)) {
      errors.push(`Row ${rNum}: Baud Rate ${row.baudRate} is invalid. Allowed: ${BAUD_RATES.join(', ')}.`)
    }

    if (!row.serialConfig || !ALLOWED_SERIAL_CONFIGS.includes(row.serialConfig.toUpperCase())) {
      errors.push(`Row ${rNum}: Serial Config "${row.serialConfig}" is invalid. Allowed: ${ALLOWED_SERIAL_CONFIGS.join(', ')}.`)
    }

    // Consistency check: Device Name <-> Slave ID must be 1-to-1
    if (row.deviceName && !isNaN(sid)) {
      const devName = row.deviceName.trim()
      if (deviceSlaves.has(devName) && deviceSlaves.get(devName) !== sid) {
        errors.push(`Row ${rNum}: Device Name "${devName}" is already mapped to Slave ID ${deviceSlaves.get(devName)}.`)
      } else {
        deviceSlaves.set(devName, sid)
      }

      if (slaveDevices.has(sid) && slaveDevices.get(sid) !== devName) {
        errors.push(`Row ${rNum}: Slave ID ${sid} is already mapped to Device Name "${slaveDevices.get(sid)}".`)
      } else {
        slaveDevices.set(sid, devName)
      }
    }

    // Group Number Normalization & Group Rows aggregation
    if (row.groupName) {
      const gMatch = row.groupName.trim().match(/^(?:group\s*|g)?([1-9]|[1-9][0-9]|100)$/i)
      const gNum = gMatch ? parseInt(gMatch[1], 10) : null
      if (!gMatch || !gNum || gNum > maxGroups) {
        errors.push(`Row ${rNum}: Group Name "${row.groupName}" is invalid. Must be G1 through G${maxGroups}.`)
      } else {
        if (!groupRowsMap.has(gNum)) {
          groupRowsMap.set(gNum, [])
        }
        groupRowsMap.get(gNum).push(row)

        // Parameter range validation: Group Gk must contain parameters P{(k-1)*50+1}..P{k*50}
        if (row.parameterName) {
          const pMatch = row.parameterName.trim().match(/^[tp](\d+)$/i)
          if (pMatch) {
            const pIdx = parseInt(pMatch[1], 10)
            const minP = (gNum - 1) * 50 + 1
            const maxP = Math.min(gNum * 50, maxAllowedParams)
            if (pIdx < minP || pIdx > maxP) {
              errors.push(`Row ${rNum}: Parameter "${row.parameterName.trim()}" is out of range for Group G${gNum}. Allowed range: P${minP}–P${maxP}.`)
            }
          }
        }
      }
    }

    if (row.groupName && row.parameterName) {
      const gName = row.groupName.trim()
      const pName = row.parameterName.trim()
      if (!groupParams.has(gName)) {
        groupParams.set(gName, new Set())
      }
      const set = groupParams.get(gName)
      if (set.has(pName)) {
        errors.push(`Row ${rNum}: Duplicate parameter "${pName}" found in Group "${gName}".`)
      } else {
        set.add(pName)
      }
    }

    if (row.groupName && !isNaN(sid) && !isNaN(addr) && addr >= 0) {
      const gName = row.groupName.trim()
      if (!groupSlaveAddresses.has(gName)) {
        groupSlaveAddresses.set(gName, new Map())
      }
      const slaveMap = groupSlaveAddresses.get(gName)
      if (!slaveMap.has(sid)) {
        slaveMap.set(sid, new Set())
      }
      const addrSet = slaveMap.get(sid)
      if (addrSet.has(addr)) {
        errors.push(`Row ${rNum}: Duplicate address ${addr} for Slave ID ${sid} in Group "${gName}".`)
      } else {
        addrSet.add(addr)
      }
    }
  })

  // Group limit & size limit checks
  const presentGroupNums = Array.from(groupRowsMap.keys()).sort((a, b) => a - b)

  for (const gNum of presentGroupNums) {
    const groupRows = groupRowsMap.get(gNum)
    const gMax = Math.min(50, Math.max(0, maxAllowedParams - (gNum - 1) * 50))
    if (groupRows.length > gMax) {
      const extras = groupRows.slice(gMax).map(r => r.parameterName || `Row ${r.rowNum}`).join(', ')
      errors.push(`Group G${gNum} exceeds maximum limit of ${gMax} parameters (found ${groupRows.length}). Extra parameters: ${extras}`)
    }
  }

  // Sequential Group Check: Gk requires G1..G{k-1} to exist and have full expected capacity
  if (presentGroupNums.length > 0) {
    const maxGNum = Math.max(...presentGroupNums)
    for (let g = 1; g < maxGNum; g++) {
      const count = groupRowsMap.get(g)?.length || 0
      const expectedG = Math.min(50, Math.max(0, maxAllowedParams - (g - 1) * 50))
      if (count < expectedG) {
        errors.push(`Group G${maxGNum} cannot be configured until Group G${g} has full ${expectedG} parameters (currently has ${count}).`)
      }
    }
  }

  return { errors, warnings }
}


export default function GatewayDetailPage({ managerMode = false }) {
  const { companyId, gatewayId } = useParams()
  const navigate = useNavigate()
  const session = getSession()
  const isManagerMode = managerMode || session?.role === 'manager'
  const featurePerms = session?.featurePermissions || {}
  const gatewayFeatures = featurePerms.gatewayFeatures || {}

  const TAB_DEFINITIONS = useMemo(() => [
    { idx: 0, label: 'Device List', permKey: 'showDeviceList' },
    { idx: 1, label: 'Publish', permKey: 'showPublish' },
    { idx: 2, label: 'ReadConfig', permKey: 'showReadConfig' },
    { idx: 3, label: 'Network', permKey: 'showWifi' },
    { idx: 4, label: 'Location', permKey: 'showLocation' },
    { idx: 5, label: 'Publish Interval', permKey: 'showPublishInterval' },
    { idx: 6, label: 'FOTA', permKey: null } // FOTA is strictly admin only!
  ], [])

  const visibleTabs = useMemo(() => {
    if (!isManagerMode) return TAB_DEFINITIONS
    return TAB_DEFINITIONS.filter(t => t.permKey && gatewayFeatures[t.permKey])
  }, [isManagerMode, gatewayFeatures, TAB_DEFINITIONS])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [gateway, setGateway] = useState(null)
  const [company, setCompany] = useState(null)

  // Excel / CSV Upload State
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMode, setImportMode] = useState('replace') // 'replace' is the only mode
  const [parsedRows, setParsedRows] = useState([])
  const [validationErrors, setValidationErrors] = useState([])
  const [validationWarnings, setValidationWarnings] = useState([])
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Devices mapping list state
  const [devicesList, setDevicesList] = useState([{ slaveId: 1, deviceName: 'Device1', baudRate: 115200, serialConfig: '8N1' }])
  const [savingDevices, setSavingDevices] = useState(false)
  const [confirmDeleteDeviceIdx, setConfirmDeleteDeviceIdx] = useState(null)
  const [linkedDeleteInfo, setLinkedDeleteInfo] = useState(null)
  const [deviceViewMode, setDeviceViewMode] = useState('grid')

  // Board publish status ('committed' | 'saved_only')
  const [publishStatus, setPublishStatus] = useState('committed')
  const [showChangelogModal, setShowChangelogModal] = useState(false)

  // Dynamic max parameters state
  const [editMaxParamsDialog, setEditMaxParamsDialog] = useState(false)
  const [newMaxParams, setNewMaxParams] = useState(1000)
  const [savingMaxParams, setSavingMaxParams] = useState(false)

  useEffect(() => {
    if (gateway?.maxParameters != null) {
      setNewMaxParams(gateway.maxParameters)
    } else if (gateway?.maxGroups != null) {
      setNewMaxParams(gateway.maxGroups * 50)
    }
  }, [gateway?.maxParameters, gateway?.maxGroups])

  const handleSaveMaxParams = async () => {
    const val = parseInt(newMaxParams, 10)
    if (isNaN(val) || val < 1 || val > 5000) {
      showToast({ severity: 'warn', summary: 'Invalid Limit', detail: 'Max parameters must be between 1 and 5000.' })
      return
    }
    if (val < totalParamCount) {
      showToast({ severity: 'warn', summary: 'Invalid Limit', detail: `Cannot set limit lower than current total parameters (${totalParamCount}).` })
      return
    }
    try {
      setSavingMaxParams(true)
      await gatewaysApi.update(gatewayId, { maxParameters: val })
      setGateway(prev => ({ ...prev, maxParameters: val, maxGroups: Math.ceil(val / 50) }))
      showToast({ severity: 'success', summary: 'Limit Updated', detail: `Maximum parameters limit set to ${val} (${Math.ceil(val / 50)} groups).` })
      setEditMaxParamsDialog(false)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Update Failed', detail: err.message })
    } finally {
      setSavingMaxParams(false)
    }
  }

  // Groups state — array of arrays
  const [groups, setGroups] = useState([[{ ...EMPTY_ROW }]])
  // Stable group numbers — groupNums[i] is the permanent G-number for groups[i]
  // e.g. [1, 2, 3]. Deleting G1 -> groups=[[G2 rows],[G3 rows]], groupNums=[2,3]
  const [groupNums, setGroupNums] = useState([1])
  // Per-group publish status keyed by stable groupNum
  // e.g. { 1: 'committed', 2: 'saved_only' }
  const [groupStatuses, setGroupStatuses] = useState({ 1: 'committed' })
  // Stable groupNums of groups that are deleted in DB but board hasn't confirmed yet
  const [pendingDeleteGroups, setPendingDeleteGroups] = useState(new Set())
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const [locationInput, setLocationInput] = useState('')
  const [retrievedLocation, setRetrievedLocation] = useState('')
  const [settingLocation, setSettingLocation] = useState(false)
  const [readingLocation, setReadingLocation] = useState(false)
  const [intervalInput, setIntervalInput] = useState('')
  const [retrievedInterval, setRetrievedInterval] = useState('')
  const [settingInterval, setSettingInterval] = useState(false)
  const [readingInterval, setReadingInterval] = useState(false)
  const [fotaUnlocked, setFotaUnlocked] = useState(false)
  const [fotaPasswordInput, setFotaPasswordInput] = useState('')
  const [fotaGatewayIdInput, setFotaGatewayIdInput] = useState('')
  const [uploadingFota, setUploadingFota] = useState(false)
  const [triggeringFota, setTriggeringFota] = useState(false)
  const [fotaDownloadUrl, setFotaDownloadUrl] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)


  // Action loading states
  const [publishing, setPublishing] = useState(false)
  const [readingConfig, setReadingConfig] = useState(false)
  const [testing, setTesting] = useState(false)
  const [checkingVersion, setCheckingVersion] = useState(false)
  const [countdown, setCountdown] = useState({ visible: false, title: '', subtitle: '' })

  // Action refs to ensure toast notifications only pop up for the initiating user
  const publishingRef = useRef(publishing)
  const readingConfigRef = useRef(readingConfig)
  const readingLocationRef = useRef(readingLocation)
  const readingIntervalRef = useRef(readingInterval)
  const triggeringFotaRef = useRef(triggeringFota)
  const devicesListRef = useRef(devicesList)

  useEffect(() => { publishingRef.current = publishing }, [publishing])
  useEffect(() => { readingConfigRef.current = readingConfig }, [readingConfig])
  useEffect(() => { readingLocationRef.current = readingLocation }, [readingLocation])
  useEffect(() => { readingIntervalRef.current = readingInterval }, [readingInterval])
  useEffect(() => { triggeringFotaRef.current = triggeringFota }, [triggeringFota])
  useEffect(() => { devicesListRef.current = devicesList }, [devicesList])

  // Remember each workspace's selection independently; switching never resets edits.
  const [activeTab, setActiveTab] = useState(0)
  const [settingsTab, setSettingsTab] = useState(3)
  const [protocol, setProtocol] = useState('rtu')
  const [tcpTab, setTcpTab] = useState('Mode Selection')
  const rtuTabs = visibleTabs.filter(tab => tab.idx < 3)
  const settingsTabs = visibleTabs.filter(tab => tab.idx >= 3)
  const selectedRtuTab = rtuTabs.find(tab => tab.idx === activeTab)?.idx ?? rtuTabs[0]?.idx ?? null
  const selectedSettingsTab = settingsTabs.find(tab => tab.idx === settingsTab)?.idx ?? settingsTabs[0]?.idx ?? null
  const workspaceTabs = protocol === 'settings' ? settingsTabs : rtuTabs
  const activeContentTab = protocol === 'settings' ? selectedSettingsTab : selectedRtuTab
  const tabClassName = (selected) => `px-5 py-2.5 text-xs font-bold uppercase tracking-wide cursor-pointer transition-all border-b-2 -mb-[1px] ${selected
    ? 'border-blue-600 text-blue-700 bg-white'
    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300 bg-slate-50'}`

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalGroupIndex, setModalGroupIndex] = useState(null)

  // Live read state
  const [liveReadRows, setLiveReadRows] = useState(null)
  const [liveReadGroups, setLiveReadGroups] = useState([])
  const [_liveReadRaw, setLiveReadRaw] = useState('')
  const [liveReadPartial, setLiveReadPartial] = useState(false)
  const [liveReadGroupProgress, setLiveReadGroupProgress] = useState(new Set())

  const groupsRef = useRef(groups)
  useEffect(() => { groupsRef.current = groups })

  const addressValidateTimersRef = useRef(new Map())

  useEffect(() => {
    const timers = addressValidateTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const getNextPNumber = (allGroups) => {
    let max = 0
    for (const group of allGroups) {
      for (const r of group) {
        const match = r.parameterName?.match(/^P(\d+)$/i)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > max) max = num
        }
      }
    }
    return max + 1
  }

  // ---- CSV Import Helper Functions ----
  const processImportText = (text) => {
    if (!text.trim()) {
      setParsedRows([])
      setValidationErrors([])
      setValidationWarnings([])
      return
    }
    const { results, error } = parseCSV(text)
    if (error) {
      setValidationErrors([error])
      setParsedRows([])
      return
    }
    const { errors, warnings } = validateParsedData(results, devicesList, maxAllowedParams)
    setParsedRows(results)
    setValidationErrors(errors)
    setValidationWarnings(warnings)
  }

  const handleFileProcess = async (file) => {
    if (!file) return
    const name = file.name || 'document'
    const ext = name.split('.').pop().toLowerCase()

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { type: 'array' })
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('The uploaded Excel file contains no worksheets.')
        }
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const csvText = XLSX.utils.sheet_to_csv(worksheet)
        if (!csvText || !csvText.trim()) {
          throw new Error(`The sheet "${firstSheetName}" is empty.`)
        }
        setImportText(csvText)
        processImportText(csvText)
        showToast({ severity: 'info', summary: 'Excel Loaded', detail: `Parsed sheet "${firstSheetName}" from ${name}.` })
      } else {
        const text = await file.text()
        if (!text || !text.trim()) {
          throw new Error('The uploaded file is empty.')
        }
        setImportText(text)
        processImportText(text)
        showToast({ severity: 'info', summary: 'CSV Loaded', detail: `Loaded ${name}.` })
      }
    } catch (err) {
      console.error('[DocumentUpload] File read error:', err)
      const msg = err.message || 'Failed to process uploaded file'
      setValidationErrors([`File read error: ${msg}`])
      setParsedRows([])
      showToast({ severity: 'error', summary: 'File Error', detail: msg })
    }
  }

  const handleImportFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleFileProcess(file)
    e.target.value = ''
  }

  const downloadExcelTemplate = () => {
    const data = [
      ['Device Name', 'Slave ID', 'Group Name', 'Parameter Name', 'Function Code', 'Address', 'Data Type', 'Length', 'Scale Factor', 'Decimal', 'Baud Rate', 'Serial Config'],
      ['Device1', 1, 'Electrical', 'P1', 4, 40001, 'Int', 1, 1, 'None', 115200, '8N1'],
      ['Device1', 1, 'Electrical', 'P2', 4, 40002, 'Float', 2, 0.1, 1, 115200, '8N1'],
      ['Device2', 2, 'Temperature', 'P1', 3, 30001, 'Int', 1, 1, 'None', 9600, '8E1']
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, `${gateway?.prefix || 'gateway'}_devices_template.xlsx`)
  }

  const handleExportLiveConfig = () => {
    if (!liveReadGroups || liveReadGroups.length === 0) {
      showToast({ severity: 'warn', summary: 'No Data', detail: 'No live configuration data available to export.' })
      return
    }

    const headers = [
      'Device Name',
      'Slave ID',
      'Group Name',
      'Parameter Name',
      'Function Code',
      'Address',
      'Data Type',
      'Length',
      'Scale Factor',
      'Decimal',
      'Baud Rate',
      'Serial Config'
    ].join(',')

    const slaveToNameMap = new Map((devicesList || []).map(d => [Number(d.slaveId), d.deviceName]))
    const rows = []
    liveReadGroups.forEach((group, groupIdx) => {
      if (!group) return
      const groupName = `G${groupIdx + 1}`
      group.forEach(r => {
        const devName = r.deviceName || slaveToNameMap.get(Number(r.slaveId)) || `Device${r.slaveId || 1}`
        const decVal = r.decimal === 'None' || r.decimal === undefined ? 'None' : String(r.decimal)
        const row = [
          devName,
          r.slaveId || 1,
          groupName,
          r.parameterName,
          r.functionCode || 4,
          r.address || 0,
          r.dataType || 'Int',
          r.length || 1,
          r.scaleFactor || 1,
          decVal,
          r.baudRate || 115200,
          r.serialConfig || '8N1'
        ].join(',')
        rows.push(row)
      })
    })

    if (rows.length === 0) {
      showToast({ severity: 'warn', summary: 'No Rows', detail: 'No parameter rows found in the live read data.' })
      return
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${gateway?.prefix || 'gateway'}_live_config_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast({ severity: 'success', summary: 'Export Success', detail: `Exported ${rows.length} parameter(s) from live read data.` })
  }

  const handleExportPublishConfig = () => {
    if (!groups || groups.length === 0) {
      showToast({ severity: 'warn', summary: 'No Data', detail: 'No configuration data available to export.' })
      return
    }

    const headers = [
      'Device Name',
      'Slave ID',
      'Group Name',
      'Parameter Name',
      'Function Code',
      'Address',
      'Data Type',
      'Length',
      'Scale Factor',
      'Decimal',
      'Baud Rate',
      'Serial Config'
    ].join(',')

    const rows = []
    groups.forEach((group, idx) => {
      if (!group) return
      const groupNum = groupNums[idx]
      const groupName = `G${groupNum}`
      group.forEach(r => {
        const decVal = r.decimal === 'None' || r.decimal === undefined ? 'None' : String(r.decimal)
        const row = [
          r.deviceName || '',
          r.slaveId || 1,
          groupName,
          r.parameterName,
          r.functionCode || 4,
          r.address !== '' && r.address !== null ? r.address : '',
          r.dataType || 'Int',
          r.length || 1,
          r.scaleFactor || 1,
          decVal,
          r.baudRate || 115200,
          r.serialConfig || '8N1'
        ].join(',')
        rows.push(row)
      })
    })

    if (rows.length === 0) {
      showToast({ severity: 'warn', summary: 'No Rows', detail: 'No parameter rows found in the configuration.' })
      return
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${gateway?.prefix || 'gateway'}_db_config_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast({ severity: 'success', summary: 'Export Success', detail: `Exported ${rows.length} parameter(s) from current DB configuration.` })
  }

  const handleApplyImport = () => {
    if (validationErrors.length > 0 || parsedRows.length === 0) {
      showToast({ severity: 'error', summary: 'Validation Failed', detail: 'Please fix all errors before importing.' })
      return
    }

    // 1. Devices Extraction
    const uniqueDevicesMap = new Map()
    parsedRows.forEach(row => {
      const devName = row.deviceName.trim().replace(/\s+/g, '')
      const sid = parseInt(row.slaveId, 10)
      const br = normalizeBaudRate(row.baudRate)
      const sc = row.serialConfig ? String(row.serialConfig).trim() : '8N1'
      uniqueDevicesMap.set(devName, { slaveId: sid, deviceName: devName, baudRate: br, serialConfig: sc })
    })

    let nextDevicesList = []
    if (importMode === 'replace') {
      uniqueDevicesMap.forEach((dev) => {
        nextDevicesList.push(dev)
      })
    } else {
      nextDevicesList = [...devicesList]
      uniqueDevicesMap.forEach((dev) => {
        const exists = nextDevicesList.find(d => d.deviceName === dev.deviceName || Number(d.slaveId) === dev.slaveId)
        if (!exists) {
          nextDevicesList.push(dev)
        }
      })
    }

    // 2. Groups Construction
    const groupedParams = {}
    parsedRows.forEach(row => {
      const gName = row.groupName.trim()
      if (!groupedParams[gName]) {
        groupedParams[gName] = []
      }
      
      const cleanRow = {
        deviceName: row.deviceName.trim().replace(/\s+/g, ''),
        slaveId: parseInt(row.slaveId, 10),
        parameterName: row.parameterName.trim(),
        functionCode: parseInt(row.functionCode, 10),
        address: parseInt(row.address, 10),
        dataType: getDataTypeForUi(row.dataType),
        length: parseInt(row.length, 10) || 1,
        scaleFactor: parseFloat(row.scaleFactor) || 1,
        decimal: row.decimal && row.decimal.toLowerCase() !== 'none' ? String(row.decimal) : 'None',
        baudRate: normalizeBaudRate(row.baudRate),
        serialConfig: row.serialConfig || '8N1'
      }
      groupedParams[gName].push(cleanRow)
    })

    let nextGroups = []
    let nextGroupNums = []
    let nextGroupStatuses = {}

    const sortedGroupKeys = Object.keys(groupedParams).sort((a, b) => {
      const numA = parseInt(String(a).replace(/^G/i, ''), 10) || 0
      const numB = parseInt(String(b).replace(/^G/i, ''), 10) || 0
      return numA - numB
    })

    if (importMode === 'replace') {
      sortedGroupKeys.forEach(gName => {
        const parsedNum = parseInt(String(gName).replace(/^G/i, ''), 10) || (nextGroupNums.length + 1)
        nextGroups.push(groupedParams[gName])
        nextGroupNums.push(parsedNum)
        nextGroupStatuses[parsedNum] = 'saved_only'
      })
    } else {
      nextGroups = [...groups]
      nextGroupNums = [...groupNums]
      nextGroupStatuses = { ...groupStatuses }

      for (const gName of sortedGroupKeys) {
        const parsedNum = parseInt(String(gName).replace(/^G/i, ''), 10) || (nextGroupNums.length > 0 ? Math.max(...nextGroupNums) + 1 : 1)
        if (nextGroupNums.includes(parsedNum)) {
          showToast({ severity: 'error', summary: 'Import Error', detail: `Group G${parsedNum} already exists. Cannot append duplicate group G${parsedNum}.` })
          return
        }
        nextGroups.push(groupedParams[gName])
        nextGroupNums.push(parsedNum)
        nextGroupStatuses[parsedNum] = 'saved_only'
      }
    }

    setDevicesList(nextDevicesList)
    setGroups(nextGroups)
    setGroupNums(nextGroupNums)
    setGroupStatuses(nextGroupStatuses)
    setPublishStatus('saved_only')
    setActiveGroupIndex(0)

    // Persist imported devices list to Gateway document in MongoDB immediately
    gatewaysApi.updateDevices(gatewayId, nextDevicesList).catch(err => {
      console.error('[ExcelImport] Auto-save devices failed:', err)
    })

    showToast({
      severity: 'success',
      summary: 'Data Imported',
      detail: `Successfully imported ${parsedRows.length} parameters. Review changes and save the list.`
    })
    
    setShowExcelModal(false)
    setImportText('')
    setParsedRows([])
  }

  const loadData = async ({ fullPage = false } = {}) => {
    try {
      if (fullPage) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      let matchGw = null
      let targetCompanyId = companyId

      if (isManagerMode) {
        matchGw = await gatewaysApi.getById(gatewayId)
        targetCompanyId = matchGw?.companyId ? String(matchGw.companyId) : null
      } else {
        const { gateways: gwList } = await gatewaysApi.getAll()
        matchGw = gwList.find(g => g._id === gatewayId)
      }

      if (!matchGw) throw new Error('Gateway not found')
      setGateway(matchGw)

      if (matchGw?.devices && matchGw.devices.length > 0) {
        setDevicesList(matchGw.devices)
      } else {
        setDevicesList([{ slaveId: 1, deviceName: 'Device1' }])
      }

      if (targetCompanyId) {
        try {
          const comp = await companiesApi.getDetail(targetCompanyId)
          if (comp?.company) {
            setCompany(comp.company)
            if (comp.company.name) {
              window.companyNameCache = { ...window.companyNameCache, [targetCompanyId]: comp.company.name }
            }
          }
        } catch (compErr) {
          setCompany({ _id: targetCompanyId, name: session?.companyName || 'Company' })
        }
      }

      if (matchGw?.name) {
        window.gatewayNameCache = { ...window.gatewayNameCache, [gatewayId]: matchGw.name }
      }
      window.dispatchEvent(new Event('breadcrumbs:update'))

      const config = await gatewaysApi.getConfig(gatewayId)

      // Reconstruct groups from saved config with stable groupNums
      let restoredGroups = []
      let restoredGroupNums = []
      let restoredGroupStatuses = {}

      if (config && config.groups && config.groups.length > 0) {
        // New format: groups stored as [{ groupNum, rows, publishStatus }]
        for (const g of config.groups) {
          const gNum = g.groupNum != null ? g.groupNum : (restoredGroupNums.length + 1)
          const rows = g.rows ? g.rows.map(r => mapDbToUiRow(r)) : []
          restoredGroups.push(rows)
          restoredGroupNums.push(gNum)
          // Per-group status: use g.publishStatus, fallback to config.publishStatus
          const gStatus = g.publishStatus || config.publishStatus || 'success'
          restoredGroupStatuses[gNum] = gStatus === 'success' ? 'committed' : 'saved_only'
        }
      } else if (config && config.rows && config.rows.length > 0) {
        // Legacy format: flat rows — wrap as single group G1
        restoredGroups = [config.rows.map(r => mapDbToUiRow(r))]
        restoredGroupNums = [1]
        restoredGroupStatuses[1] = config.publishStatus === 'success' ? 'committed' : 'saved_only'
      } else {
        restoredGroups = [[{ ...EMPTY_ROW }]]
        restoredGroupNums = [1]
        restoredGroupStatuses[1] = 'committed'
      }

      // Ensure at least one group with at least one row
      if (restoredGroups.length === 0) {
        restoredGroups = [[{ ...EMPTY_ROW }]]
        restoredGroupNums = [1]
        restoredGroupStatuses[1] = 'committed'
      }
      if (restoredGroups[0].length === 0) restoredGroups[0] = [{ ...EMPTY_ROW }]

      // Re-sync row deviceNames with gateway.devices based on slaveId
      const currentDevices = matchGw?.devices && matchGw.devices.length > 0
        ? matchGw.devices.map(d => ({
            slaveId: Number(d.slaveId),
            deviceName: d.deviceName,
            baudRate: normalizeBaudRate(d.baudRate),
            serialConfig: d.serialConfig || '8N1'
          }))
        : [{ slaveId: 1, deviceName: 'Device1', baudRate: 115200, serialConfig: '8N1' }]
      setDevicesList(currentDevices)

      const deviceMap = new Map(currentDevices.map(d => [Number(d.slaveId), d]))
      restoredGroups = restoredGroups.map(group =>
        group.map(row => {
          const sid = Number(row.slaveId)
          const matchedDev = deviceMap.get(sid)
          if (matchedDev) {
            return {
              ...row,
              deviceName: matchedDev.deviceName,
              baudRate: normalizeBaudRate(matchedDev.baudRate || row.baudRate),
              serialConfig: matchedDev.serialConfig || row.serialConfig || '8N1'
            }
          }
          return {
            ...row,
            baudRate: normalizeBaudRate(row.baudRate)
          }
        })
      )

      setGroups(restoredGroups)
      setGroupNums(restoredGroupNums)
      setGroupStatuses(restoredGroupStatuses)

      // Restore pendingBoardDeletes — groups deleted in DB but board hasn't confirmed yet
      if (config && config.pendingBoardDeletes && config.pendingBoardDeletes.length > 0) {
        setPendingDeleteGroups(new Set(config.pendingBoardDeletes.map(d => d.groupNum)))
      } else {
        setPendingDeleteGroups(new Set())
      }

      // Overall publish status: any group pending? show warning
      const allCommitted = Object.values(restoredGroupStatuses).every(s => s === 'committed')
      setPublishStatus(allCommitted ? 'committed' : 'saved_only')

    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshGatewayData = () => loadData({ fullPage: false })

  useEffect(() => {
    if (gatewayId) {
      loadData({ fullPage: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayId, companyId])

  // Socket listeners
  useEffect(() => {
    const socket = getSocket()
    console.log('[LiveRead] socket:', socket?.id, 'connected:', socket?.connected)
    if (!socket) {
      console.warn('[LiveRead] no socket available')
      return
    }

    const onConnect = () => console.log('[LiveRead] socket connected, id:', socket.id)
    const onDisconnect = (reason) => console.log('[LiveRead] socket disconnected:', reason)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    const handleConfigResponse = (data) => {
      console.log('[LiveRead] gateway:config-response received:', data)
      if (data.gatewayId === gatewayId) {
        if (readingConfigRef.current) {
          const recCount = data.receivedGroups?.length || liveReadGroupProgress.size || 0
          showToast({ severity: 'success', summary: 'Gateway Read Complete', detail: `Received ${recCount} group(s) from gateway` })
          setReadingConfig(false)
          setCountdown({ visible: false, title: '', subtitle: '' })
        }
        setLiveReadPartial(!!data.partial)
        setLiveReadRaw(data.payload)
        console.log('[LiveRead] raw payload:', data.payload)
        const parsed = parseConfigPayload(data.payload)
        console.log('[LiveRead] parsed rows:', parsed)
        if (parsed.length > 0) {
          // Device List & stored group enrichment for live read (deviceName, scaleFactor, decimal)
          const storedParamMap = new Map()
          const storedAddressMap = new Map()
          const allDbRows = groupsRef.current.flat()
          for (const group of groupsRef.current) {
            for (const row of group) {
              if (row.parameterName) {
                storedParamMap.set(row.parameterName.toLowerCase(), row)
              }
              if (row.topicName) {
                storedParamMap.set(row.topicName.toLowerCase(), row)
              }
              if (row.address !== undefined && row.address !== null && row.address !== '') {
                storedAddressMap.set(`${row.slaveId}_${row.address}`, row)
              }
            }
          }
          const slaveToNameMap = new Map((devicesListRef.current || []).map(d => [Number(d.slaveId), d.deviceName]))
          const enriched = parsed.map((row, rowIdx) => {
            const pKey = (row.parameterName || '').toLowerCase()
            const addrKey = `${row.slaveId}_${row.address}`
            const dbRow = storedParamMap.get(pKey) ||
                          storedAddressMap.get(addrKey) ||
                          allDbRows[rowIdx]

            return {
              ...row,
              deviceName: slaveToNameMap.get(Number(row.slaveId)) || dbRow?.deviceName || (row.slaveId ? `Device${row.slaveId}` : ''),
              scaleFactor: (row.scaleFactor !== null && row.scaleFactor !== undefined) ? row.scaleFactor : (dbRow?.scaleFactor ?? 1),
              decimal: (row.decimal !== null && row.decimal !== undefined) ? row.decimal : (dbRow?.decimal ?? 'None')
            }
          })
          console.log('[LiveRead] enriched rows:', enriched)
          setLiveReadRows(enriched)
        } else {
          console.warn('[LiveRead] parsed payload returned 0 rows')
        }
      }
    }

    const handleConfigGroupResponse = (data) => {
      console.log('[LiveRead] gateway:config-group-response received:', data)
      if (data.gatewayId === gatewayId) {
        const { groupIndex, payload } = data
        const groupNum = data.groupNum !== undefined ? data.groupNum : (groupIndex !== undefined ? groupIndex + 1 : 0)
        const groupIdx = groupNum > 0 ? groupNum - 1 : (groupIndex !== undefined ? groupIndex : 0)

        setLiveReadGroupProgress(prev => {
          const next = new Set(prev)
          next.add(groupNum)
          console.log('[LiveRead] group progress:', [...next])
          return next
        })

        if (payload) {
          const parsed = parseConfigPayload(payload)
          if (parsed.length > 0) {
            const targetDbGroup = groupsRef.current[groupIdx] || []
            const storedParamMap = new Map()
            const storedAddressMap = new Map()
            for (const group of groupsRef.current) {
              for (const row of group) {
                if (row.parameterName) {
                  storedParamMap.set(row.parameterName.toLowerCase(), row)
                }
                if (row.topicName) {
                  storedParamMap.set(row.topicName.toLowerCase(), row)
                }
                if (row.address !== undefined && row.address !== null && row.address !== '') {
                  storedAddressMap.set(`${row.slaveId}_${row.address}`, row)
                }
              }
            }
            const slaveToNameMap = new Map((devicesListRef.current || []).map(d => [Number(d.slaveId), d.deviceName]))
            const enriched = parsed.map((row, rowIdx) => {
              const pKey = (row.parameterName || '').toLowerCase()
              const addrKey = `${row.slaveId}_${row.address}`
              const dbRow = storedParamMap.get(pKey) ||
                            storedAddressMap.get(addrKey) ||
                            targetDbGroup[rowIdx]

              return {
                ...row,
                deviceName: slaveToNameMap.get(Number(row.slaveId)) || dbRow?.deviceName || (row.slaveId ? `Device${row.slaveId}` : ''),
                scaleFactor: (row.scaleFactor !== null && row.scaleFactor !== undefined) ? row.scaleFactor : (dbRow?.scaleFactor ?? 1),
                decimal: (row.decimal !== null && row.decimal !== undefined) ? row.decimal : (dbRow?.decimal ?? 'None')
              }
            })
            setLiveReadGroups(prev => {
              const next = [...prev]
              const idx = groupNum > 0 ? groupNum - 1 : (groupIndex !== undefined ? groupIndex : next.length)
              next[idx] = enriched
              return next
            })
          }
        }
      }
    }

    const handleNetworkPhysicalResponse = (data) => {
      if (String(data.gatewayId) !== String(gatewayId)) return
      setGateway(prev => prev ? {
        ...prev,
        activeNetwork: data.activeNetwork ?? String(data.payload ?? '').trim(),
        activeNetworkUpdatedAt: data.activeNetworkUpdatedAt || new Date().toISOString()
      } : prev)
    }

    const handleLocationResponse = (data) => {
      if (data.gatewayId === gatewayId) {
        const loc = (data.payload || '').trim()
        if (readingLocationRef.current) {
          showToast({ severity: 'success', summary: 'Location Read Success', detail: `Location updated & saved to DB: ${loc || 'N/A'}` })
          setReadingLocation(false)
          setCountdown({ visible: false, title: '', subtitle: '' })
        }
        setRetrievedLocation(loc)

        // MQTT saves the location before emitting this event. Update the card
        // directly; manager accounts cannot call the admin gateway update API.
        if (loc) setGateway(prev => prev ? { ...prev, location: loc.substring(0, 30) } : prev)
      }
    }

    const handleDelayResponse = (data) => {
      console.log('[MQTT] Received Delaydetails response payload:', data.payload)
      if (data.gatewayId === gatewayId) {
        if (readingIntervalRef.current) {
          showToast({ severity: 'success', summary: 'Interval Read Success', detail: 'Publish interval details received' })
          setReadingInterval(false)
          setCountdown({ visible: false, title: '', subtitle: '' })
        }
        const raw = String(data.payload || '').trim()
        const parts = raw.split(',').map(s => s.trim())
        const secVal = parts.find(p => !isNaN(Number(p)) && p !== '') || raw
        setRetrievedInterval(secVal)
      }
    }

    const handleFotaResponse = (data) => {
      console.log('[Socket] gateway:fota-response received:', data)
      if (data.gatewayId === gatewayId) {
        const status = String(data.payload || '').trim()
        if (status === '1') {
          showToast({ severity: 'success', summary: 'FOTA Board Confirmation', detail: 'Gateway board confirmed firmware download & flash success (status: 1).' })
        } else {
          const errMsg = (status === '0' || !status)
            ? 'Gateway board reported firmware flashing failure (status: 0).'
            : `Gateway board reported error status: ${status}`
          showToast({ severity: 'error', summary: 'FOTA Update Failed', detail: errMsg })
        }
      }
    }

    const handleSetconfigAck = (data) => {
      console.log('[Socket] gateway:setconfig-ack received:', data)
      if (data.gatewayId === gatewayId) {
        const gNum = data.groupNum
        if (gNum) {
          // Mark only the ACK'd group as committed
          setGroupStatuses(prev => {
            const next = { ...prev, [gNum]: 'committed' }
            // Recompute overall publishStatus
            const allCommitted = Object.values(next).length > 0 && Object.values(next).every(s => s === 'committed')
            setPublishStatus(allCommitted ? 'committed' : 'saved_only')
            return next
          })
          if (publishingRef.current) {
            showToast({ severity: 'success', summary: `G${gNum} ACK Received`, detail: `Gateway board confirmed G${gNum} configuration!` })
            setPublishing(false)
            setCountdown({ visible: false, title: '', subtitle: '' })
          }
        } else {
          console.warn('[Socket] ACK received without groupNum — ignoring bulk commit fallback.')
          showToast({ severity: 'warn', summary: 'ACK Warning', detail: 'Received ACK from gateway without group number segment; ignoring fallback.' })
        }
      }
    }

    const handleSetconfigDeleteAck = (data) => {
      console.log('[Socket] gateway:setconfig-delete-ack received:', data)
      if (data.gatewayId === gatewayId) {
        const gNum = data.groupNum
        setPendingDeleteGroups(prev => {
          const next = new Set(prev)
          next.delete(gNum)
          return next
        })
        if (publishingRef.current) {
          showToast({ severity: 'success', summary: `G${gNum} Delete Confirmed`, detail: `Board confirmed G${gNum} deleted successfully!` })
          setPublishing(false)
          setCountdown({ visible: false, title: '', subtitle: '' })
        }
      }
    }

    const handleGroupDeleted = (data) => {
      if (data.gatewayId === gatewayId) {
        refreshGatewayData()
      }
    }

    socket.on('gateway:config-response', handleConfigResponse)
    socket.on('gateway:config-group-response', handleConfigGroupResponse)
    socket.on('gateway:network-physical-response', handleNetworkPhysicalResponse)
    socket.on('gateway:location-response', handleLocationResponse)
    socket.on('gateway:delay-response', handleDelayResponse)
    socket.on('gateway:fota-response', handleFotaResponse)
    socket.on('gateway:setconfig-ack', handleSetconfigAck)
    socket.on('gateway:setconfig-delete-ack', handleSetconfigDeleteAck)
    socket.on('gateway:group-deleted', handleGroupDeleted)
    socket.on('dashboard:refresh-required', refreshGatewayData)

    return () => {
      socket.off('gateway:config-response', handleConfigResponse)
      socket.off('gateway:config-group-response', handleConfigGroupResponse)
      socket.off('gateway:network-physical-response', handleNetworkPhysicalResponse)
      socket.off('gateway:location-response', handleLocationResponse)
      socket.off('gateway:delay-response', handleDelayResponse)
      socket.off('gateway:fota-response', handleFotaResponse)
      socket.off('gateway:setconfig-ack', handleSetconfigAck)
      socket.off('gateway:setconfig-delete-ack', handleSetconfigDeleteAck)
      socket.off('gateway:group-deleted', handleGroupDeleted)
      socket.off('dashboard:refresh-required', refreshGatewayData)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayId])

  // ---- Row operations scoped to active group ----

  const maxAllowedParams = gateway?.maxParameters || (gateway?.maxGroups ? gateway.maxGroups * 50 : 1000)
  const maxAllowedGroups = Math.ceil(maxAllowedParams / 50)
  const totalParamCount = groups.reduce((acc, g) => acc + (g?.length || 0), 0)

  const getGroupMaxParams = (gNum) => {
    const num = Number(gNum) || 1
    return Math.min(50, Math.max(0, maxAllowedParams - (num - 1) * 50))
  }

  const activeRows = groups[activeGroupIndex] || []
  const activeGNum = groupNums[activeGroupIndex] || 1
  const activeGroupMaxParams = getGroupMaxParams(activeGNum)
  const isGroupFull = activeRows.length >= activeGroupMaxParams || totalParamCount >= maxAllowedParams

  const addDeviceGroup = () => {
    const targetGroupIdx = modalGroupIndex !== null ? modalGroupIndex : activeGroupIndex
    if (targetGroupIdx === null || !groups[targetGroupIdx]) return

    const gNum = groupNums[targetGroupIdx] || targetGroupIdx + 1
    const gMaxParams = getGroupMaxParams(gNum)
    const groupRows = groups[targetGroupIdx]

    if (groupRows.length >= gMaxParams || totalParamCount >= maxAllowedParams) {
      showToast({
        severity: 'warn',
        summary: 'Parameter Limit Reached',
        detail: `Group G${gNum} has reached its maximum capacity of ${gMaxParams} parameters (Gateway limit: ${maxAllowedParams}).`
      })
      return
    }

    // Determine devices currently present in this group
    const usedDeviceNamesInGroup = new Set(groupRows.map(r => r.deviceName))
    const usedSlaveIdsInGroup = new Set(groupRows.map(r => Number(r.slaveId)))

    // 1. Check if there is an existing configured device in devicesList not yet used in this group
    let chosenDev = (devicesList || []).find(d =>
      !usedDeviceNamesInGroup.has(d.deviceName) && !usedSlaveIdsInGroup.has(Number(d.slaveId))
    )

    // 2. If all devices from devicesList are already in this group (or devicesList is empty), create a new device
    if (!chosenDev) {
      const allUsedSlaves = new Set([
        ...(devicesList || []).map(d => Number(d.slaveId)),
        ...groups.flatMap(g => g.map(r => Number(r.slaveId)))
      ].filter(s => !isNaN(s) && s > 0))
      let nextSlave = 1
      while (allUsedSlaves.has(nextSlave)) nextSlave++

      const allUsedNames = new Set([
        ...(devicesList || []).map(d => d.deviceName),
        ...groups.flatMap(g => g.map(r => r.deviceName))
      ].filter(Boolean))
      let nextNum = 1
      while (allUsedNames.has(`Device${nextNum}`)) nextNum++
      const newDeviceName = `Device${nextNum}`

      chosenDev = {
        slaveId: nextSlave,
        deviceName: newDeviceName,
        baudRate: 115200,
        serialConfig: '8N1'
      }

      // Add new device to devicesList state and persist to database
      setDevicesList(prevList => {
        const nextList = [...prevList, chosenDev]
        gatewaysApi.updateDevices(gatewayId, nextList).catch(err => {
          console.error('Failed to auto-sync new device to gateway:', err)
        })
        return nextList
      })
    }

    // 3. Add the new device's first parameter row to the group
    setGroups(prev => {
      const current = prev.map(g => [...g])
      if (!current[targetGroupIdx]) return prev
      const currentGroupRows = current[targetGroupIdx]
      const nextP = getNextPNumber(prev)
      currentGroupRows.push({
        ...EMPTY_ROW,
        deviceName: chosenDev.deviceName,
        slaveId: Number(chosenDev.slaveId),
        baudRate: normalizeBaudRate(chosenDev.baudRate),
        serialConfig: chosenDev.serialConfig || '8N1',
        parameterName: `P${nextP}`,
        address: ''
      })
      current[targetGroupIdx] = currentGroupRows
      return current
    })

    showToast({
      severity: 'success',
      summary: 'Device Added',
      detail: `Added ${chosenDev.deviceName} (Slave ID: ${String(chosenDev.slaveId).padStart(2, '0')}) to group`
    })
  }

  const addRowToDevice = (startIndex) => {
    const targetGroupIdx = modalGroupIndex !== null ? modalGroupIndex : activeGroupIndex
    if (targetGroupIdx === null || !groups[targetGroupIdx]) return

    const gNum = groupNums[targetGroupIdx] || targetGroupIdx + 1
    const gMaxParams = getGroupMaxParams(gNum)
    const groupRows = groups[targetGroupIdx]

    if (groupRows.length >= gMaxParams || totalParamCount >= maxAllowedParams) {
      showToast({
        severity: 'warn',
        summary: 'Parameter Limit Reached',
        detail: `Group G${gNum} has reached its maximum capacity of ${gMaxParams} parameters (Gateway limit: ${maxAllowedParams}).`
      })
      return
    }

    setGroups(prev => {
      const current = prev.map(g => [...g])
      if (!current[targetGroupIdx]) return prev
      const curGroupRows = current[targetGroupIdx]
      const deviceName = curGroupRows[startIndex]?.deviceName ?? (devicesList[0]?.deviceName || 'Device1')
      const slaveId = curGroupRows[startIndex]?.slaveId ?? (devicesList[0]?.slaveId || 1)
      let end = startIndex
      while (end + 1 < curGroupRows.length && curGroupRows[end + 1]?.deviceName === deviceName) {
        end++
      }
      const nextP = getNextPNumber(prev)
      const newRow = {
        ...EMPTY_ROW,
        deviceName,
        slaveId: Number(slaveId),
        parameterName: `P${nextP}`,
        address: ''
      }
      curGroupRows.splice(end + 1, 0, newRow)
      current[targetGroupIdx] = curGroupRows
      return current
    })
  }

  const updateDeviceItemInListAndGroups = (idx, updatedFields) => {
    setDevicesList(prevList => {
      const oldDev = prevList[idx]
      if (!oldDev) return prevList

      const newDev = { ...oldDev, ...updatedFields }
      const newList = prevList.map((item, i) => i === idx ? newDev : item)

      const targetSlaveIds = new Set([Number(oldDev.slaveId), Number(newDev.slaveId)].filter(s => !isNaN(s)))
      const targetNames = new Set([oldDev.deviceName, newDev.deviceName].filter(Boolean))

      setGroups(prevGroups => {
        return prevGroups.map(group =>
          group.map(row => {
            const isSlaveMatch = targetSlaveIds.has(Number(row.slaveId))
            const isNameMatch = targetNames.has(row.deviceName)
            if (isSlaveMatch || isNameMatch) {
              return {
                ...row,
                slaveId: Number(newDev.slaveId),
                deviceName: newDev.deviceName,
                baudRate: normalizeBaudRate(newDev.baudRate),
                serialConfig: newDev.serialConfig || '8N1'
              }
            }
            return row
          })
        )
      })

      return newList
    })
  }

  const deleteRow = (index, groupIdx = null) => {
    const targetGroupIdx = groupIdx !== null ? groupIdx : (modalGroupIndex !== null ? modalGroupIndex : activeGroupIndex)
    setGroups(prev => {
      const current = prev.map(g => [...g])
      if (targetGroupIdx === null || !current[targetGroupIdx]) return prev
      const groupRows = current[targetGroupIdx]
      if (groupRows.length === 1) {
        showToast({ severity: 'warn', summary: 'Warning', detail: 'At least one Modbus parameter per group is required' })
        return prev
      }
      groupRows.splice(index, 1)
      current[targetGroupIdx] = groupRows
      return current
    })
  }

  const handleRowChange = (index, key, val) => {
    const targetGroupIdx = modalGroupIndex !== null ? modalGroupIndex : activeGroupIndex
    setGroups(prev => {
      const current = prev.map(g => [...g])
      if (targetGroupIdx === null || !current[targetGroupIdx]) return prev
      const groupRows = current[targetGroupIdx]
      const groupLabel = `G${groupNums[targetGroupIdx] ?? targetGroupIdx + 1}`

      if (key === 'dataType') {
        const isFloat = val === 'Float' || val === 'f'
        const newLen = isFloat ? 2 : 1
        groupRows[index] = { ...groupRows[index], dataType: val, length: newLen }
        current[targetGroupIdx] = groupRows
        return current
      }

      if (key === 'deviceName') {
        const matched = devicesList.find(d => d.deviceName === val)
        const newSlaveId = matched ? Number(matched.slaveId) : groupRows[index].slaveId
        const newBaudRate = matched && matched.baudRate ? normalizeBaudRate(matched.baudRate) : normalizeBaudRate(groupRows[index].baudRate)
        const newSerialConfig = matched && matched.serialConfig ? matched.serialConfig : groupRows[index].serialConfig
        const addr = groupRows[index].address
        if (isAddressFilled(addr) && findDuplicateAddressInGroup(groupRows, newSlaveId, addr, index) !== null) {
          showToast({
            severity: 'warn',
            summary: 'Duplicate Address',
            detail: `Slave ID ${newSlaveId} already uses address ${Number(addr)} in ${groupLabel}.`
          })
          return prev
        }
        groupRows[index] = {
          ...groupRows[index],
          deviceName: val,
          slaveId: newSlaveId,
          baudRate: newBaudRate,
          serialConfig: newSerialConfig
        }
        current[targetGroupIdx] = groupRows
        return current
      }

      if (key === 'slaveId') {
        const sid = Number(val)
        const matched = devicesList.find(d => Number(d.slaveId) === sid)
        const newDevName = matched ? matched.deviceName : groupRows[index].deviceName
        const newBaudRate = matched && matched.baudRate ? normalizeBaudRate(matched.baudRate) : normalizeBaudRate(groupRows[index].baudRate)
        const newSerialConfig = matched && matched.serialConfig ? matched.serialConfig : groupRows[index].serialConfig
        const addr = groupRows[index].address
        if (isAddressFilled(addr) && findDuplicateAddressInGroup(groupRows, sid, addr, index) !== null) {
          showToast({
            severity: 'warn',
            summary: 'Duplicate Address',
            detail: `Slave ID ${sid} already uses address ${Number(addr)} in ${groupLabel}.`
          })
          return prev
        }
        groupRows[index] = {
          ...groupRows[index],
          slaveId: sid,
          deviceName: newDevName,
          baudRate: newBaudRate,
          serialConfig: newSerialConfig
        }
        current[targetGroupIdx] = groupRows
        return current
      }

      groupRows[index] = { ...groupRows[index], [key]: val }
      current[targetGroupIdx] = groupRows
      return current
    })
  }

  const clearAddressValidateTimer = (groupIdx, rowIndex) => {
    const key = `${groupIdx}-${rowIndex}`
    const timer = addressValidateTimersRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      addressValidateTimersRef.current.delete(key)
    }
  }

  const handleAddressChange = (index, val) => {
    const targetGroupIdx = modalGroupIndex !== null ? modalGroupIndex : activeGroupIndex
    if (targetGroupIdx === null) return

    const previousAddress = groupsRef.current[targetGroupIdx]?.[index]?.address ?? ''
    const groupLabel = `G${groupNums[targetGroupIdx] ?? targetGroupIdx + 1}`

    handleRowChange(index, 'address', val)
    clearAddressValidateTimer(targetGroupIdx, index)

    if (!isAddressFilled(val)) return

    const timerKey = `${targetGroupIdx}-${index}`
    const timer = setTimeout(() => {
      addressValidateTimersRef.current.delete(timerKey)

      const latestGroups = groupsRef.current
      const groupRows = latestGroups[targetGroupIdx]
      const row = groupRows?.[index]
      if (!row || !isAddressFilled(row.address)) return

      if (findDuplicateAddressInGroup(groupRows, row.slaveId, row.address, index) === null) return

      showToast({
        severity: 'warn',
        summary: 'Duplicate Address',
        detail: `Slave ID ${Number(row.slaveId)} already uses address ${Number(row.address)} in ${groupLabel}.`
      })
      handleRowChange(index, 'address', previousAddress)
    }, ADDRESS_DUPLICATE_DEBOUNCE_MS)

    addressValidateTimersRef.current.set(timerKey, timer)
  }

  // ---- Group management ----

  const [confirmDeleteGroupIndex, setConfirmDeleteGroupIndex] = useState(null)

  const addGroup = () => {
    // Enforcement: Maximum dynamic groups and parameters limit per gateway
    if (groups.length >= maxAllowedGroups || totalParamCount >= maxAllowedParams) {
      showToast({
        severity: 'warn',
        summary: 'Limit Reached',
        detail: `This gateway has reached its maximum limit of ${maxAllowedParams} parameters (${maxAllowedGroups} groups). You cannot create more groups.`
      })
      return
    }

    // Enforcement: Check if last group has reached its maximum capacity
    if (groups.length > 0) {
      const lastGroupIndex = groups.length - 1
      const lastGroup = groups[lastGroupIndex]
      const lastGroupNum = groupNums[lastGroupIndex]
      const lastGroupExpectedMax = getGroupMaxParams(lastGroupNum)
      if (lastGroup && lastGroup.length < lastGroupExpectedMax) {
        showToast({
          severity: 'warn',
          summary: 'Group Limit Enforcement',
          detail: `Group G${lastGroupNum} currently has ${lastGroup.length}/${lastGroupExpectedMax} parameters. Fill Group G${lastGroupNum} to ${lastGroupExpectedMax} parameters before creating a new group!`
        })
        return
      }
    }

    // Assign next stable group number = max existing + 1
    const nextGroupNum = groupNums.length > 0 ? Math.max(...groupNums) + 1 : 1
    if (nextGroupNum > maxAllowedGroups) {
      showToast({
        severity: 'warn',
        summary: 'Group Limit Reached',
        detail: `Cannot create Group G${nextGroupNum}. Maximum group allowed for ${maxAllowedParams} parameters is G${maxAllowedGroups}.`
      })
      return
    }

    setGroupNums(prev => [...prev, nextGroupNum])
    setGroupStatuses(prev => ({ ...prev, [nextGroupNum]: 'committed' }))
    setGroups(prev => {
      const defaultDev = devicesList && devicesList.length > 0 ? devicesList[0] : { slaveId: 1, deviceName: 'Device1' }
      const nextP = getNextPNumber(prev)
      const newRow = { ...EMPTY_ROW, deviceName: defaultDev.deviceName, slaveId: Number(defaultDev.slaveId), parameterName: `P${nextP}` }
      return [...prev, [newRow]]
    })
    setActiveGroupIndex(groups.length)
  }

  const deleteGroup = async (idx, dbOnly = false) => {
    const groupNum = groupNums[idx]  // stable group number
    setConfirmDeleteGroupIndex(null)

    // Remove group from local state immediately
    setGroups(prev => prev.filter((_, i) => i !== idx))
    setGroupNums(prev => prev.filter((_, i) => i !== idx))
    setGroupStatuses(prev => {
      const next = { ...prev }
      delete next[groupNum]
      const remaining = Object.values(next)
      const allCommitted = remaining.length === 0 || remaining.every(s => s === 'committed')
      setPublishStatus(allCommitted ? 'committed' : 'saved_only')
      return next
    })
    if (activeGroupIndex >= idx && activeGroupIndex > 0) {
      setActiveGroupIndex(activeGroupIndex - 1)
    }

    try {
      if (!dbOnly) {
        setPublishing(true)
        setPendingDeleteGroups(prev => new Set([...prev, groupNum]))
        setCountdown({
          visible: true,
          title: `Deleting G${groupNum}`,
          subtitle: `Sending delete command to board (${gateway?.prefix}/Setconfig/G${groupNum}/Del). Waiting for board ACK on G${groupNum}/Del/Ack...`
        })
      }

      await gatewaysApi.deleteGroup(gatewayId, groupNum, dbOnly)
      showToast({
        severity: dbOnly ? 'success' : 'info',
        summary: dbOnly ? `G${groupNum} Deleted from DB` : `G${groupNum} Deleted in DB`,
        detail: dbOnly
          ? `G${groupNum} removed from database only (no MQTT message sent to board).`
          : `G${groupNum} removed from database. Waiting for board to confirm delete...`
      })
    } catch (err) {
      if (!dbOnly) {
        setPublishing(false)
        setCountdown({ visible: false, title: '', subtitle: '' })
      }
      showToast({ severity: 'error', summary: 'Delete Error', detail: err.message })
    }
  }


  // ---- Device List helpers & 500ms Auto-Save ----

  const initialDevicesLoadedRef = useRef(false)
  const lastSavedDevicesJsonRef = useRef('')

  const performSaveDevices = async (listToSave = devicesList, isAuto = false) => {
    if (!gatewayId || !listToSave || listToSave.length === 0) return

    for (let i = 0; i < listToSave.length; i++) {
      const d = listToSave[i]
      const name = d.deviceName ? String(d.deviceName).trim() : ''
      if (!name) {
        if (!isAuto) showToast({ severity: 'warn', summary: 'Validation Error', detail: `Device row #${i + 1}: Device Name is required` })
        return
      }
      if (/\s/.test(name)) {
        if (!isAuto) showToast({ severity: 'warn', summary: 'Space Not Allowed', detail: `Device Name "${name}" contains spaces! Spaces are not allowed.` })
        return
      }
    }

    const seenNames = new Set()
    for (let i = 0; i < listToSave.length; i++) {
      const d = listToSave[i]
      const name = String(d.deviceName).trim()
      if (seenNames.has(name)) {
        if (!isAuto) {
          showToast({
            severity: 'warn',
            summary: 'Duplicate Device Name',
            detail: `Duplicate device name "${d.deviceName}". Each device must have a unique name!`
          })
        }
        return
      }
      seenNames.add(name)
    }

    const seenSlaves = new Set()
    for (let i = 0; i < listToSave.length; i++) {
      const sid = Number(listToSave[i].slaveId)
      if (seenSlaves.has(sid)) {
        if (!isAuto) showToast({ severity: 'warn', summary: 'Duplicate Slave ID', detail: `Duplicate Slave ID ${sid} in Device List. Each device must have a unique Slave ID.` })
        return
      }
      seenSlaves.add(sid)
    }

    try {
      setSavingDevices(true)
      const sanitizedDevices = listToSave.map(d => ({
        ...d,
        baudRate: normalizeBaudRate(d.baudRate),
        serialConfig: d.serialConfig || '8N1'
      }))
      const res = await gatewaysApi.updateDevices(gatewayId, sanitizedDevices)
      const updatedDevices = (res.devices || sanitizedDevices).map(d => ({
        ...d,
        baudRate: normalizeBaudRate(d.baudRate),
        serialConfig: d.serialConfig || '8N1'
      }))

      // Sync parameter groups with updated device name, baudRate, and serialConfig mappings
      const devMap = new Map(updatedDevices.map(d => [Number(d.slaveId), d]))
      setGroups(prev => prev.map(group =>
        group.map(row => {
          const sid = Number(row.slaveId)
          const dev = devMap.get(sid)
          if (dev) {
            return {
              ...row,
              deviceName: dev.deviceName,
              baudRate: normalizeBaudRate(dev.baudRate),
              serialConfig: dev.serialConfig || row.serialConfig || '8N1'
            }
          }
          return row
        })
      ))

      if (!isAuto) {
        showToast({ severity: 'success', summary: 'Device List Saved', detail: 'Gateway device mappings saved & parameters synced successfully' })
      }
    } catch (err) {
      if (!isAuto) {
        showToast({ severity: 'error', summary: 'Save Error', detail: err.message || 'Failed to save devices' })
      }
    } finally {
      setSavingDevices(false)
    }
  }

  const handleSaveDevices = () => performSaveDevices(devicesList, false)

  // 500ms Auto-Save for Device List tab
  useEffect(() => {
    if (!gatewayId || !devicesList || devicesList.length === 0) return

    const jsonStr = JSON.stringify(devicesList)
    if (!initialDevicesLoadedRef.current) {
      initialDevicesLoadedRef.current = true
      lastSavedDevicesJsonRef.current = jsonStr
      return
    }

    if (jsonStr === lastSavedDevicesJsonRef.current) return

    const timer = setTimeout(() => {
      // Quiet validation check before sending update
      for (let i = 0; i < devicesList.length; i++) {
        const d = devicesList[i]
        const name = d.deviceName ? String(d.deviceName).trim() : ''
        if (!name || /\s/.test(name)) return
      }
      const seenNames = new Set()
      for (let i = 0; i < devicesList.length; i++) {
        const name = String(devicesList[i].deviceName).trim()
        if (seenNames.has(name)) return
        seenNames.add(name)
      }
      const seenSlaves = new Set()
      for (let i = 0; i < devicesList.length; i++) {
        const sid = Number(devicesList[i].slaveId)
        if (seenSlaves.has(sid)) return
        seenSlaves.add(sid)
      }

      lastSavedDevicesJsonRef.current = jsonStr
      performSaveDevices(devicesList, true)
    }, 500)

    return () => clearTimeout(timer)
  }, [devicesList, gatewayId])

  const handleDeviceDeleteRequest = (idx) => {
    if (devicesList.length === 1) {
      showToast({ severity: 'warn', summary: 'Warning', detail: 'At least one device is required in the list.' })
      return
    }

    const devToDelete = devicesList[idx]
    if (!devToDelete) return

    const occurrences = []
    groups.forEach((g, gIdx) => {
      g.forEach((r) => {
        if (r.deviceName === devToDelete.deviceName || Number(r.slaveId) === Number(devToDelete.slaveId)) {
          occurrences.push({ groupNum: gIdx + 1, param: r.parameterName })
        }
      })
    })

    if (occurrences.length > 0) {
      setLinkedDeleteInfo({
        idx,
        device: devToDelete,
        occurrences
      })
    } else {
      setConfirmDeleteDeviceIdx(idx)
    }
  }

  const handleConfirmLinkedDelete = async () => {
    if (!linkedDeleteInfo) return
    const { idx, device, occurrences } = linkedDeleteInfo
    setLinkedDeleteInfo(null)

    const nextDevices = devicesList.filter((_, i) => i !== idx)
    setDevicesList(nextDevices)

    // Filter rows per group, remove empty groups; preserve stable groupNums
    const nextGroupsWithNums = groups.map((g, gi) => ({
      groupNum: groupNums[gi],
      rows: g.filter(r => r.deviceName !== device.deviceName && Number(r.slaveId) !== Number(device.slaveId))
    })).filter(g => g.rows.length > 0)

    const finalGroupsWithNums = nextGroupsWithNums.length > 0
      ? nextGroupsWithNums
      : [{ groupNum: groupNums[0] || 1, rows: [{ ...EMPTY_ROW }] }]

    setGroups(finalGroupsWithNums.map(g => g.rows))
    setGroupNums(finalGroupsWithNums.map(g => g.groupNum))
    setGroupStatuses(prev => {
      const next = { ...prev }
      for (const g of finalGroupsWithNums) next[g.groupNum] = 'saved_only'
      return next
    })

    try {
      await gatewaysApi.updateDevices(gatewayId, nextDevices)

      const addressDupErrors = finalGroupsWithNums.flatMap(g =>
        validateGroupAddressUniqueness(g.rows, `G${g.groupNum}`)
      )
      if (addressDupErrors.length > 0) {
        showToast({ severity: 'warn', summary: 'Duplicate Address', detail: addressDupErrors[0] })
        return
      }

      setPublishing(true)
      setPublishStatus('saved_only')
      setCountdown({
        visible: true,
        title: 'Deleting Device & Linked Parameters',
        subtitle: `Device '${device.deviceName}' & ${occurrences.length} linked parameter(s) removed. Re-publishing updated configuration over MQTT...`
      })

      const mappedGroups = finalGroupsWithNums.map(g => ({
        groupNum: g.groupNum,
        rows: g.rows.map(row => ({
          ...row,
          address: Number(row.address),
          dataType: getDataTypeForMqtt(row.dataType),
          baudRate: normalizeBaudRate(row.baudRate),
          decimal: (row.decimal !== undefined && row.decimal !== null && String(row.decimal).toLowerCase() !== 'none') ? Number(row.decimal) : 'None'
        }))
      }))

      await gatewaysApi.publishConfig(gatewayId, mappedGroups)
      showToast({ severity: 'success', summary: 'Device & Parameters Removed', detail: `Device '${device.deviceName}' and ${occurrences.length} linked parameters deleted from DB & re-published.` })
    } catch (err) {
      setPublishing(false)
      setCountdown({ visible: false, title: '', subtitle: '' })
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to sync deletion with database' })
    }
  }


  // Publish ALL groups (global publish — from warning banner or top-level button)
  const handlePublishConfig = async () => {
    if (groups.length === 0) {
      showToast({ severity: 'error', summary: 'Validation Error', detail: 'At least one Modbus group is required to publish.' })
      return
    }

    const addressDupErrors = collectGroupsAddressErrors(groups, groupNums)
    if (addressDupErrors.length > 0) {
      for (let g = 0; g < groups.length; g++) {
        if (validateGroupAddressUniqueness(groups[g], `G${groupNums[g]}`).length > 0) {
          setActiveGroupIndex(g)
          break
        }
      }
      showToast({ severity: 'warn', summary: 'Duplicate Address', detail: addressDupErrors[0] })
      return
    }

    // Validate empty/invalid address across all groups and rows
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g]
      const gNum = groupNums[g]
      for (let r = 0; r < group.length; r++) {
        const row = group[r]
        if (row.address === '' || row.address === null || row.address === undefined || isNaN(Number(row.address))) {
          setActiveGroupIndex(g)
          showToast({
            severity: 'warn',
            summary: 'Address Required',
            detail: `Group G${gNum}, Parameter ${row.parameterName} (${row.deviceName}): Please enter a valid Address before publishing.`
          })
          return
        }
      }
    }

    try {
      setPublishing(true)
      // Mark all groups as saved_only
      setGroupStatuses(prev => {
        const next = { ...prev }
        for (const gn of groupNums) next[gn] = 'saved_only'
        return next
      })
      setPublishStatus('saved_only')
      setCountdown({
        visible: true,
        title: 'Publishing to Board',
        subtitle: `Publishing ${groups.length} group(s) via MQTT. Waiting for board ACK per group...`
      })

      const mappedGroups = groups.map((group, i) => ({
        groupNum: groupNums[i],
        rows: group.map(row => ({
          ...row,
          address: Number(row.address),
          dataType: getDataTypeForMqtt(row.dataType),
          baudRate: normalizeBaudRate(row.baudRate),
          decimal: (row.decimal !== undefined && row.decimal !== null && String(row.decimal).toLowerCase() !== 'none') ? Number(row.decimal) : 'None'
        }))
      }))
      const result = await gatewaysApi.publishConfig(gatewayId, mappedGroups)
      showToast({ severity: 'info', summary: 'Config Saved in DB', detail: `Published ${result.groupCount || groups.length} group(s). Waiting for board ACK per group...` })
    } catch (err) {
      setPublishing(false)
      setCountdown({ visible: false, title: '', subtitle: '' })
      showToast({ severity: 'error', summary: 'Publish Error', detail: err.message })
    }
  }

  // Publish a single group by stable groupNum (used from group modal publish button)
  const handlePublishGroup = async (groupNum) => {
    const idx = groupNums.indexOf(groupNum)
    if (idx === -1) return
    const group = groups[idx]

    const addressDupErrors = validateGroupAddressUniqueness(group, `G${groupNum}`)
    if (addressDupErrors.length > 0) {
      showToast({ severity: 'warn', summary: 'Duplicate Address', detail: addressDupErrors[0] })
      return
    }

    // Validate addresses
    for (let r = 0; r < group.length; r++) {
      const row = group[r]
      if (row.address === '' || row.address === null || row.address === undefined || isNaN(Number(row.address))) {
        showToast({
          severity: 'warn',
          summary: 'Address Required',
          detail: `G${groupNum}, Parameter ${row.parameterName}: Please enter a valid Address before publishing.`
        })
        return
      }
    }

    try {
      setPublishing(true)
      setGroupStatuses(prev => ({ ...prev, [groupNum]: 'saved_only' }))
      setPublishStatus('saved_only')
      setCountdown({
        visible: true,
        title: `Publishing G${groupNum}`,
        subtitle: `Publishing G${groupNum} to ${gateway?.prefix}/Setconfig/G${groupNum}. Waiting for board ACK on G${groupNum}/Ack...`
      })

      const mappedRows = group.map(row => ({
        ...row,
        address: Number(row.address),
        dataType: getDataTypeForMqtt(row.dataType),
        baudRate: normalizeBaudRate(row.baudRate),
        decimal: (row.decimal !== undefined && row.decimal !== null && String(row.decimal).toLowerCase() !== 'none') ? Number(row.decimal) : 'None'
      }))
      await gatewaysApi.publishGroup(gatewayId, groupNum, mappedRows)
      showToast({ severity: 'info', summary: `G${groupNum} Saved in DB`, detail: `G${groupNum} sent to board. Waiting for ACK...` })
    } catch (err) {
      setPublishing(false)
      setCountdown({ visible: false, title: '', subtitle: '' })
      showToast({ severity: 'error', summary: 'Publish Error', detail: err.message })
    }
  }

  const handleCancelCountdown = () => {
    if (countdown.visible && publishing) {
      setPublishStatus('saved_only')
      showToast({
        severity: 'warn',
        summary: 'ACK Timeout',
        detail: 'Config saved in DB, but gateway board did not acknowledge within 10s. Marked as saved (not board-confirmed).'
      })
    }
    setCountdown({ visible: false, title: '', subtitle: '' })
    setPublishing(false)
    setReadingLocation(false)
    setReadingConfig(false)
    setTesting(false)
    setCheckingVersion(false)
    setReadingInterval(false)
    setTriggeringFota(false)
  }

  const handleReadConfig = async () => {
    try {
      setReadingConfig(true)
      setLiveReadGroupProgress(new Set())
      setLiveReadGroups([])
      setCountdown({
        visible: true,
        title: 'Reading Configuration',
        subtitle: 'Requesting G1 to G20 group parameter configurations from gateway over MQTT, waiting for replies...'
      })
      const latestConfig = await gatewaysApi.getConfig(gatewayId)
      const groupCount = Math.max(latestConfig?.groupCount || 0, 20)
      await gatewaysApi.readConfig(gatewayId, groupCount)
      showToast({ severity: 'info', summary: 'Trigger Sent', detail: 'Requesting G1 to G20 groups from gateway...' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Read Error', detail: err.message })
      setReadingConfig(false)
      setCountdown({ visible: false, title: '', subtitle: '' })
    }
  }

  const handleSetLocation = async () => {
    if (!locationInput.trim()) {
      showToast({ severity: 'warn', summary: 'Input Required', detail: 'Please enter a location value' })
      return
    }
    try {
      setSettingLocation(true)
      await gatewaysApi.setLocationMqtt(gatewayId, locationInput.trim().substring(0, 30))
      showToast({ severity: 'info', summary: 'Trigger Sent', detail: 'Publishing SetLocation instruction to board...' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Set Location Error', detail: err.message })
    } finally {
      setSettingLocation(false)
    }
  }

  const handleReadLocation = async () => {
    try {
      setReadingLocation(true)
      setRetrievedLocation('')
      setCountdown({
        visible: true,
        title: 'Reading Location Details',
        subtitle: 'Querying current location name from gateway over MQTT, waiting for reply...'
      })
      await gatewaysApi.queryLocationDetails(gatewayId)
      showToast({ severity: 'info', summary: 'Trigger Sent', detail: 'Querying location details over MQTT...' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Read Location Error', detail: err.message })
      setReadingLocation(false)
      setCountdown({ visible: false, title: '', subtitle: '' })
    }
  }

  const handleSetInterval = async () => {
    const delaySec = intervalInput.trim()
    if (!delaySec) {
      showToast({ severity: 'warn', summary: 'Input Required', detail: 'Please enter a publish interval value in seconds' })
      return
    }
    const val = Number(delaySec)
    if (isNaN(val) || !Number.isInteger(val) || val < 1 || val > 600) {
      showToast({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Publish interval must be a valid whole number between 1 and 600 seconds.'
      })
      return
    }
    console.log('[MQTT] Setting Delay payload (seconds):', val)
    try {
      setSettingInterval(true)
      await gatewaysApi.setDelayMqtt(gatewayId, String(val))
      showToast({ severity: 'success', summary: 'Trigger Sent', detail: `Published Delay instruction (${val}s) to gateway.` })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Set Interval Error', detail: err.message })
    } finally {
      setSettingInterval(false)
    }
  }

  const handleReadInterval = async () => {
    try {
      setReadingInterval(true)
      setRetrievedInterval('')
      setCountdown({
        visible: true,
        title: 'Reading Publish Interval',
        subtitle: 'Querying telemetry reporting interval from gateway over MQTT, waiting for reply...'
      })
      await gatewaysApi.queryDelayDetails(gatewayId)
      showToast({ severity: 'info', summary: 'Trigger Sent', detail: 'Querying delay details over MQTT...' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Read Interval Error', detail: err.message })
      setReadingInterval(false)
      setCountdown({ visible: false, title: '', subtitle: '' })
    }
  }

  const handleUnlockFota = () => {
    if (!fotaPasswordInput.trim()) {
      showToast({ severity: 'warn', summary: 'Validation Failed', detail: 'Please enter the FOTA password.' })
      return
    }
    if (fotaPasswordInput.trim() !== (gateway?.prefix || '')) {
      showToast({ severity: 'error', summary: 'Invalid Password', detail: 'FOTA password incorrect.' })
      return
    }

    setFotaUnlocked(true)
    showToast({ severity: 'success', summary: 'FOTA Unlocked', detail: 'Security constraints bypassed. Upload enabled.' })
  }

  const handleFotaUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.bin')) {
      showToast({ severity: 'error', summary: 'Invalid File', detail: 'Please select a valid .bin firmware file.' })
      return
    }

    try {
      setUploadingFota(true)
      const reader = new FileReader()
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]
        try {
          const res = await gatewaysApi.uploadFotaBinary(gatewayId, file.name, base64Data)
          setFotaDownloadUrl(res.downloadUrl)
          showToast({ severity: 'success', summary: 'Upload Success', detail: 'Firmware binary uploaded and ready.' })
        } catch (err) {
          showToast({ severity: 'error', summary: 'Upload Failed', detail: err.message })
        } finally {
          setUploadingFota(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Upload Failed', detail: err.message })
      setUploadingFota(false)
    }
  }

  const handleTriggerFota = async () => {
    if (!fotaDownloadUrl) return
    try {
      setTriggeringFota(true)
      await gatewaysApi.triggerFotaUpdate(gatewayId, fotaDownloadUrl)
      showToast({ severity: 'success', summary: 'FOTA Sent', detail: 'FOTA update instruction sent to gateway.' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'FOTA Trigger Failed', detail: err.message })
    } finally {
      setTriggeringFota(false)
      setCountdown({ visible: false, title: '', subtitle: '' })
    }
  }

  const handleCopyFotaLink = () => {
    if (!fotaDownloadUrl) return
    
    const fallbackCopy = (text) => {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.position = 'fixed'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        const successful = document.execCommand('copy')
        if (successful) {
          showToast({ severity: 'success', summary: 'Copied', detail: 'URL copied to clipboard' })
          setCopiedLink(true)
          setTimeout(() => setCopiedLink(false), 2000)
        } else {
          showToast({ severity: 'error', summary: 'Copy Failed', detail: 'Could not copy URL' })
        }
      } catch (err) {
        showToast({ severity: 'error', summary: 'Copy Failed', detail: 'Could not copy URL' })
      }
      document.body.removeChild(textArea)
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(fotaDownloadUrl)
        .then(() => {
          showToast({ severity: 'success', summary: 'Copied', detail: 'URL copied to clipboard' })
          setCopiedLink(true)
          setTimeout(() => setCopiedLink(false), 2000)
        })
        .catch(() => {
          fallbackCopy(fotaDownloadUrl)
        })
    } else {
      fallbackCopy(fotaDownloadUrl)
    }
  }

  const handleTestStatusDetail = async () => {
    try {
      setTesting(true)
      setCountdown({
        visible: true,
        title: 'Testing Status',
        subtitle: 'Pinging gateway node via MQTT, waiting for reply...'
      })
      const res = await gatewaysApi.testStatus(gatewayId)
      setGateway(prev => ({ ...prev, status: res.status }))
      showToast({
        severity: res.status === 'online' ? 'success' : 'warn',
        summary: 'Status Test Result',
        detail: `Gateway is ${res.status === 'online' ? 'Online' : 'Offline (No response)'}`
      })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Test Failed', detail: err.message })
    } finally {
      setTesting(false)
      setCountdown(prev => ({ ...prev, visible: false }))
    }
  }

  const handleCheckVersionDetail = async () => {
    try {
      setCheckingVersion(true)
      setCountdown({
        visible: true,
        title: 'Checking Version',
        subtitle: 'Querying firmware version via MQTT, waiting for reply...'
      })
      const res = await gatewaysApi.checkVersion(gatewayId)
      if (res.success) {
        setGateway(prev => ({ ...prev, version: res.version }))
        showToast({
          severity: 'success',
          summary: 'Version Retrieved',
          detail: `Gateway version is ${res.version}`
        })
      } else {
        showToast({
          severity: 'warn',
          summary: 'Check Version',
          detail: res.message || 'Timeout waiting for response'
        })
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Check Failed', detail: err.message })
    } finally {
      setCheckingVersion(false)
      setCountdown(prev => ({ ...prev, visible: false }))
    }
  }

  const isRestrictedGw = isManagerMode && !featurePerms?.showGateway
  if (isRestrictedGw) {
    return (
      <div className="bg-white border border-slate-200/80 p-8 sm:p-12 text-center rounded-xl space-y-4 shadow-sm my-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
          <i className="pi pi-ban" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Gateway Management Restricted</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
            Access to Gateway Management has been restricted for your manager account by your Administrator. Please contact your system administrator to adjust your permissions.
          </p>
        </div>
      </div>
    )
  }

  if (loading && !gateway) return <LoadingSpinner text="Loading Gateway node configuration..." />
  if (!gateway) return <div className="p-6 text-center text-slate-450">Gateway not found.</div>

  const GROUP_CARD_BG = '#407021'

  // ---- Shared Table Renderer ----

  const renderConfigTable = (data, readOnly, onDelete) => {
    const duplicateAddressIndices = readOnly ? new Set() : getDuplicateAddressIndices(data)

    return (
    <div className="bg-white border border-slate-200/80 overflow-x-auto shadow-none">
      <table className="min-w-full divide-y divide-slate-100 text-xs">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Device Name</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Slave ID</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Parameter</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Func Code</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Address</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Data Type</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Length</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Scale</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Decimal</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Baud Rate</th>
            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide">Serial Config</th>
            {!readOnly && <th className="px-3 py-2 text-center font-bold text-slate-400 uppercase tracking-wide">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={readOnly ? 11 : 12} className="p-6 text-center text-slate-400">No data</td>
            </tr>
          ) : (() => {
            const spans = computeDeviceNameSpans(data)
            return data.map((row, index) => {
              const span = spans.get(index)
              return (
                <tr key={index} className="hover:bg-slate-50/50">
                  {span ? (
                    <td className="p-2 align-top" rowSpan={span}>
                      {readOnly ? (
                        <span className="font-semibold text-slate-700">{row.deviceName}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <select
                            className="w-28 border border-slate-200 px-1 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white font-semibold text-xs text-slate-700 cursor-pointer"
                            value={row.deviceName}
                            onChange={(e) => handleRowChange(index, 'deviceName', e.target.value)}
                          >
                            {devicesList.map(d => (
                              <option key={d.slaveId} value={d.deviceName}>
                                {d.deviceName}
                              </option>
                            ))}
                          </select>
                          {!isGroupFull && (
                            <button
                              onClick={() => addRowToDevice(index)}
                              className="text-blue-500 hover:text-blue-700 p-1 cursor-pointer transition-colors"
                              title="Add parameter to this device"
                            >
                              <i className="pi pi-plus text-[10px]" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  ) : null}
                  {span ? (
                    <td className="p-2 align-top" rowSpan={span}>
                      {readOnly ? (
                        <span className="font-mono font-semibold text-slate-700">{String(row.slaveId).padStart(2, '0')}</span>
                      ) : (
                        <select
                          className="w-16 border border-slate-200 px-1 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white font-mono text-xs cursor-pointer"
                          value={row.slaveId}
                          onChange={(e) => handleRowChange(index, 'slaveId', parseInt(e.target.value, 10))}
                        >
                          {devicesList.map(d => (
                            <option key={d.slaveId} value={d.slaveId}>
                              {String(d.slaveId).padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  ) : null}
                  <td className="p-2">
                    {readOnly ? (
                      <span className="font-mono font-bold text-slate-500">{row.parameterName}</span>
                    ) : (
                      <input
                        type="text"
                        disabled
                        className="w-12 border border-slate-200 px-2 py-1 bg-slate-50 font-bold font-mono text-slate-500"
                        value={row.parameterName}
                      />
                    )}
                  </td>
                  <td className="p-2">
                    <select
                      className="w-16 border border-slate-200 px-1 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white"
                      value={row.functionCode}
                      onChange={(e) => handleRowChange(index, 'functionCode', parseInt(e.target.value, 10))}
                      disabled={readOnly}
                    >
                      <option value={1}>01</option>
                      <option value={2}>02</option>
                      <option value={3}>03</option>
                      <option value={4}>04</option>
                      <option value={5}>05</option>
                      <option value={6}>06</option>
                      <option value={15}>15</option>
                      <option value={16}>16</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      className={`w-16 border px-2 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none ${
                        !readOnly && (row.address === '' || row.address === null || row.address === undefined)
                          ? 'border-amber-400 bg-amber-50/40 text-amber-900 font-semibold'
                          : !readOnly && duplicateAddressIndices.has(index)
                            ? 'border-red-400 bg-red-50/40 text-red-900 font-semibold'
                            : 'border-slate-200'
                      }`}
                      value={row.address ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') {
                          const targetGroupIdx = modalGroupIndex !== null ? modalGroupIndex : activeGroupIndex
                          if (targetGroupIdx !== null) {
                            clearAddressValidateTimer(targetGroupIdx, index)
                          }
                          handleRowChange(index, 'address', '')
                        } else {
                          const parsed = parseInt(val, 10)
                          const clamped = isNaN(parsed) ? '' : Math.max(0, parsed)
                          handleAddressChange(index, clamped)
                        }
                      }}
                      placeholder="Req"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="w-16 border border-slate-200 px-1 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white"
                      value={row.dataType}
                      onChange={(e) => handleRowChange(index, 'dataType', e.target.value)}
                      disabled={readOnly}
                    >
                      <option value="Int">Int</option>
                      <option value="Float">Float</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="w-12 border border-slate-200 px-2 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      value={row.length}
                      onChange={(e) => handleRowChange(index, 'length', parseInt(e.target.value, 10))}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="any"
                      className="w-14 border border-slate-200 px-2 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      value={row.scaleFactor ?? 1}
                      onChange={(e) => handleRowChange(index, 'scaleFactor', parseFloat(e.target.value))}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="font-mono text-slate-700">{row.decimal || 'None'}</span>
                    ) : (
                      <select
                        className="w-20 border border-slate-200 px-1 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white font-mono"
                        value={row.decimal || 'None'}
                        onChange={(e) => handleRowChange(index, 'decimal', e.target.value)}
                      >
                        {['None', '1', '2', '3', '4', '5', '6'].map(dec => (
                          <option key={dec} value={dec}>{dec}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      readOnly
                      disabled
                      className="w-24 border border-slate-200 px-2 py-1 bg-slate-100/70 text-slate-700 font-mono cursor-not-allowed text-xs font-bold rounded select-none text-center"
                      value={normalizeBaudRate(row.baudRate)}
                      title="Baud Rate is configured in Device List"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      readOnly
                      disabled
                      className="w-16 border border-slate-200 px-2 py-1 bg-slate-100/70 text-slate-500 font-mono cursor-not-allowed text-xs font-semibold rounded select-none"
                      value={row.serialConfig || '8N1'}
                      title="Serial Config is set via Device List"
                    />
                  </td>
                  {!readOnly && (
                    <td className="p-2 text-center">
                      <button
                        onClick={() => onDelete && onDelete(index)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer transition-colors"
                        title="Delete Parameter Row"
                      >
                        <i className="pi pi-trash" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })
          })()}
        </tbody>
      </table>
    </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Config History button */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate(`/admin/companies/${companyId}/gateways/${gatewayId}/config-history`)}
          className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 font-bold text-xs text-slate-600 flex items-center gap-2 cursor-pointer transition-all"
        >
          <i className="pi pi-history text-slate-500" />
          Config History
        </button>
      </div>

      {/* Gateway info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
        <div className="bg-white border border-slate-200/80 p-4 space-y-1 rounded-[15px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gateway ID</p>
          <p className="text-sm font-bold text-slate-800 font-mono truncate">{gateway.prefix}</p>
        </div>
        <ActiveNetworkCard key={gatewayId} gateway={gateway} canQuery={!isManagerMode || !!gatewayFeatures.showWifi} />
        <div className="bg-white border border-slate-200/80 p-4 space-y-1 flex flex-col justify-between rounded-[15px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${gateway.status === 'online' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              <span className={`w-1 h-1 rounded-full ${gateway.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {gateway.status}
            </span>
          </div>
          <button
            disabled={testing}
            onClick={handleTestStatusDetail}
            className="mt-2 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer w-fit disabled:opacity-50"
            title="Test Online Status"
          >
            {testing ? <i className="pi pi-spin pi-spinner text-[9px]" /> : <i className="pi pi-bolt text-[9px]" />}
            {testing ? 'Testing...' : 'Test Status'}
          </button>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 space-y-1 flex flex-col justify-between rounded-[15px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Version</p>
            <p className="text-sm font-bold text-slate-800 truncate">{gateway.version || 'Unknown'}</p>
          </div>
          <button
            disabled={checkingVersion}
            onClick={handleCheckVersionDetail}
            className="mt-2 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer w-fit disabled:opacity-50"
            title="Check version info via MQTT"
          >
            {checkingVersion ? <i className="pi pi-spin pi-spinner text-[9px]" /> : <i className="pi pi-refresh text-[9px]" />}
            {checkingVersion ? 'Checking...' : 'Check Version'}
          </button>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 space-y-1 flex flex-col justify-between rounded-[15px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Param Capacity</p>
            <p className="text-sm font-bold text-slate-800">
              {totalParamCount} / <span className="text-blue-600 font-extrabold">{maxAllowedParams}</span>
            </p>
            <span className="text-[10px] text-slate-400 font-medium block">
              {groups.length} of {maxAllowedGroups} Groups
            </span>
          </div>
          {!isManagerMode && (
            <button
              onClick={() => {
                setNewMaxParams(maxAllowedParams)
                setEditMaxParamsDialog(true)
              }}
              className="mt-2 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer w-fit"
              title="Edit maximum parameters limit"
            >
              <i className="pi pi-pencil text-[9px]" />
              Edit Limit
            </button>
          )}
        </div>
        <div className="bg-white border border-slate-200/80 p-4 space-y-1 flex flex-col justify-between rounded-[15px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Site Location</p>
            <p className="text-sm font-medium text-slate-600 truncate" title={gateway.location || 'No location configured'} aria-live="polite">{gateway.location || 'No location configured'}</p>
          </div>
          {(!isManagerMode || gatewayFeatures.showLocation) && (
            <button type="button" onClick={handleReadLocation} disabled={readingLocation}
              className="mt-2 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer w-fit disabled:opacity-50"
              title="Read and save the site location from the gateway">
              <i className={readingLocation ? 'pi pi-spin pi-spinner text-[9px]' : 'pi pi-refresh text-[9px]'} aria-hidden="true" />
              {readingLocation ? 'Checking...' : 'Check Status'}
            </button>
          )}
        </div>
        <div className="bg-white border border-slate-200/80 p-4 space-y-1 rounded-[15px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Company</p>
          <p className="text-sm font-bold text-slate-800 truncate">{company?.name || 'N/A'}</p>
        </div>
      </div>

      {/* Gateway cards stay available across all three workspaces. */}
      <div>
        <div role="group" aria-label="Gateway workspace" className="flex justify-center gap-2 flex-wrap">
          {[{ id: 'rtu', label: 'Modbus RTU', icon: 'pi pi-server' }, { id: 'tcp', label: 'Modbus TCP', icon: 'pi pi-sitemap' }, { id: 'settings', label: 'Settings', icon: 'pi pi-cog' }].map(workspace => (
            <button key={workspace.id} type="button" aria-pressed={protocol === workspace.id}
              aria-controls={workspace.id === 'tcp' ? 'modbus-tcp-workspace' : 'gateway-controls-workspace'}
              onClick={() => setProtocol(workspace.id)} className="gateway-workspace-tab">
              <span className="gateway-workspace-icon"><i className={workspace.icon} aria-hidden="true" /></span>
              <span>{workspace.label}</span>
            </button>
          ))}
        </div>
      </div>

      <section id="modbus-tcp-workspace" aria-label="Modbus TCP workspace" hidden={protocol !== 'tcp'} className="space-y-6">
          <div className="border-b border-slate-200">
            <div role="group" aria-label="Modbus TCP controls" className="flex gap-0 flex-wrap">
              {['Mode Selection', 'Device List', 'Publish', 'Read'].map(label => (
                <button key={label} type="button" aria-pressed={tcpTab === label}
                  onClick={() => setTcpTab(label)} className={tabClassName(tcpTab === label)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div hidden={tcpTab !== 'Mode Selection'}>
            <TcpModeSelection key={gatewayId} gatewayId={gatewayId}
              canPublish={!isManagerMode || !!gatewayFeatures.showPublish}
              canRead={!isManagerMode || !!gatewayFeatures.showReadConfig} />
          </div>
          <div hidden={tcpTab === 'Mode Selection'}>
            <TcpGatewayWorkspace key={gatewayId} gatewayId={gatewayId} gateway={gateway} tab={tcpTab}
              canDevices={!isManagerMode || !!gatewayFeatures.showDeviceList}
              canPublish={!isManagerMode || !!gatewayFeatures.showPublish}
              canRead={!isManagerMode || !!gatewayFeatures.showReadConfig} />
          </div>
      </section>

      {/* Keep both workspaces mounted to preserve form values and live responses. */}
      <div id="gateway-controls-workspace" hidden={protocol === 'tcp'} className="space-y-6">
      {/* Content tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 flex-wrap">
          {workspaceTabs.map((tabItem) => (
            <button
              key={tabItem.idx}
              type="button"
              aria-pressed={activeContentTab === tabItem.idx}
              onClick={() => protocol === 'settings' ? setSettingsTab(tabItem.idx) : setActiveTab(tabItem.idx)}
              className={tabClassName(activeContentTab === tabItem.idx)}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {workspaceTabs.length === 0 && <p className="p-6 text-sm text-slate-500">No controls are enabled for your account in this workspace.</p>}

      <div className="relative min-h-[280px]">
        {refreshing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
            <LoadingSpinner text="Refreshing gateway configuration..." />
          </div>
        )}

      <div hidden={protocol !== 'rtu'}>
      {/* === TAB 0: Device List === */}
      {selectedRtuTab === 0 && (
        <div className="bg-white border border-slate-200/80 p-6 space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <i className="pi pi-server text-lg" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800">
                    Gateway Device Mapping
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                    {devicesList.length} {devicesList.length === 1 ? 'Device' : 'Devices'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Map Device Names to Slave IDs for Modbus parameter groups.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex border border-slate-200 rounded p-0.5 bg-slate-50 mr-2">
                <button
                  onClick={() => setDeviceViewMode('grid')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-all flex items-center gap-1 ${
                    deviceViewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Grid View"
                >
                  <i className="pi pi-th-large text-[10px]" />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setDeviceViewMode('table')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-all flex items-center gap-1 ${
                    deviceViewMode === 'table' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Table View"
                >
                  <i className="pi pi-list text-[10px]" />
                  <span>Table</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setDevicesList(prev => {
                    const usedSlaves = new Set(prev.map(d => Number(d.slaveId)))
                    let nextSlave = 1
                    while (usedSlaves.has(nextSlave)) nextSlave++
                    let nextNum = 1
                    const names = prev.map(d => d.deviceName)
                    while (names.includes(`Device${nextNum}`)) nextNum++
                    return [...prev, { slaveId: nextSlave, deviceName: `Device${nextNum}`, baudRate: 115200, serialConfig: '8N1' }]
                  })
                }}
                className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <i className="pi pi-plus text-[10px] text-blue-600" />
                <span>Add Device</span>
              </button>

              {savingDevices && (
                <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mr-1">
                  <i className="pi pi-spin pi-spinner text-[10px]" />
                  <span>Auto-saving...</span>
                </span>
              )}
            </div>
          </div>

          {/* GRID VIEW */}
          {deviceViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devicesList.map((dev, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-xl p-4 bg-white hover:border-blue-300 hover:shadow-md transition-all space-y-4 group relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <i className="pi pi-desktop text-xs" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Slave ID</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono font-bold text-blue-600">ID:</span>
                          <input
                            type="number"
                            min={1}
                            max={247}
                            className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50"
                            value={dev.slaveId}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1
                              updateDeviceItemInListAndGroups(idx, { slaveId: val })
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {!isManagerMode && (
                      <button
                        onClick={() => handleDeviceDeleteRequest(idx)}
                        className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Remove Device"
                      >
                        <i className="pi pi-trash text-xs" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Device Name</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white"
                      value={dev.deviceName}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s+/g, '')
                        updateDeviceItemInListAndGroups(idx, { deviceName: val })
                      }}
                      placeholder="e.g. Device1 or MeterAlpha"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Baud Rate</label>
                      <select
                        className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50 focus:bg-white"
                        value={normalizeBaudRate(dev.baudRate)}
                        onChange={(e) => {
                          const brVal = Number(e.target.value)
                          updateDeviceItemInListAndGroups(idx, { baudRate: brVal })
                        }}
                      >
                        {BAUD_RATES.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Serial Config</label>
                      <select
                        className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50 focus:bg-white"
                        value={dev.serialConfig || '8N1'}
                        onChange={(e) => {
                          const scVal = e.target.value
                          updateDeviceItemInListAndGroups(idx, { serialConfig: scVal })
                        }}
                      >
                        {SERIAL_CONFIGS.map(sc => (
                          <option key={sc} value={sc}>{sc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Card Prompt */}
              <div
                onClick={() => {
                  setDevicesList(prev => {
                    const usedSlaves = new Set(prev.map(d => Number(d.slaveId)))
                    let nextSlave = 1
                    while (usedSlaves.has(nextSlave)) nextSlave++
                    let nextNum = 1
                    const names = prev.map(d => d.deviceName)
                    while (names.includes(`Device${nextNum}`)) nextNum++
                    return [...prev, { slaveId: nextSlave, deviceName: `Device${nextNum}`, baudRate: 115200, serialConfig: '8N1' }]
                  })
                }}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/30 transition-all text-center min-h-[130px]"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
                  <i className="pi pi-plus text-xs" />
                </div>
                <span className="text-xs font-bold text-slate-600">Add New Device</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Configure Slave ID, Baud Rate & Serial Config</span>
              </div>
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wide w-28">Slave ID</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wide">Device Name</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wide w-36">Baud Rate</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wide w-32">Serial Config</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase tracking-wide w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {devicesList.map((dev, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-blue-600">ID:</span>
                          <input
                            type="number"
                            min={1}
                            max={247}
                            className="w-20 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono font-bold text-slate-700"
                            value={dev.slaveId}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1
                              updateDeviceItemInListAndGroups(idx, { slaveId: val })
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          className="w-full max-w-md border border-slate-200 rounded px-3 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none font-semibold text-slate-700"
                          value={dev.deviceName}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\s+/g, '')
                            updateDeviceItemInListAndGroups(idx, { deviceName: val })
                          }}
                          placeholder="e.g. Device1"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          className="w-full border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none font-semibold text-slate-700"
                          value={normalizeBaudRate(dev.baudRate)}
                          onChange={(e) => {
                            const brVal = Number(e.target.value)
                            updateDeviceItemInListAndGroups(idx, { baudRate: brVal })
                          }}
                        >
                          {BAUD_RATES.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          className="w-full border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-600 focus:outline-none font-semibold text-slate-700"
                          value={dev.serialConfig || '8N1'}
                          onChange={(e) => {
                            const scVal = e.target.value
                            updateDeviceItemInListAndGroups(idx, { serialConfig: scVal })
                          }}
                        >
                          {SERIAL_CONFIGS.map(sc => (
                            <option key={sc} value={sc}>{sc}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeviceDeleteRequest(idx)}
                          className="w-7 h-7 inline-flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Remove Device"
                        >
                          <i className="pi pi-trash text-xs" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* UNLINKED DEVICE DELETE MODAL */}
          {confirmDeleteDeviceIdx !== null && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0">
                    <i className="pi pi-exclamation-triangle text-lg" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-800">Delete Device Mapping?</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Are you sure you want to remove <strong className="text-slate-800">{devicesList[confirmDeleteDeviceIdx]?.deviceName}</strong> (Slave ID: <span className="font-mono font-bold text-blue-600">{devicesList[confirmDeleteDeviceIdx]?.slaveId}</span>)?
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setConfirmDeleteDeviceIdx(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const idx = confirmDeleteDeviceIdx
                      if (idx === null || !devicesList[idx]) return
                      const targetDev = devicesList[idx]
                      const nextDevices = devicesList.filter((_, i) => i !== idx)
                      setDevicesList(nextDevices)
                      setConfirmDeleteDeviceIdx(null)

                      // Clean up parameter rows associated with the deleted device from groups
                      setGroups(prev => {
                        return prev.map(groupRows => {
                          const filtered = groupRows.filter(r => r.deviceName !== targetDev.deviceName && Number(r.slaveId) !== Number(targetDev.slaveId))
                          if (filtered.length === 0) {
                            const fallbackDev = nextDevices[0] || { deviceName: 'Device1', slaveId: 1 }
                            return [{
                              ...EMPTY_ROW,
                              deviceName: fallbackDev.deviceName,
                              slaveId: Number(fallbackDev.slaveId)
                            }]
                          }
                          return filtered
                        })
                      })

                      try {
                        const res = await gatewaysApi.updateDevices(gatewayId, nextDevices)
                        if (res.devices) setDevicesList(res.devices)
                        showToast({ severity: 'success', summary: 'Device Deleted', detail: 'Device mapping deleted and associated parameters updated' })
                      } catch (err) {
                        showToast({ severity: 'error', summary: 'Database Error', detail: err.message || 'Failed to sync with database' })
                      }
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <i className="pi pi-trash text-[10px]" />
                    <span>Confirm Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LINKED DEVICE DELETE WARNING MODAL */}
          {linkedDeleteInfo && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                    <i className="pi pi-exclamation-triangle text-lg" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-800">Linked Device Warning</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Device <strong className="text-slate-800">{linkedDeleteInfo.device.deviceName}</strong> (Slave ID: <span className="font-mono font-bold text-blue-600">{linkedDeleteInfo.device.slaveId}</span>) is currently linked to <strong className="text-amber-700">{linkedDeleteInfo.occurrences.length} parameter(s)</strong> stored in database:
                    </p>
                    <div className="max-h-28 overflow-y-auto bg-slate-50 border border-slate-200 rounded p-2 text-[11px] font-mono text-slate-700 space-y-0.5 mt-1">
                      {linkedDeleteInfo.occurrences.map((item, i) => (
                        <div key={i}>• Group G{item.groupNum}: Parameter {item.param}</div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug pt-1">
                      Deleting this device will remove the device mapping AND all linked parameters from publish config, and re-publish updated setup to board over MQTT.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setLinkedDeleteInfo(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmLinkedDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <i className="pi pi-trash text-[10px]" />
                    <span>Delete Device & Linked Data</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === TAB 1: Publish === */}
      {selectedRtuTab === 1 && (
        <div className="space-y-4">
          {/* Amber warning banner: pending publish */}
          {publishStatus === 'saved_only' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <i className="pi pi-exclamation-triangle text-sm" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-amber-900">Latest Changes Saved in DB (Pending Board Confirmation)</h5>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Modbus parameters &amp; group updates are stored in database. Waiting for gateway hardware board to acknowledge publish over MQTT.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handlePublishConfig}
                  disabled={publishing}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                >
                  <i className="pi pi-cloud-upload text-xs" />
                  <span>Publish All</span>
                </button>
                <button
                  onClick={() => setShowChangelogModal(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                >
                  <i className="pi pi-info-circle text-xs" />
                  <span>View Status Info</span>
                </button>
              </div>
            </div>
          )}

          {/* Amber warning banner: pending board delete confirmation */}
          {pendingDeleteGroups.size > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 shrink-0">
                  <i className="pi pi-trash text-sm" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-red-900">
                    {[...pendingDeleteGroups].map(n => `G${n}`).join(', ')} — Deleted in DB, Awaiting Board Confirmation
                  </h5>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    Delete command sent to board. If board does not confirm, the group data is removed from DB only. You can re-send the delete command.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {[...pendingDeleteGroups].map(gNum => (
                  <button
                    key={gNum}
                    onClick={async () => {
                      try {
                        await gatewaysApi.deleteGroup(gatewayId, gNum)
                        showToast({ severity: 'info', summary: `G${gNum} Re-sent`, detail: `Delete command re-sent to board for G${gNum}.` })
                      } catch (err) {
                        showToast({ severity: 'error', summary: 'Error', detail: err.message })
                      }
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  >
                    <i className="pi pi-refresh text-xs" />
                    <span>Re-send Delete G{gNum}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modbus Groups</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPublishConfig}
                disabled={!groups || !groups.some(g => g && g.length > 0)}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-55 disabled:hover:bg-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-sm bg-white"
                title={(!groups || !groups.some(g => g && g.length > 0)) ? "No configuration data available to export" : "Export current DB configuration to Excel/CSV"}
              >
                <i className="pi pi-file-excel text-[11px] text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => setShowExcelModal(true)}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm bg-white"
              >
                <i className="pi pi-file-excel text-[11px] text-emerald-600" />
                <span>Upload Excel Data</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {groups.map((group, idx) => {
              const groupNum = groupNums[idx]
              const groupStatus = groupStatuses[groupNum] || 'committed'
              const groupStatusLabel = groupStatus === 'committed'
                ? { label: 'DB + Board', icon: 'pi-check-circle', cls: 'text-emerald-600 bg-emerald-50' }
                : { label: 'DB Only', icon: 'pi-database', cls: 'text-amber-600 bg-amber-50' }

              return (
                <div key={groupNum} className="relative group">
                  <div
                    onClick={() => { setModalGroupIndex(idx); setActiveGroupIndex(idx); setModalOpen(true) }}
                    className="w-[130px] h-[115px] rounded-lg flex flex-col cursor-pointer shadow-sm hover:shadow-md border border-[var(--border-color)] overflow-hidden transition-all duration-300 bg-[var(--bg-card)] hover:bg-[var(--accent-primary)] group-hover:border-[var(--accent-primary)]"
                  >
                    <div className="flex-1 flex flex-col items-center justify-center pt-1">
                      <span className="text-[var(--text-primary)] group-hover:text-[var(--accent-contrast)] font-bold text-base transition-colors duration-300">G{groupNum}</span>
                      <span className="text-[var(--text-secondary)] group-hover:text-[var(--accent-contrast)]/85 text-[10px] mt-0.5 transition-colors duration-300">{group.length} param{group.length !== 1 ? 's' : ''}</span>
                      {/* Per-group Status badge */}
                      <div
                        className={`mt-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${groupStatusLabel.cls} group-hover:bg-white/20 group-hover:text-[var(--accent-contrast)] transition-colors duration-300`}
                        title={groupStatus === 'committed' ? 'Stored in DB & confirmed by board' : 'Stored in DB only — awaiting board acknowledgement'}
                      >
                        <i className={`pi ${groupStatusLabel.icon} text-[8px]`} />
                        <span>{groupStatusLabel.label}</span>
                      </div>
                    </div>
                    {!isManagerMode && (
                      <div className="flex items-center justify-end px-2 pb-1.5">
                        <span
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroupIndex(idx) }}
                          className="text-[var(--text-secondary)] group-hover:text-[var(--accent-contrast)]/60 hover:text-red-400 group-hover:hover:text-red-300 text-xs cursor-pointer transition-colors duration-300"
                          title={`Delete G${groupNum}`}
                        >
                          <i className="pi pi-trash" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {!isManagerMode && (() => {
              const canCreateGroup = groups.length < maxAllowedGroups && totalParamCount < maxAllowedParams
              return canCreateGroup ? (
                <div
                  onClick={addGroup}
                  className="w-[130px] h-[115px] border-2 border-dashed border-emerald-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all shrink-0"
                >
                  <i className="pi pi-plus text-emerald-500 text-2xl" />
                  <span className="text-emerald-700 text-xs mt-1.5 font-bold">Create Group</span>
                </div>
              ) : (
                <div
                  className="w-[130px] h-[115px] border-2 border-dashed border-slate-200 bg-slate-50/70 rounded-lg flex flex-col items-center justify-center text-center p-2 shrink-0 select-none cursor-not-allowed opacity-75"
                  title={`Maximum ${maxAllowedParams} parameters limit reached (${groups.length}/${maxAllowedGroups} groups)`}
                >
                  <i className="pi pi-lock text-slate-400 text-lg" />
                  <span className="text-slate-500 text-[10px] mt-1 font-bold">Max {maxAllowedParams} Params</span>
                  <span className="text-slate-400 text-[9px]">Limit Reached</span>
                </div>
              )
            })()}
          </div>

          {/* Publish Modal */}
          {modalOpen && modalGroupIndex !== null && (() => {
            const currentModalRows = groups[modalGroupIndex] || []
            const modalParamCount = currentModalRows.length
            const modalDeviceCount = new Set(currentModalRows.map(r => (r.deviceName && r.deviceName.trim()) || `Slave ${r.slaveId}`)).size
            const gNum = modalGroupIndex !== null ? groupNums[modalGroupIndex] : null
            const gStatus = gNum ? (groupStatuses[gNum] || 'committed') : 'committed'

            return (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-white w-[95vw] max-w-[1200px] h-[85vh] flex flex-col shadow-xl border border-slate-200">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <i className="pi pi-cog text-blue-500" />
                        G{modalGroupIndex !== null ? groupNums[modalGroupIndex] : '?'} — Modbus Configuration
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
                          <i className="pi pi-desktop text-[11px]" />
                          {modalDeviceCount} {modalDeviceCount === 1 ? 'Device' : 'Devices'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold">
                          <i className="pi pi-sliders-h text-[11px]" />
                          {modalParamCount} {modalParamCount === 1 ? 'Parameter' : 'Parameters'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {readingConfig && (
                        <span className="flex items-center gap-2 text-xs text-blue-600 font-semibold">
                          <i className="pi pi-spin pi-spinner" />
                          Waiting for device response...
                        </span>
                      )}
                      <button
                        onClick={() => setModalOpen(false)}
                        className="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer transition-all shrink-0"
                      >
                        <i className="pi pi-times text-xs" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Body (Scrollable table) */}
                  <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-slate-50/30">
                    {renderConfigTable(groups[modalGroupIndex] || [], false, (index) => deleteRow(index))}
                  </div>

                  {/* Modal Footer (Sticky footer for Add Device & Publish) */}
                  <div className="border-t border-slate-100 p-4 flex items-center justify-between shrink-0 bg-slate-50">
                    <div className="flex-1 flex justify-center">
                      {(() => {
                        const currentModalRows = groups[modalGroupIndex] || []
                        const gNum = modalGroupIndex !== null ? groupNums[modalGroupIndex] : 1
                        const gMax = getGroupMaxParams(gNum)
                        const isFull = currentModalRows.length >= gMax || totalParamCount >= maxAllowedParams

                        return !isFull ? (
                          <button
                            onClick={addDeviceGroup}
                            className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-sm rounded-none"
                          >
                            <i className="pi pi-plus text-[10px]" />
                            Add Device
                          </button>
                        ) : (
                          <div className="text-center text-xs text-amber-600 font-bold flex items-center gap-1.5 justify-center py-1">
                            <i className="pi pi-info-circle mr-1" />
                            Group G{gNum} has reached its maximum of {gMax} parameters (Gateway limit: {maxAllowedParams} parameters).
                          </div>
                        )
                      })()}
                    </div>
                    {/* Per-group publish button in modal footer */}
                    {isManagerMode && !gatewayFeatures?.showPublish ? null : (
                      <button
                        onClick={() => gNum ? handlePublishGroup(gNum) : handlePublishConfig()}
                        disabled={publishing}
                        className={`px-5 py-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shrink-0 rounded-none select-none ${
                          gStatus === 'saved_only'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/50'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        } disabled:opacity-60`}
                        title={gStatus === 'saved_only' ? `G${gNum} saved in DB but pending board ACK — click to re-publish` : `Publish G${gNum} to board`}
                      >
                        {gStatus === 'saved_only' ? (
                          <i className="pi pi-exclamation-triangle text-amber-200 animate-pulse text-xs" />
                        ) : (
                          <i className="pi pi-cloud-upload text-xs" />
                        )}
                        <span>
                          {publishing
                            ? 'Publishing...'
                            : gStatus === 'saved_only'
                            ? `Publish G${gNum} (ACK Pending)`
                            : `Publish G${gNum}`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* === TAB 2: ReadConfig === */}
      {selectedRtuTab === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <i className="pi pi-download text-blue-500" />
              Live Config Read from Gateway
            </h3>
            <div className="flex items-center gap-2">
              {readingConfig && (
                <span className="flex items-center gap-2 text-xs text-blue-600 font-semibold">
                  <i className="pi pi-spin pi-spinner" />
                  Reading...
                </span>
              )}
              <button
                onClick={handleExportLiveConfig}
                disabled={!liveReadGroups || !liveReadGroups.some(g => g && g.length > 0)}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-55 disabled:hover:bg-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-sm bg-white"
                title={(!liveReadGroups || !liveReadGroups.some(g => g && g.length > 0)) ? "Read configuration from gateway first to export" : "Export configuration to Excel/CSV"}
              >
                <i className="pi pi-file-excel text-[11px] text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleReadConfig}
                disabled={readingConfig}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <i className="pi pi-refresh" />
                {readingConfig ? 'Reading...' : 'Read from Gateway'}
              </button>
            </div>
          </div>

          {readingConfig && liveReadGroupProgress.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-3 space-y-2">
              <p className="text-xs font-bold text-blue-700">Group Read Progress ({liveReadGroupProgress.size} Received)</p>
              <div className="flex gap-2 flex-wrap">
                {Array.from(liveReadGroupProgress).sort((a, b) => a - b).map(g => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200"
                  >
                    <i className="pi pi-check" /> G{g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {liveReadPartial && (
            <div className="bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                <i className="pi pi-exclamation-triangle" />
                Partial response — some groups did not respond
              </p>
            </div>
          )}

          {liveReadGroups.length > 0 || (liveReadRows && liveReadRows.length > 0) ? (
            <>
              <div className="flex flex-wrap gap-4">
                {liveReadGroups.map((group, idx) => {
                  if (!group) return null
                  return (
                    <div
                      key={idx}
                      onClick={() => { setModalGroupIndex(idx); setActiveGroupIndex(idx); setModalOpen(true) }}
                      className="w-[120px] h-[100px] rounded-lg flex flex-col cursor-pointer shadow-sm hover:shadow-md border border-[var(--border-color)] overflow-hidden transition-all duration-300 bg-[var(--bg-card)] hover:bg-[var(--accent-primary)] group-hover:border-[var(--accent-primary)] group"
                    >
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <span className="text-[var(--text-primary)] group-hover:text-[var(--accent-contrast)] font-bold text-base transition-colors duration-300">G{idx + 1}</span>
                        <span className="text-[var(--text-secondary)] group-hover:text-[var(--accent-contrast)]/85 text-[10px] mt-0.5 transition-colors duration-300">{group.length} param{group.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Read-Only Modal */}
              {modalOpen && modalGroupIndex !== null && (() => {
                const currentReadRows = liveReadGroups[modalGroupIndex] || []
                const readParamCount = currentReadRows.length
                const readDeviceCount = new Set(currentReadRows.map(r => (r.deviceName && r.deviceName.trim()) || `Slave ${r.slaveId}`)).size

                return (
                  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white w-[95vw] max-w-[1200px] h-[85vh] flex flex-col shadow-xl border border-slate-200">
                      {/* Modal Header */}
                      <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <i className="pi pi-download text-blue-500" />
                            G{modalGroupIndex + 1} — Received Config (Read-Only)
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
                              <i className="pi pi-desktop text-[11px]" />
                              {readDeviceCount} {readDeviceCount === 1 ? 'Device' : 'Devices'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold">
                              <i className="pi pi-sliders-h text-[11px]" />
                              {readParamCount} {readParamCount === 1 ? 'Parameter' : 'Parameters'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setModalOpen(false)}
                          className="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer transition-all shrink-0"
                        >
                          <i className="pi pi-times text-xs" />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-slate-50/30">
                        {renderConfigTable(liveReadGroups[modalGroupIndex] || [], true)}
                      </div>

                      {/* Modal Footer */}
                      <div className="border-t border-slate-100 p-4 flex justify-end shrink-0 bg-slate-50">
                        <button
                          onClick={() => setModalOpen(false)}
                          className="px-4 py-2 border border-slate-200 text-slate-550 hover:bg-slate-100 bg-white font-bold text-xs cursor-pointer transition-all rounded-none"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="bg-white border border-slate-200/80 p-12 text-center">
              <i className="pi pi-download text-3xl text-slate-300 mb-3 block" />
              <p className="text-sm font-semibold text-slate-500">No live config data</p>
              <p className="text-xs text-slate-400 mt-1">Click "Read from Gateway" to fetch the current config from the device</p>
            </div>
          )}
        </div>
      )}

      </div>
      <div hidden={protocol !== 'settings'}>
      {/* === TAB 3: Network (retains the existing manager permission) === */}
      {selectedSettingsTab === 3 && <GatewayNetworkPanel key={gatewayId} gatewayId={gatewayId} />}

      {/* === TAB 4: Location === */}
      {selectedSettingsTab === 4 && (
        <div className="bg-white border border-slate-200/80 p-6 space-y-8">
          {/* Section 1: Set Location */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="pi pi-map-marker text-emerald-500" />
                Configure Gateway Location
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Send a new physical location name string to the gateway over MQTT (restricted to 30 characters).</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end gap-4 max-w-md">
              <div className="flex-1 space-y-1.5 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Location Value</label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={30}
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="e.g. Area-A1"
                    className="w-full h-10 border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none font-semibold text-slate-700 placeholder-slate-450"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">
                    {locationInput.length}/30
                  </span>
                </div>
              </div>
              <button
                onClick={handleSetLocation}
                disabled={settingLocation}
                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shrink-0 select-none"
              >
                {settingLocation ? (
                  <>
                    <i className="pi pi-spin pi-spinner text-[10px]" />
                    <span>Setting...</span>
                  </>
                ) : (
                  <>
                    <i className="pi pi-check text-[10px]" />
                    <span>Set Location</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Read Location Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-808 flex items-center gap-2">
                  <i className="pi pi-search-plus text-blue-500" />
                  Read Live Location Details
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Query the active live location parameter from the gateway node.</p>
              </div>
              <button
                onClick={handleReadLocation}
                disabled={readingLocation}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all select-none"
              >
                {readingLocation ? (
                  <>
                    <i className="pi pi-spin pi-spinner text-[10px]" />
                    <span>Reading...</span>
                  </>
                ) : (
                  <>
                    <i className="pi pi-search text-[10px]" />
                    <span>Read Location</span>
                  </>
                )}
              </button>
            </div>

            <div className="max-w-md space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retrieved Location Value</label>
              <input
                type="text"
                value={retrievedLocation}
                readOnly
                placeholder="Not queried yet (click Read Location)"
                className="w-full h-10 border border-slate-200 px-3 text-xs bg-slate-50 font-semibold text-slate-700 focus:outline-none placeholder-slate-400 cursor-not-allowed select-all"
              />
            </div>
          </div>
        </div>
      )}

      {/* === TAB 5: PublishInterval === */}
      {selectedSettingsTab === 5 && (
        <div className="bg-white border border-slate-200/80 p-6 space-y-8">
          {/* Section 1: Set Publish Interval */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="pi pi-clock text-emerald-500" />
                Configure Publish Interval
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Send a new data reporting delay interval in seconds to the gateway over MQTT.</p>
            </div>
            
            <div className="space-y-1.5 max-w-md">
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 space-y-1.5 w-full">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Interval Value (seconds)</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    placeholder="1 - 600 seconds"
                    className="w-full h-10 border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none font-semibold text-slate-700 placeholder-slate-400"
                  />
                </div>
                <button
                  onClick={handleSetInterval}
                  disabled={settingInterval}
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shrink-0 select-none"
                >
                  {settingInterval ? (
                    <>
                      <i className="pi pi-spin pi-spinner text-[10px]" />
                      <span>Setting...</span>
                    </>
                  ) : (
                    <>
                      <i className="pi pi-check text-[10px]" />
                      <span>Set Interval</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Valid range: <span className="font-bold text-slate-600">1</span> to <span className="font-bold text-slate-600">600</span> seconds.</p>
            </div>
          </div>

          {/* Section 2: Read Publish Interval Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-808 flex items-center gap-2">
                  <i className="pi pi-search-plus text-blue-500" />
                  Read Live Publish Interval
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Query the active telemetry report delay parameter from the gateway node.</p>
              </div>
              <button
                onClick={handleReadInterval}
                disabled={readingInterval}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all select-none"
              >
                {readingInterval ? (
                  <>
                    <i className="pi pi-spin pi-spinner text-[10px]" />
                    <span>Reading...</span>
                  </>
                ) : (
                  <>
                    <i className="pi pi-search text-[10px]" />
                    <span>Read Delay</span>
                  </>
                )}
              </button>
            </div>

            <div className="max-w-md space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retrieved Interval (seconds)</label>
              <input
                type="text"
                value={retrievedInterval}
                readOnly
                placeholder="Not queried yet (click Read Delay)"
                className="w-full h-10 border border-slate-200 px-3 text-xs bg-slate-50 font-semibold text-slate-700 focus:outline-none placeholder-slate-450 cursor-not-allowed select-all"
              />
            </div>
          </div>
        </div>
      )}

      {/* === TAB 6: FOTA === */}
      {selectedSettingsTab === 6 && (
        <div className="bg-white border border-slate-200/80 p-6 space-y-6">
          {!fotaUnlocked ? (
            <div className="max-w-md mx-auto py-10 space-y-5 text-center">
              <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                <i className="pi pi-lock text-lg" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">Security Verification Required</h4>
                <p className="text-xs text-slate-400">Unlock the firmware updates console by entering credentials below.</p>
              </div>
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={fotaPasswordInput}
                    onChange={(e) => setFotaPasswordInput(e.target.value)}
                    className="w-full h-10 border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none font-semibold text-slate-700 font-mono"
                  />
                </div>
                <button
                  onClick={handleUnlockFota}
                  className="w-full h-10 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <i className="pi pi-unlock text-[10px]" />
                  Unlock FOTA Panel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <i className="pi pi-cloud-download text-emerald-500" />
                    Firmware Over-The-Air (FOTA) Controller
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Select a firmware binary (.bin) to upload, distribute, and apply to the gateway device.</p>
                </div>
                <button
                  onClick={() => {
                    setFotaUnlocked(false)
                    setFotaPasswordInput('')
                    setFotaGatewayIdInput('')
                    setFotaDownloadUrl('')
                  }}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-all"
                >
                  Lock Panel
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Upload binary */}
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/55 flex flex-col items-center justify-center relative">
                    {uploadingFota ? (
                      <div className="py-4 space-y-2">
                        <i className="pi pi-spin pi-spinner text-2xl text-blue-500" />
                        <p className="text-xs font-semibold text-slate-500">Uploading binary...</p>
                      </div>
                    ) : (
                      <>
                        <i className="pi pi-cloud-upload text-3xl text-slate-350 mb-3" />
                        <p className="text-xs font-bold text-slate-700">Select Firmware File</p>
                        <p className="text-[10px] text-slate-400 mt-1 mb-4">Only raw binary (.bin) files are supported.</p>
                        <input
                          type="file"
                          accept=".bin"
                          onChange={handleFotaUpload}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs pointer-events-none shadow-sm">
                          Browse Files
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Distribution & Trigger */}
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 p-5 space-y-4">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">FOTA Distribution URL</h5>
                    
                    {fotaDownloadUrl ? (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={fotaDownloadUrl}
                            readOnly
                            className="flex-1 h-9 border border-slate-200 px-3 text-xs bg-white text-slate-650 font-mono focus:outline-none select-all"
                          />
                          <button
                            onClick={handleCopyFotaLink}
                            className="px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                            title="Copy link"
                          >
                            {copiedLink ? (
                              <>
                                <i className="pi pi-check text-emerald-500 text-[10px]" />
                                <span className="text-[10px] text-emerald-500 font-bold">Copied</span>
                              </>
                            ) : (
                              <i className="pi pi-copy" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          This public URL streams the binary directly from MongoDB. Share it or proceed to notify the gateway.
                        </p>
                        
                        <button
                          onClick={handleTriggerFota}
                          disabled={triggeringFota}
                          className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm select-none"
                        >
                          <i className="pi pi-cloud-upload text-[10px]" />
                          Trigger FOTA Update
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs italic">
                        No firmware uploaded yet. Select a file on the left to generate a download link.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      </div>
      </div>

      </div>

      {/* Delete Group Confirmation Modal */}
      {confirmDeleteGroupIndex !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 pb-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                <i className="pi pi-exclamation-triangle text-lg" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="text-base font-bold text-slate-800">
                  Delete Group G{groupNums[confirmDeleteGroupIndex]}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This group contains <strong className="text-slate-800">{groups[confirmDeleteGroupIndex]?.length || 0}</strong> parameter{(groups[confirmDeleteGroupIndex]?.length || 0) !== 1 ? 's' : ''}. Choose how you would like to delete this configuration.
                </p>
              </div>
            </div>

            {/* Info Cards */}
            <div className="px-6 space-y-2">
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg text-xs text-slate-700 flex items-start gap-2.5">
                <i className="pi pi-database text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-amber-800 font-bold">Delete from DB Only:</strong> Removes parameters from MongoDB database only. Gateway hardware keeps running its current board config.
                </div>
              </div>
              <div className="p-3 bg-red-50/60 border border-red-200/80 rounded-lg text-xs text-slate-700 flex items-start gap-2.5">
                <i className="pi pi-trash text-red-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-red-800 font-bold">Delete &amp; Publish to Board:</strong> Removes parameters from database AND sends MQTT delete signal to the hardware gateway.
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 mt-4">
              <button
                onClick={() => setConfirmDeleteGroupIndex(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold text-xs hover:bg-white cursor-pointer transition-all shadow-sm shrink-0"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => deleteGroup(confirmDeleteGroupIndex, true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  title="Remove group from database only"
                >
                  <i className="pi pi-database text-xs" />
                  <span>Delete DB Only</span>
                </button>
                <button
                  onClick={() => deleteGroup(confirmDeleteGroupIndex, false)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  title="Remove group from DB and publish delete command over MQTT"
                >
                  <i className="pi pi-trash text-xs" />
                  <span>Delete &amp; Publish Board</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS INFO MODAL */}
      {showChangelogModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="pi pi-info-circle text-amber-500 text-base" />
                Gateway Board Sync Status & Info
              </h4>
              <button
                onClick={() => setShowChangelogModal(false)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-500">Database Persistence:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <i className="pi pi-check-circle text-xs" />
                    Saved in MongoDB
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-500">Gateway Hardware Board Status:</span>
                  <span className="font-bold text-amber-600 flex items-center gap-1">
                    <i className="pi pi-clock text-xs" />
                    Pending Board ACK
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-500">Total Modbus Groups:</span>
                  <span className="font-bold text-slate-800">{groups.length} Group(s)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Total Configured Parameters:</span>
                  <span className="font-bold text-slate-800">{groups.reduce((acc, g) => acc + g.length, 0)} Parameters</span>
                </div>
              </div>

              <div className="bg-amber-50/60 border border-amber-200/80 p-3 rounded-lg space-y-1">
                <span className="font-bold text-amber-800 block text-[11px] uppercase tracking-wide">Pending Sync Summary</span>
                <p className="leading-relaxed text-amber-900 text-[11px]">
                  All parameter changes, address assignments, scale factors, and group structures are securely saved in your database.
                  If the physical board is offline or timed out during the 10-second ACK window, click <strong>Publish</strong> in the group modal to re-trigger board synchronization anytime.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowChangelogModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                Close Info
              </button>
            </div>
          </div>
        </div>
      )}

      <CountdownModal
        visible={countdown.visible}
        title={countdown.title}
        subtitle={countdown.subtitle}
        duration={10}
        onCancel={handleCancelCountdown}
      />

      {/* Excel/CSV Upload Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[90vw] max-w-[900px] h-[85vh] flex flex-col shadow-2xl border border-slate-200 rounded-xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <i className="pi pi-file-excel text-emerald-650 text-sm" />
                  Import Devices & Parameter Groups via Excel/CSV
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload an Excel-friendly CSV file or manually paste CSV rows to auto-generate mapping and groups.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowExcelModal(false)
                  setImportText('')
                  setParsedRows([])
                }}
                className="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all shrink-0"
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            {/* Split Body */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
              
              {/* Left Pane: Config Inputs */}
              <div className="w-full lg:w-1/2 p-5 border-r border-slate-100 overflow-y-auto space-y-4">
                


                {/* Template Download Card */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 block">Download Excel Format</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Get the Excel CSV template with correct headers, validation rules, and sample values.
                    </p>
                  </div>
                  <button
                    onClick={downloadExcelTemplate}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <i className="pi pi-download text-[10px]" />
                    Download Template
                  </button>
                </div>

                {/* File Upload Dropzone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Upload Spreadsheet (.xlsx, .xls, .csv)</label>
                  <label
                    onDragEnter={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingFile(true)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingFile(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingFile(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingFile(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file) handleFileProcess(file)
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center ${
                      isDraggingFile
                        ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-300 scale-[1.01]'
                        : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
                    }`}
                  >
                    <i className={`pi ${isDraggingFile ? 'pi-arrow-circle-down text-blue-600 scale-125' : 'pi-cloud-upload text-slate-400'} text-2xl mb-2 transition-all`} />
                    <span className="text-xs font-bold text-slate-700">
                      {isDraggingFile ? 'Drop spreadsheet file here' : 'Choose File or Drag & Drop'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Supports Excel (.xlsx, .xls) and CSV (.csv) files</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={handleImportFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Manual Paste Text Area */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Or Paste CSV Data Manually</label>
                  <textarea
                    rows={7}
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.target.value)
                      processImportText(e.target.value)
                    }}
                    placeholder={`Device Name,Slave ID,Group Name,Parameter Name,Function Code,Address,Data Type,Length,Scale Factor,Decimal,Baud Rate,Serial Config
Device1,1,Electrical,P1,4,40001,Int,1,1,None,115200,8N1`}
                    className="w-full border border-slate-200 rounded-lg p-3 text-xs font-mono font-semibold text-slate-700 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50 focus:bg-white"
                  />
                </div>

              </div>

              {/* Right Pane: Validation Output & Previews */}
              <div className="w-full lg:w-1/2 p-5 bg-slate-50/50 overflow-y-auto flex flex-col min-h-0">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 shrink-0">Validation Status & Preview</label>
                
                {/* Error Alerts - Shown even if parsedRows is empty */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200/80 p-4 rounded-xl space-y-2 mb-3 shrink-0">
                    <h4 className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                      <i className="pi pi-exclamation-triangle" />
                      Critical Errors Found ({validationErrors.length})
                    </h4>
                    <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                      {validationErrors.map((err, idx) => (
                        <p key={idx} className="text-[10px] text-red-700 font-semibold font-mono leading-relaxed bg-white border border-red-100 p-1.5 rounded">
                          {err}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings List */}
                {validationWarnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-xl space-y-2 mb-3 shrink-0">
                    <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <i className="pi pi-exclamation-circle" />
                      Warnings Detected ({validationWarnings.length})
                    </h4>
                    <div className="max-h-[100px] overflow-y-auto space-y-1 pr-1">
                      {validationWarnings.map((warn, idx) => (
                        <p key={idx} className="text-[10px] text-amber-700 font-semibold font-mono leading-relaxed bg-white border border-amber-100 p-1.5 rounded">
                          {warn}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {parsedRows.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white p-8">
                    <i className="pi pi-file-import text-3xl text-slate-350 mb-2" />
                    <span className="text-xs font-bold">No Data Loaded</span>
                    <p className="text-[10px] text-slate-400 max-w-[260px] mt-1">
                      Upload an Excel (.xlsx, .xls) or CSV file, or drag and drop a file, or paste raw data on the left to activate parser.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 space-y-4">

                    {/* Success Overview */}
                    {validationErrors.length === 0 && (
                      <div className="bg-emerald-50 border border-emerald-200/60 p-4 rounded-xl shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <i className="pi pi-check text-xs" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-emerald-800">Format Validated Successfully</span>
                            <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                              Ready to import {parsedRows.length} Modbus parameters.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Preview Table */}
                    <div className="flex-1 flex flex-col border border-slate-200 rounded-xl bg-white overflow-hidden min-h-0 font-sans">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 p-2.5 border-b border-slate-200 block shrink-0">Data Preview ({parsedRows.length} Rows)</span>
                      <div className="flex-1 overflow-auto text-[10px]">
                        <table className="min-w-full divide-y divide-slate-105">
                          <thead className="bg-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                              <th className="p-2 text-left bg-slate-50">Device</th>
                              <th className="p-2 text-left bg-slate-50">Slave</th>
                              <th className="p-2 text-left bg-slate-50">Group</th>
                              <th className="p-2 text-left bg-slate-50">Param</th>
                              <th className="p-2 text-left bg-slate-50">Addr</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {parsedRows.map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{r.deviceName}</td>
                                <td className="p-2 text-slate-500 font-mono">{r.slaveId}</td>
                                <td className="p-2 text-slate-500">{r.groupName}</td>
                                <td className="p-2 text-blue-600 font-semibold">{r.parameterName}</td>
                                <td className="p-2 text-slate-600 font-mono">{r.address}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 p-4 flex items-center justify-between shrink-0 bg-slate-50">
              <button
                onClick={() => {
                  setShowExcelModal(false)
                  setImportText('')
                  setParsedRows([])
                }}
                className="px-4 py-2 border border-slate-350 hover:bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyImport}
                disabled={validationErrors.length > 0 || parsedRows.length === 0}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm select-none"
              >
                <i className="pi pi-check-circle text-xs" />
                <span>Import and Apply Config</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Max Parameters Limit Modal */}
      <Dialog
        header="Edit Maximum Parameter Limit"
        visible={editMaxParamsDialog}
        onHide={() => setEditMaxParamsDialog(false)}
        draggable={false}
        className="w-full max-w-sm"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditMaxParamsDialog(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMaxParams}
              disabled={savingMaxParams}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm"
            >
              {savingMaxParams ? 'Saving...' : 'Save Limit'}
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-3 text-xs text-slate-600">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Max Allowed Parameters</label>
            <input
              type="number"
              min={Math.max(1, totalParamCount)}
              max={5000}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setNewMaxParams('')
                } else {
                  const parsed = parseInt(val, 10)
                  setNewMaxParams(isNaN(parsed) ? '' : Math.max(1, parsed))
                }
              }}
              className="w-full border border-slate-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
            />
            <p className="text-[10px] text-slate-400">
              Current total parameters: <strong className="text-slate-700 font-bold">{totalParamCount}</strong> (across {groups.length} groups). Allocates 50 parameters per group.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
