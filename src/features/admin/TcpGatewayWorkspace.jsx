import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import * as XLSX from 'xlsx'
import { tcpGatewaysApi as api } from '../../services/tcpGatewaysApi'
import { getSocket } from '../../services/socketClient'
import CountdownModal from '../../components/shared/CountdownModal'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { TCP_HEADERS, importTcpRows, newTcpRow, parseTcpPayload, reconcileTcpGroups, retainTcpImportIdentities, tcpDeviceId, validateTcpDevices, validateTcpGroups } from '../../utils/tcpConfig'

const field = 'border border-slate-200 rounded px-2 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50'
const primary = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const secondary = 'px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const statusInfo = group => group.dirty || group.publishStatus === 'draft'
  ? { label: 'Unsaved', classes: 'bg-slate-100 text-slate-600' }
  : group.publishStatus === 'success' ? { label: 'DB + Board', classes: 'bg-emerald-50 text-emerald-700' }
    : { label: group.publishStatus === 'failed' ? 'Publish failed' : 'DB Only', classes: 'bg-amber-50 text-amber-700' }
const defaultDevice = () => ({ deviceId: tcpDeviceId(), slaveId: 1, deviceName: 'Device1', ipAddress: '' })
const freshGroup = (number, device) => ({ groupNum: number, rows: [newTcpRow(device, (number - 1) * 50 + 1)], dirty: true, publishStatus: 'draft' })

export default function TcpGatewayWorkspace({ gatewayId, gateway, tab, canDevices, canPublish, canRead }) {
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState([])
  const [groups, setGroups] = useState([])
  const [deviceView, setDeviceView] = useState('grid')
  const [savingDevices, setSavingDevices] = useState(false)
  const [notice, setNotice] = useState(null)
  const [pending, setPending] = useState(null)
  const [pendingDeletes, setPendingDeletes] = useState([])
  const [editor, setEditor] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [readGroups, setReadGroups] = useState([])
  const [readPartial, setReadPartial] = useState(false)
  const [readProgress, setReadProgress] = useState([])
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [history, setHistory] = useState(null)
  const [historySelection, setHistorySelection] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const devicesRef = useRef(devices), groupsRef = useRef(groups)
  const pendingRef = useRef(null), readRef = useRef([]), startedAt = useRef(0)
  const loadedRef = useRef(false), mountedRef = useRef(true), savedDevicesRef = useRef('')
  const saveQueueRef = useRef(Promise.resolve()), storedGroupsRef = useRef(new Set())
  const submittedRef = useRef(new Map()), operationRef = useRef(0)
  const loadSequenceRef = useRef(0)
  const maxParameters = gateway.maxParameters || 1000
  const maxGroups = Math.ceil(maxParameters / 50)
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
  const currentGroup = editor?.kind === 'read'
    ? readGroups.find(group => group.groupNum === editor.groupNum)
    : groups.find(group => group.groupNum === editor?.groupNum)

  useEffect(() => { devicesRef.current = devices }, [devices])
  useEffect(() => { groupsRef.current = groups }, [groups])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; operationRef.current = 0 } }, [])

  const notify = (text, type = 'warning') => setNotice({ text, type })
  const load = useCallback(async () => {
    const loadSequence = ++loadSequenceRef.current
    if (!canDevices && !canPublish && !canRead) { setLoading(false); return }
    try {
      const state = await api.getState(gatewayId)
      if (!mountedRef.current || loadSequence !== loadSequenceRef.current) return
      const list = state.devices?.length ? state.devices : [defaultDevice()]
      savedDevicesRef.current = JSON.stringify(state.devices || [])
      setDevices(list)
      const restored = reconcileTcpGroups(state.config?.groups?.map(group => ({ ...group, dirty: false })) || [], list)
      setGroups(restored.length ? restored : [freshGroup(1, list[0])])
      storedGroupsRef.current = new Set(restored.map(group => group.groupNum))
      setPendingDeletes((state.config?.pendingBoardDeletes || []).map(item => item.groupNum))
      loadedRef.current = true
    } catch (error) { if (mountedRef.current && loadSequence === loadSequenceRef.current) setNotice({ text: error.message, type: 'warning' }) }
    finally { if (mountedRef.current && loadSequence === loadSequenceRef.current) setLoading(false) }
  }, [gatewayId, canDevices, canPublish, canRead])
  useEffect(() => {
    load()
    const sequenceRef = loadSequenceRef
    return () => { sequenceRef.current++ }
  }, [load])

  const saveDevices = useCallback((list) => {
    const errors = validateTcpDevices(list)
    if (errors.length) return Promise.reject(new Error(errors[0]))
    const snapshot = list.map(device => ({ deviceId: device.deviceId, deviceName: device.deviceName.trim(), slaveId: Number(device.slaveId), ipAddress: device.ipAddress.trim() }))
    const queued = saveQueueRef.current.catch(() => {}).then(async () => {
      if (!mountedRef.current) return
      setSavingDevices(true)
      try {
        await api.saveDevices(gatewayId, snapshot)
        savedDevicesRef.current = JSON.stringify(list)
      } finally { if (mountedRef.current) setSavingDevices(false) }
    })
    saveQueueRef.current = queued
    return queued
  }, [gatewayId])

  useEffect(() => {
    if (!loadedRef.current || !canDevices || JSON.stringify(devices) === savedDevicesRef.current || validateTcpDevices(devices).length) return
    const timer = setTimeout(() => {
      saveDevices(devices).catch(error => { if (mountedRef.current) setNotice({ type: 'warning', text: `TCP devices could not be saved: ${error.message}` }) })
    }, 500)
    return () => clearTimeout(timer)
  }, [devices, canDevices, saveDevices])

  const stopWaiting = useCallback(() => {
    const operation = pendingRef.current
    if (operation) {
      const timeout = Date.now() - startedAt.current >= 9500
      setNotice({ type: 'warning', text: timeout
        ? operation.kind === 'read' ? 'Read window ended. Showing the TCP groups received so far.' : 'The board has not acknowledged every TCP command within 10 seconds. Check the group status before retrying.'
        : 'Stopped waiting. Commands already sent to the board are not cancelled.' })
    }
    pendingRef.current = null
    setPending(null)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const complete = (key) => {
      const operation = pendingRef.current
      if (!operation || operation.kind === 'read') return
      operation.waiting.delete(key)
      if (!operation.waiting.size) {
        pendingRef.current = null
        setPending(null)
        setNotice({ type: 'success', text: 'The gateway board acknowledged all requested TCP configuration changes.' })
      }
    }
    const ack = data => {
      if (String(data.gatewayId) !== String(gatewayId)) return
      setGroups(previous => previous.map(group => {
        if (group.groupNum !== data.groupNum) return group
        const submitted = submittedRef.current.get(group.groupNum)
        if (submitted && submitted !== JSON.stringify(group.rows)) return group
        if (group.dirty && !submitted) return group
        return { ...group, publishStatus: 'success', dirty: false }
      }))
      complete(`publish:${data.groupNum}`)
    }
    const deleted = data => {
      if (String(data.gatewayId) !== String(gatewayId)) return
      setPendingDeletes(previous => previous.filter(number => number !== data.groupNum))
      complete(`delete:${data.groupNum}`)
    }
    const addReadGroup = data => {
      const parsed = parseTcpPayload(data.payload)
      const saved = groupsRef.current.flatMap(group => group.rows)
      const enriched = parsed.rows.map(row => {
        const metadata = saved.find(item => item.parameterName.toUpperCase() === row.parameterName)
        const device = devicesRef.current.find(item => Number(item.slaveId) === row.slaveId)
        return { ...row, deviceName: device?.deviceName || metadata?.deviceName || `Device${row.slaveId}`,
          scaleFactor: metadata?.scaleFactor ?? 1, decimal: metadata?.decimal ?? 'None' }
      })
      const group = { groupNum: data.groupNum, rows: enriched, errors: parsed.errors }
      readRef.current = [...readRef.current.filter(item => item.groupNum !== data.groupNum), group].sort((a, b) => a.groupNum - b.groupNum)
      setReadGroups(readRef.current)
      setReadProgress(previous => [...new Set([...previous, data.groupNum])])
      if (parsed.errors.length) setNotice({ type: 'warning', text: parsed.errors[0] })
    }
    const onGroup = data => { if (String(data.gatewayId) === String(gatewayId)) addReadGroup(data) }
    const onRead = data => {
      if (String(data.gatewayId) !== String(gatewayId)) return
      for (const group of data.groups || []) addReadGroup(group)
      setReadPartial(!!data.partial)
      if (pendingRef.current?.kind === 'read') {
        pendingRef.current = null
        setPending(null)
        setNotice({ type: data.partial ? 'warning' : 'success', text: data.receivedGroups?.length
          ? `Received ${data.receivedGroups.length} TCP group response(s)${data.partial ? '; some groups did not respond.' : '.'}`
          : 'No TCP configuration response received from the gateway.' })
      }
    }
    socket?.on('gateway:tcp-setconfig-ack', ack)
    socket?.on('gateway:tcp-delete-ack', deleted)
    socket?.on('gateway:tcp-config-group-response', onGroup)
    socket?.on('gateway:tcp-config-response', onRead)
    return () => {
      socket?.off('gateway:tcp-setconfig-ack', ack)
      socket?.off('gateway:tcp-delete-ack', deleted)
      socket?.off('gateway:tcp-config-group-response', onGroup)
      socket?.off('gateway:tcp-config-response', onRead)
      pendingRef.current = null
    }
  }, [gatewayId])

  const begin = (kind, waiting = []) => {
    if (pendingRef.current) return false
    if (!getSocket()?.connected) { notify('Live connection is unavailable. Wait for reconnection, then retry.'); return false }
    const operation = { kind, waiting: new Set(waiting) }
    pendingRef.current = operation
    startedAt.current = Date.now()
    operationRef.current++
    setPending(kind)
    setNotice(null)
    return true
  }
  const fail = error => { pendingRef.current = null; setPending(null); notify(error.message || 'TCP request failed.') }

  const changeDevice = (index, key, value) => {
    const old = devices[index], next = { ...old, [key]: key === 'deviceName' ? value.replace(/\s+/g, '') : value }
    setDevices(previous => previous.map((device, position) => position === index ? next : device))
    setGroups(previous => previous.map(group => {
      let changed = false
      const rows = group.rows.map(row => {
        if (row.deviceId && old.deviceId ? row.deviceId !== old.deviceId : row.deviceName !== old.deviceName && Number(row.slaveId) !== Number(old.slaveId)) return row
        changed = true
        return { ...row, deviceId: next.deviceId, deviceName: next.deviceName, slaveId: next.slaveId, ipAddress: next.ipAddress }
      })
      return changed ? { ...group, rows, dirty: true } : group
    }))
  }
  const addDevice = () => {
    const usedSlaves = new Set(devices.map(device => Number(device.slaveId)))
    let slaveId = 1, number = 1
    while (usedSlaves.has(slaveId)) slaveId++
    while (devices.some(device => device.deviceName === `Device${number}`)) number++
    if (slaveId > 247) { notify('All Slave IDs from 1 to 247 are in use.'); return }
    const device = { deviceId: tcpDeviceId(), slaveId, deviceName: `Device${number}`, ipAddress: '' }
    setDevices(previous => [...previous, device])
    return device
  }
  const changeRow = (groupNum, index, key, value) => {
    setGroups(previous => previous.map(group => {
      if (group.groupNum !== groupNum) return group
      const rows = group.rows.map((row, position) => {
        if (position !== index) return row
        if (key === 'deviceName') {
          const device = devices.find(item => item.deviceName === value)
          return device ? { ...row, ...device } : row
        }
        if (key === 'dataType') return { ...row, dataType: value, length: value === 'f' ? 2 : 1 }
        return { ...row, [key]: value }
      })
      return { ...group, rows, dirty: true }
    }))
  }
  const addRow = (groupNum, deviceName, newDevice = null) => {
    const group = groups.find(item => item.groupNum === groupNum)
    const capacity = Math.min(50, maxParameters - (groupNum - 1) * 50)
    if (group.rows.length >= capacity || total >= maxParameters) { notify(`G${groupNum} has reached its parameter capacity.`); return }
    const device = newDevice || devices.find(item => item.deviceName === deviceName) || devices[0]
    if (!device) { notify('Add a TCP device first.'); return }
    const used = new Set(group.rows.map(row => row.parameterName.toUpperCase()))
    let number = (groupNum - 1) * 50 + 1
    while (used.has(`T${number}`)) number++
    setGroups(previous => previous.map(item => item.groupNum === groupNum ? { ...item, dirty: true, rows: [...item.rows, newTcpRow(device, number)] } : item))
  }
  const deleteRow = (groupNum, index) => {
    const group = groups.find(item => item.groupNum === groupNum)
    if (group.rows.length === 1) { notify('At least one parameter is required per group. Delete the group to remove its last parameter.'); return }
    setGroups(previous => previous.map(item => item.groupNum === groupNum ? { ...item, dirty: true, rows: item.rows.filter((_, position) => position !== index) } : item))
  }
  const addGroup = () => {
    const last = groups.at(-1)
    if (last && last.rows.length < Math.min(50, maxParameters - (last.groupNum - 1) * 50)) { notify(`Fill G${last.groupNum} before creating another group.`); return }
    const number = last ? last.groupNum + 1 : 1
    if (number > maxGroups || total >= maxParameters) { notify('TCP group capacity reached.'); return }
    if (!devices.length) { notify('Add a device first.'); return }
    setGroups(previous => [...previous, freshGroup(number, devices[0])])
  }

  const publishGroups = async (selected, replace = false, deviceList = devices) => {
    if (!canPublish) return
    const errors = validateTcpGroups(selected, deviceList, maxParameters)
    if (errors.length) { notify(errors[0]); return }
    const removed = replace ? [...storedGroupsRef.current].filter(number => !selected.some(group => group.groupNum === number)) : []
    if (!begin('publish', [...selected.map(group => `publish:${group.groupNum}`), ...removed.map(number => `delete:${number}`)])) return
    const sequence = operationRef.current
    const operation = pendingRef.current
    for (const group of selected) submittedRef.current.set(group.groupNum, JSON.stringify(group.rows))
    try {
      if (canDevices) await saveDevices(deviceList)
      if (!mountedRef.current || pendingRef.current !== operation || sequence !== operationRef.current) return
      setPendingDeletes(previous => [...new Set([...previous, ...removed])])
      setGroups(previous => previous.map(group => selected.some(item => item.groupNum === group.groupNum) ? { ...group, dirty: false, publishStatus: 'pending' } : group))
      const result = await api.publish(gatewayId, selected, replace)
      if (!mountedRef.current) return
      storedGroupsRef.current = new Set(result.config.groups.map(group => group.groupNum))
      // A fast ACK may already have committed groups. Never overwrite it here.
    } catch (error) { if (mountedRef.current && pendingRef.current === operation && sequence === operationRef.current) fail(error) }
  }
  const removeGroup = async (groupNum, dbOnly) => {
    setConfirmation(null)
    if (!storedGroupsRef.current.has(groupNum) && !pendingDeletes.includes(groupNum)) {
      setGroups(previous => previous.filter(group => group.groupNum !== groupNum)); setEditor(null); return
    }
    if (!dbOnly && !begin('delete', [`delete:${groupNum}`])) return
    try {
      if (!dbOnly) setPendingDeletes(previous => [...new Set([...previous, groupNum])])
      await api.deleteGroup(gatewayId, groupNum, dbOnly)
      storedGroupsRef.current.delete(groupNum)
      setGroups(previous => previous.filter(group => group.groupNum !== groupNum))
      setEditor(null)
      if (dbOnly) { setPendingDeletes(previous => previous.filter(number => number !== groupNum)); notify(`G${groupNum} deleted from the TCP database only.`, 'success') }
    } catch (error) { fail(error) }
  }
  const removeDevice = async index => {
    const device = devices[index]
    const matchesDevice = row => row.deviceId && device.deviceId ? row.deviceId === device.deviceId
      : row.deviceName === device.deviceName || Number(row.slaveId) === Number(device.slaveId)
    const nextDevices = devices.filter((_, position) => position !== index)
    const nextGroups = groups.map(group => ({ ...group, dirty: true, rows: group.rows.filter(row => !matchesDevice(row)) })).filter(group => group.rows.length)
    setConfirmation(null)
    try {
      const errors = validateTcpDevices(nextDevices)
      if (errors.length) throw new Error(errors[0])
      const linked = groups.some(group => group.rows.some(matchesDevice))
      if (linked && !canPublish) throw new Error('Publish permission is required to remove a device with linked parameters.')
      if (linked && !getSocket()?.connected) throw new Error('Live connection is unavailable. Reconnect before deleting a device with linked parameters.')
      if (linked && nextGroups.length) {
        const groupErrors = validateTcpGroups(nextGroups, nextDevices, maxParameters)
        if (groupErrors.length) throw new Error(groupErrors[0])
      }
      await saveDevices(nextDevices)
      setDevices(nextDevices)
      setGroups(nextGroups)
      if (linked && nextGroups.length) await publishGroups(nextGroups, true, nextDevices)
      else if (linked) {
        const numbers = [...storedGroupsRef.current]
        if (numbers.length && !begin('delete', numbers.map(number => `delete:${number}`))) return
        setPendingDeletes(previous => [...new Set([...previous, ...numbers])])
        for (const number of numbers) await api.deleteGroup(gatewayId, number)
        storedGroupsRef.current.clear()
      } else notify('TCP device mapping removed.', 'success')
    } catch (error) { fail(error) }
  }
  const readConfig = async () => {
    if (!canRead || !begin('read')) return
    readRef.current = []; setReadGroups([]); setReadProgress([]); setReadPartial(false)
    try { await api.read(gatewayId) } catch (error) { fail(error) }
  }

  const parseImport = text => {
    setImportText(text)
    if (!text.trim()) { setImportResult(null); return }
    try {
      const sheet = XLSX.read(text, { type: 'string' })
      const records = XLSX.utils.sheet_to_json(sheet.Sheets[sheet.SheetNames[0]], { defval: '' })
      setImportResult(importTcpRows(records, maxParameters))
    } catch (error) { setImportResult({ groups: [], devices: [], errors: [error.message] }) }
  }
  const processFile = async file => {
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      if (!workbook.SheetNames.length) throw new Error('Spreadsheet contains no worksheet.')
      parseImport(XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]))
    } catch (error) { setImportResult({ errors: [error.message], groups: [], devices: [] }) }
  }
  const applyImport = async () => {
    if (!importResult || importResult.errors.length || !canDevices || !canPublish) return
    try {
      const imported = retainTcpImportIdentities(importResult, devices)
      await saveDevices(imported.devices)
      setDevices(imported.devices); setGroups(imported.groups); setShowImport(false)
      notify('TCP devices saved. Parameter groups are unsaved until you publish them.', 'success')
    } catch (error) { fail(error) }
  }
  const exportGroups = (selected, source) => {
    const data = [TCP_HEADERS]
    selected.forEach(group => group.rows.forEach(row => data.push([
      row.deviceName, row.ipAddress || devices.find(device => Number(device.slaveId) === Number(row.slaveId))?.ipAddress || '',
      row.slaveId, `G${group.groupNum}`, row.parameterName, row.functionCode, row.address,
      row.dataType === 'f' ? 'Float' : 'Int', row.length, row.scaleFactor ?? 1, row.decimal ?? 'None'
    ])))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), 'TCP Configuration')
    XLSX.writeFile(workbook, `${gateway.prefix}_tcp_${source}.xlsx`)
  }
  const template = () => exportGroups([{ groupNum: 1, rows: [
    { ...newTcpRow({ deviceName: 'Device1', slaveId: 1, ipAddress: '192.168.1.10' }, 1), address: 1024 },
    { ...newTcpRow({ deviceName: 'Device1', slaveId: 1, ipAddress: '192.168.1.10' }, 2), address: 1025 }
  ] }], 'template')
  const showHistory = async () => {
    setHistory([]); setHistoryLoading(true)
    try { setHistory((await api.history(gatewayId)).history) } catch (error) { notify(error.message) }
    finally { setHistoryLoading(false) }
  }

  if (loading) return <LoadingSpinner text="Loading Modbus TCP configuration..." />
  if (!canDevices && !canPublish && !canRead) return <p className="text-sm text-slate-500 p-6">TCP controls are not enabled for your account.</p>
  const deviceErrors = validateTcpDevices(devices)

  return <div className="space-y-4">
    {notice && <p role="status" className={`border rounded-lg p-3 text-xs ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{notice.text}</p>}

    <div hidden={tab !== 'Device List'}>
      {canDevices ? <section className="bg-white border border-slate-200/80 p-5 space-y-5 rounded-xl">
        <div className="flex flex-wrap justify-between gap-3 items-center border-b border-slate-100 pb-4">
          <div><h3 className="text-sm font-bold text-slate-800">Gateway TCP Device Mapping</h3><p className="text-xs text-slate-500 mt-1">Each Slave ID maps to one unique IPv4 address. Valid changes save automatically.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-400">{savingDevices ? 'Saving...' : deviceErrors.length ? 'Complete device fields to save' : 'Auto-save enabled'}</span>
            <button type="button" className={secondary} onClick={() => setDeviceView(previous => previous === 'grid' ? 'table' : 'grid')}><i className={deviceView === 'grid' ? 'pi pi-list' : 'pi pi-th-large'} aria-hidden="true" />{deviceView === 'grid' ? 'Table' : 'Grid'}</button>
            {deviceView === 'table' && <button type="button" className={primary} onClick={addDevice} disabled={!!pending}><i className="pi pi-plus" aria-hidden="true" />Add Device</button>}
          </div>
        </div>
        {deviceErrors.length > 0 && <p className="text-xs text-amber-700">{deviceErrors[0]}</p>}
        <div className={deviceView === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'}>
          {devices.map((device, index) => <div key={index} className={`tcp-device-card border border-slate-200 rounded-xl p-4 gap-3 ${deviceView === 'table' ? 'grid grid-cols-1 sm:grid-cols-[90px_1fr_1fr_36px] items-end' : 'grid grid-cols-2'}`}>
            <label className="space-y-1"><span className="text-[10px] uppercase font-bold text-slate-400">Slave ID</span><input aria-label={`TCP device ${index + 1} Slave ID`} type="number" min="1" max="247" className={`${field} w-full`} value={device.slaveId} disabled={!!pending} onChange={event => changeDevice(index, 'slaveId', event.target.value === '' ? '' : Number(event.target.value))} /></label>
            <label className="space-y-1"><span className="text-[10px] uppercase font-bold text-slate-400">Device Name</span><input aria-label={`TCP device ${index + 1} name`} className={`${field} w-full`} value={device.deviceName} disabled={!!pending} onChange={event => changeDevice(index, 'deviceName', event.target.value)} /></label>
            <label className={`space-y-1 ${deviceView === 'grid' ? 'col-span-2' : ''}`}><span className="text-[10px] uppercase font-bold text-slate-400">IP Address</span><input aria-label={`TCP device ${index + 1} IP address`} inputMode="decimal" placeholder="192.168.1.10" className={`${field} w-full`} value={device.ipAddress} disabled={!!pending} onChange={event => changeDevice(index, 'ipAddress', event.target.value.trim())} /></label>
            <button type="button" aria-label={`Delete TCP device ${device.deviceName}`} className={`${secondary} ${deviceView === 'grid' ? 'col-span-2 justify-center' : 'justify-center px-2'}`} disabled={!!pending || devices.length <= 1} onClick={() => setConfirmation({ kind: 'device', index })}><i className="pi pi-trash text-red-500" aria-hidden="true" />{deviceView === 'grid' ? 'Remove Device' : ''}</button>
          </div>)}
          {deviceView === 'grid' && <button type="button" onClick={addDevice} disabled={!!pending} className="tcp-device-card border-2 border-dashed border-slate-200 enabled:hover:border-blue-400 p-6 flex flex-col items-center justify-center cursor-pointer enabled:hover:bg-blue-50/30 transition-all text-center min-h-[130px] disabled:opacity-50 disabled:cursor-not-allowed">
            <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2"><i className="pi pi-plus text-xs" aria-hidden="true" /></span>
            <span className="text-xs font-bold text-slate-600">Add New Device</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Configure Slave ID, Device Name &amp; IP Address</span>
          </button>}
        </div>
        {!devices.length && <p className="text-xs text-slate-500">Add a TCP device to begin.</p>}
      </section> : <p className="text-sm text-slate-500 p-6">Device List access is disabled.</p>}
    </div>

    <div hidden={tab !== 'Publish'} className="space-y-4">
      {canPublish ? <>
        {groups.some(group => group.dirty || group.publishStatus !== 'success') && <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex flex-wrap justify-between items-center gap-3"><p>TCP configuration has unsaved changes or groups awaiting board acknowledgement.</p><button type="button" className={primary} disabled={!!pending} onClick={() => publishGroups(groups, true)}>Publish All</button></div>}
        {pendingDeletes.length > 0 && <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-800 space-y-2"><p>Awaiting board deletion: {pendingDeletes.map(number => `G${number}`).join(', ')}</p><div className="flex gap-2 flex-wrap">{pendingDeletes.map(number => <button type="button" key={number} className={secondary} disabled={!!pending} onClick={() => removeGroup(number, false)}>Re-send Delete G{number}</button>)}</div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div><h3 className="text-xs uppercase font-bold tracking-wide text-slate-500">Modbus TCP Groups</h3><p className="text-[11px] text-slate-400 mt-1">{total} / {maxParameters} parameters · {groups.length} / {maxGroups} groups</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={showHistory} disabled={!canRead}>Config History</button>
            <button type="button" className={secondary} disabled={!groups.length} onClick={() => exportGroups(groups, 'config')}><i className="pi pi-file-excel text-emerald-600" aria-hidden="true" />Export Excel</button>
            <button type="button" className={secondary} disabled={!canDevices || !!pending} onClick={() => { setShowImport(true); setImportText(''); setImportResult(null) }}>Upload Excel Data</button>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400">Device IP addresses</p>
          <div className="flex flex-wrap gap-2">{devices.map(device => <span key={device.deviceName} className="text-xs border border-slate-200 rounded bg-white px-2 py-1 text-slate-600"><strong>{device.deviceName}</strong><span className="mx-1.5 text-slate-300">·</span><span className="font-mono">{device.ipAddress || 'IP required'}</span></span>)}</div>
        </div>
        <div className="flex flex-wrap gap-4">
          {groups.map(group => {
            const status = statusInfo(group)
            return <div key={group.groupNum} className="relative group">
              <button type="button" className="tcp-group-card w-[130px] h-[115px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-card)] group-hover:bg-[var(--accent-primary)] group-hover:border-[var(--accent-primary)] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer" onClick={() => setEditor({ kind: 'publish', groupNum: group.groupNum })}>
                <span className="font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--accent-contrast)] transition-colors duration-300">G{group.groupNum}</span><span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-contrast)]/85 transition-colors duration-300">{group.rows.length} parameters</span><span className={`text-[9px] font-bold rounded-full px-2 py-1 ${status.classes} group-hover:bg-white/20 group-hover:text-[var(--accent-contrast)] transition-colors duration-300`}>{status.label}</span>
              </button>
              <button type="button" aria-label={`Delete TCP group G${group.groupNum}`} className="absolute top-1 right-1 p-1.5 text-[var(--text-secondary)] group-hover:text-[var(--accent-contrast)]/60 hover:text-red-400 group-hover:hover:text-red-300 transition-colors duration-300 cursor-pointer" disabled={!!pending} onClick={() => setConfirmation({ kind: 'group', groupNum: group.groupNum })}><i className="pi pi-trash text-[10px]" aria-hidden="true" /></button>
            </div>
          })}
          <button type="button" className="tcp-group-card w-[130px] h-[115px] border-2 border-dashed border-emerald-300 rounded-lg text-emerald-700 flex flex-col items-center justify-center gap-2 cursor-pointer enabled:hover:border-emerald-400 enabled:hover:bg-emerald-50 transition-all duration-300 disabled:opacity-40" disabled={!!pending || total >= maxParameters || (groups.at(-1)?.groupNum || 0) >= maxGroups} onClick={addGroup}><i className="pi pi-plus text-xl" aria-hidden="true" /><span className="text-xs font-bold">Create Group</span></button>
        </div>
      </> : <p className="text-sm text-slate-500 p-6">Publish access is disabled.</p>}
    </div>

    <div hidden={tab !== 'Read'} className="space-y-4">
      {canRead ? <>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">Live TCP Config Read from Gateway</h3><div className="flex gap-2"><button type="button" className={secondary} disabled={!readGroups.some(group => group.rows.length)} onClick={() => exportGroups(readGroups, 'live_config')}>Export Excel</button><button type="button" className={primary} disabled={!!pending} onClick={readConfig}><i className={pending === 'read' ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'} aria-hidden="true" />Read from Gateway</button></div></div>
        {!!readProgress.length && <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-3">Received: {[...readProgress].sort((a, b) => a - b).map(number => `G${number}`).join(', ')}</p>}
        {readPartial && <p className="text-xs text-amber-700">Partial response — some TCP groups did not respond.</p>}
        <div className="flex flex-wrap gap-4">{readGroups.filter(group => group.rows.length || group.errors?.length).map(group => <button key={group.groupNum} type="button" className="tcp-group-card group w-[120px] h-[100px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-card)] hover:bg-[var(--accent-primary)] hover:border-[var(--accent-primary)] focus-visible:bg-[var(--accent-primary)] focus-visible:border-[var(--accent-primary)] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-center items-center gap-1 cursor-pointer" onClick={() => setEditor({ kind: 'read', groupNum: group.groupNum })}><span className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-contrast)] group-focus-visible:text-[var(--accent-contrast)] transition-colors duration-300">G{group.groupNum}</span><span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--accent-contrast)]/85 group-focus-visible:text-[var(--accent-contrast)] transition-colors duration-300">{group.rows.length} parameters</span></button>)}</div>
        {!readGroups.length && <p className="text-xs text-slate-400 p-8 text-center border border-dashed border-slate-200 rounded-lg">Read from the gateway to view its TCP group configuration.</p>}
      </> : <p className="text-sm text-slate-500 p-6">Read access is disabled.</p>}
    </div>

    <Dialog header={currentGroup ? `G${currentGroup.groupNum} — ${editor.kind === 'read' ? 'Received TCP Config (Read-Only)' : 'Modbus TCP Configuration'}` : 'TCP Configuration'} visible={!!editor} onHide={() => setEditor(null)} draggable={false} style={{ width: '95vw', maxWidth: 1200 }}>
      {currentGroup && <div className="space-y-4">
        {notice && <p role={notice.type === 'success' ? 'status' : 'alert'} className={`border rounded-lg p-3 text-xs ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{notice.text}</p>}
        <p className="text-xs text-slate-500">{new Set(currentGroup.rows.map(row => row.slaveId)).size} devices · {currentGroup.rows.length} parameters</p>
        {currentGroup.errors?.map(error => <p key={error} className="text-xs text-red-600">{error}</p>)}
        <TcpConfigTable rows={currentGroup.rows} devices={devices} readOnly={editor.kind === 'read' || !!pending}
          change={(index, key, value) => changeRow(currentGroup.groupNum, index, key, value)}
          add={name => addRow(currentGroup.groupNum, name)} remove={index => deleteRow(currentGroup.groupNum, index)} />
        {editor.kind === 'publish' && <div className="flex justify-between items-center pt-3 border-t border-slate-100 gap-3">
          <button type="button" className={secondary} disabled={!!pending} onClick={() => {
            const unused = devices.find(device => !currentGroup.rows.some(row => row.deviceName === device.deviceName))
            if (unused) addRow(currentGroup.groupNum, unused.deviceName)
            else if (canDevices) {
              const device = addDevice()
              if (device) { addRow(currentGroup.groupNum, device.deviceName, device); notify('New TCP device added. Enter its unique IP address in Device List before publishing.') }
            } else notify('Add another device in TCP Device List before using it in this group.')
          }}><i className="pi pi-plus text-[10px]" aria-hidden="true" />Add Device</button>
          <button type="button" className={primary} disabled={!!pending || !canPublish} onClick={() => publishGroups([currentGroup])}>Publish G{currentGroup.groupNum}</button>
        </div>}
      </div>}
    </Dialog>

    <Dialog header={confirmation?.kind === 'group' ? `Delete TCP Group G${confirmation.groupNum}` : 'Delete TCP Device'} visible={!!confirmation} onHide={() => setConfirmation(null)} draggable={false} style={{ width: '90vw', maxWidth: 520 }}>
      {confirmation?.kind === 'group' ? <div className="space-y-4"><p className="text-xs text-slate-600">Database-only deletion leaves the hardware configuration unchanged. Board deletion also sends the TCP group delete command. Related TCP tags and assignments will be removed.</p><div className="flex gap-2 justify-end"><button type="button" className={secondary} onClick={() => setConfirmation(null)}>Cancel</button><button type="button" className={secondary} onClick={() => removeGroup(confirmation.groupNum, true)}>Delete DB Only</button><button type="button" className={primary} onClick={() => removeGroup(confirmation.groupNum, false)}>Delete & Publish Board</button></div></div>
        : confirmation && <div className="space-y-4"><p className="text-xs text-slate-600">Remove {devices[confirmation.index]?.deviceName}? Its linked TCP parameters will also be removed and the updated configuration published. RTU devices and parameters are unaffected.</p><div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={() => setConfirmation(null)}>Cancel</button><button type="button" className={primary} onClick={() => removeDevice(confirmation.index)}>Delete Device & Linked Data</button></div></div>}
    </Dialog>

    <Dialog header="Import TCP Devices & Parameter Groups" visible={showImport} onHide={() => setShowImport(false)} draggable={false} style={{ width: '95vw', maxWidth: 1100 }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Import replaces the TCP editing workspace. Device IPs save immediately; publish the groups to update the board.</p>
          <button type="button" className={secondary} onClick={template}>Download Template</button>
          <label className={`block p-6 text-center border-2 border-dashed rounded-lg text-xs cursor-pointer ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); processFile(event.dataTransfer.files?.[0]) }}>
            Choose Excel/CSV File or Drag & Drop<input type="file" accept=".xlsx,.xls,.csv" className="block mt-3 w-full text-xs" onChange={event => { processFile(event.target.files?.[0]); event.target.value = '' }} />
          </label>
          <label className="block text-xs font-bold text-slate-600">Or paste CSV<textarea className={`${field} mt-2 w-full font-mono`} rows="9" value={importText} onChange={event => parseImport(event.target.value)} placeholder={TCP_HEADERS.join(',')} /></label>
        </div>
        <div className="space-y-3 max-h-[420px] overflow-auto">
          {importResult?.errors?.map(error => <p key={error} className="p-2 bg-red-50 text-red-700 text-xs rounded">{error}</p>)}
          {importResult && !importResult.errors.length && <p className="text-xs text-emerald-700">Ready to import {importResult.groups.reduce((sum, group) => sum + group.rows.length, 0)} TCP parameters.</p>}
          {importResult?.groups?.map(group => <div key={group.groupNum} className="border border-slate-200 rounded p-3 text-xs"><strong>G{group.groupNum}</strong><p className="mt-1 text-slate-500">{group.rows.map(row => row.parameterName).join(', ')}</p></div>)}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100"><button type="button" className={secondary} onClick={() => setShowImport(false)}>Cancel</button><button type="button" className={primary} disabled={!importResult || !!importResult.errors.length || !importResult.groups.length} onClick={applyImport}>Import TCP Configuration</button></div>
    </Dialog>

    <Dialog header="TCP Configuration History" visible={history !== null} onHide={() => { setHistory(null); setHistorySelection(null) }} draggable={false} style={{ width: '95vw', maxWidth: 1200 }}>
      {historyLoading ? <LoadingSpinner text="Loading TCP history..." /> : <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <div className="space-y-2 max-h-[480px] overflow-auto">{history?.map(config => <button key={config._id} type="button" onClick={() => setHistorySelection(config)} className="w-full border border-slate-200 rounded p-3 text-left hover:bg-blue-50 text-xs cursor-pointer"><strong>v{config.version} · {config.groupCount} groups</strong><p className="text-slate-500 mt-1">{new Date(config.createdAt).toLocaleString()}</p><p className="text-slate-500">{config.publishStatus}</p></button>)}{!history?.length && <p className="text-xs text-slate-400">No TCP configuration history yet.</p>}</div>
        <div className="space-y-4 max-h-[480px] overflow-auto">{historySelection?.groups?.map(group => <div key={group.groupNum}><h4 className="text-xs font-bold mb-2">G{group.groupNum} · {group.rows.length} parameters</h4><TcpConfigTable rows={group.rows} devices={devices} readOnly /></div>) || <p className="text-xs text-slate-400">Select a saved TCP configuration.</p>}</div>
      </div>}
    </Dialog>
    <CountdownModal visible={!!pending} title={pending === 'read' ? 'Reading TCP Configuration' : pending === 'delete' ? 'Deleting TCP Group' : 'Publishing TCP Configuration'} subtitle={pending === 'read' ? 'Waiting for TCP group responses from the gateway...' : 'Waiting for board acknowledgement for every requested group...'} duration={10} onCancel={stopWaiting} />
  </div>
}

function TcpConfigTable({ rows, devices, readOnly, change, add, remove }) {
  const spans = new Map()
  for (let index = 0; index < rows.length;) {
    let end = index + 1
    while (end < rows.length && rows[end].deviceName === rows[index].deviceName) end++
    spans.set(index, end - index); index = end
  }
  const seen = new Map(), duplicates = new Set()
  rows.forEach((row, index) => {
    if (row.address === '' || row.address == null) return
    const key = `${row.slaveId}:${row.address}`
    if (seen.has(key)) { duplicates.add(index); duplicates.add(seen.get(key)) }
    else seen.set(key, index)
  })
  return <div className="overflow-x-auto border border-slate-200 rounded-lg"><table className="min-w-full text-xs">
    <thead className="bg-slate-50 border-b border-slate-200"><tr>{['Device Name', 'Slave ID', 'Parameter', 'Func Code', 'Address', 'Data Type', 'Length', 'Scale', 'Decimal', ...(!readOnly ? ['Action'] : [])].map(label => <th key={label} className="px-3 py-2 text-left font-bold text-[10px] text-slate-400 uppercase tracking-wide whitespace-nowrap">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={row.parameterName} className="hover:bg-slate-50/50">
      {spans.has(index) && <td rowSpan={spans.get(index)} className="p-2 align-top">{readOnly ? <strong>{row.deviceName}</strong> : <div className="flex gap-1 items-center"><select className={`${field} w-28`} value={row.deviceName} onChange={event => change(index, 'deviceName', event.target.value)}>{devices.map(device => <option key={device.deviceName}>{device.deviceName}</option>)}</select><button type="button" aria-label={`Add TCP parameter for ${row.deviceName}`} className="p-1 text-blue-600 cursor-pointer" onClick={() => add(row.deviceName)}><i className="pi pi-plus text-[10px]" aria-hidden="true" /></button></div>}</td>}
      {spans.has(index) && <td rowSpan={spans.get(index)} className="p-2 align-top font-mono">{String(row.slaveId).padStart(2, '0')}</td>}
      <td className="p-2 font-mono font-bold text-slate-500">{row.parameterName}</td>
      <td className="p-2"><select disabled={readOnly} className={`${field} w-16`} value={row.functionCode} onChange={event => change(index, 'functionCode', Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 15, 16].map(code => <option key={code} value={code}>{String(code).padStart(2, '0')}</option>)}</select></td>
      <td className="p-2"><input aria-label={`${row.parameterName} Address`} type="number" min="0" max="65535" disabled={readOnly} className={`${field} w-20 ${duplicates.has(index) ? 'border-red-400 bg-red-50' : row.address === '' ? 'border-amber-400' : ''}`} value={row.address ?? ''} onChange={event => change(index, 'address', event.target.value === '' ? '' : Number(event.target.value))} /></td>
      <td className="p-2"><select disabled={readOnly} className={`${field} w-20`} value={row.dataType} onChange={event => change(index, 'dataType', event.target.value)}><option value="i">Int</option><option value="f">Float</option></select></td>
      <td className="p-2"><input aria-label={`${row.parameterName} Length`} disabled={readOnly} className={`${field} w-16`} type="number" min="1" value={row.length} onChange={event => change(index, 'length', Number(event.target.value))} /></td>
      <td className="p-2"><input aria-label={`${row.parameterName} Scale`} disabled={readOnly} className={`${field} w-20`} type="number" step="any" value={row.scaleFactor ?? 1} onChange={event => change(index, 'scaleFactor', event.target.value === '' ? '' : Number(event.target.value))} /></td>
      <td className="p-2"><select disabled={readOnly} className={`${field} w-20`} value={row.decimal ?? 'None'} onChange={event => change(index, 'decimal', event.target.value)}>{['None', '1', '2', '3', '4', '5', '6'].map(value => <option key={value}>{value}</option>)}</select></td>
      {!readOnly && <td className="p-2 text-center"><button type="button" aria-label={`Delete TCP parameter ${row.parameterName}`} className="text-red-500 p-1 cursor-pointer" onClick={() => remove(index)}><i className="pi pi-trash" aria-hidden="true" /></button></td>}
    </tr>)}</tbody>
  </table></div>
}
