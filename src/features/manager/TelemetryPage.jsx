import { useState, useEffect, useRef, useCallback } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import EChart from '../../components/shared/EChart'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { showToast } from '../../utils/toast'
import { getSession } from '../../services/auth'
import { telemetryApi } from '../../services/telemetryApi'
import { getSocket } from '../../services/socketClient'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import DynamicMeterRenderer from '../../components/meters/DynamicMeterRenderer'
import HorizontalBarGauge from '../../components/meters/HorizontalBarGauge'
import { useChartTheme } from '../../hooks/useChartTheme'
import { formatTagDisplayName } from '../../utils/tagUtils'

function getTagArrivedTime(row) {
  if (!row) return null
  if (typeof row === 'object') {
    if (row.lastReceivedAt) return row.lastReceivedAt
    if (row.arrivedAt) return row.arrivedAt
    if (row.latestArrivedAt) return row.latestArrivedAt
    if (row.updatedAt) return row.updatedAt
    return null
  }
  return row
}

function formatRelativeTime(input, now = Date.now()) {
  if (!input) return 'never'
  let time = null
  if (typeof input === 'object') {
    if (input.lastReceivedAt) {
      time = input.lastReceivedAt
    } else if (input.arrivedAt) {
      time = new Date(input.arrivedAt).getTime()
    } else if (input.latestArrivedAt) {
      time = new Date(input.latestArrivedAt).getTime()
    } else if (input.updatedAt) {
      time = new Date(input.updatedAt).getTime()
    }
  } else {
    time = typeof input === 'number' ? input : new Date(input).getTime()
  }

  if (!time || isNaN(time)) return 'never'
  const diff = now - time
  if (diff < 1000) return '0s ago'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function RelativeTimeCell({ timestamp }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [timestamp])

  return (
    <span className="text-xs text-slate-500 font-medium tabular-nums">
      {formatRelativeTime(timestamp, now)}
    </span>
  )
}

const formatTagValue = (val, dec) => {
  if (val === null || val === undefined || val === '') return 'N/A'
  const decStr = String(dec ?? 'None').toLowerCase()
  const isNone = decStr === 'none' || decStr === '0' || Number(dec) === 0
  const num = Number(val)
  if (isNaN(num)) return String(val)
  if (!isNone && !isNaN(Number(dec)) && Number(dec) > 0) {
    const d = parseInt(dec, 10)
    const sign = num < 0 ? '-' : ''
    const absStr = Math.abs(num).toString()
    const parts = absStr.split('.')
    const intPart = parts[0]
    let fracPart = parts[1] || ''
    if (fracPart.length < d) {
      fracPart = fracPart.padEnd(d, '0')
    } else {
      fracPart = fracPart.slice(0, d)
    }
    return `${sign}${intPart}.${fracPart}`
  }
  // None: trim decimals out without rounding. e.g. 76.98 -> 76
  return !isNaN(num) ? String(Math.trunc(num)) : String(val).replace(/\.\d+$/, '')
}

function getThresholdStatus(val, row) {
  if (val === null || val === undefined || val === 'N/A') return 'normal'
  const num = Number(val)
  if (isNaN(num)) return 'normal'
  const wVal = row.warningThreshold != null && row.warningThreshold !== '' ? Number(row.warningThreshold) : null
  const cVal = row.criticalThreshold != null && row.criticalThreshold !== '' ? Number(row.criticalThreshold) : null
  const isInverted = wVal !== null && cVal !== null && wVal > cVal
  if (isInverted) {
    if (cVal !== null && !isNaN(cVal) && num <= cVal) return 'critical'
    if (wVal !== null && !isNaN(wVal) && num <= wVal) return 'warning'
  } else {
    if (cVal !== null && !isNaN(cVal) && num >= cVal) return 'critical'
    if (wVal !== null && !isNaN(wVal) && num >= wVal) return 'warning'
  }
  return 'normal'
}

export default function TelemetryPage() {
  const session = getSession()
  const chartTheme = useChartTheme()
  const [tags, setTags] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const [first, setFirst] = useState(0)
  const PAGE_SIZE = 10

  // Selected Employee filter from TopBar
  const [selectedEmpId, setSelectedEmpId] = useState(
    localStorage.getItem('manager_selected_employee') || 'all'
  )

  // Meter dialog states
  const [meterDialog, setMeterDialog] = useState(false)
  const [activeMeterTag, setActiveMeterTag] = useState(null)

  // Chart dialog states
  const [chartDialog, setChartDialog] = useState(false)
  const [chartData, setChartData] = useState(null)
  const [chartTitle, setChartTitle] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [isHistorical, setIsHistorical] = useState(false)
  const [showThresholdLines, setShowThresholdLines] = useState(true)
  const thresholdRef = useRef(true)

  // Rename dialog states
  const [renameDialog, setRenameDialog] = useState(false)
  const [renameTag, setRenameTag] = useState(null)
  const [newDisplayName, setNewDisplayName] = useState('')
  const [savingRename, setSavingRename] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(100)
  const [historyLimitInput, setHistoryLimitInput] = useState(100)
  const [useLimit, setUseLimit] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedGatewayId, setSelectedGatewayId] = useState('all')
  const [gateways, setGateways] = useState([])
  const isEmployee = session?.role === 'employee'

  // Live graph: mutable refs so socket handler always sees latest data without stale closures
  const liveChartRef = useRef(null)       // EChart instance ref
  const livePointsRef = useRef([])        // { time: string, value: number }[]
  const liveTagIdRef = useRef(null)       // active tag being monitored
  const liveSocketCleanupRef = useRef(null) // cleanup fn for the live socket listener
  const LIVE_WINDOW_MAX = 100            // max data points to keep in view

  const loadData = async (empId, page, term, gwId) => {
    try {
      setLoading(true)
      const data = isEmployee
        ? await telemetryApi.getEmployeeTelemetry(term, page, PAGE_SIZE, gwId)
        : await telemetryApi.getManagerTelemetry(empId, term, page, PAGE_SIZE, gwId)
      const tagsWithTimestamp = (data.tags || []).map((t) => {
        const tTime = t.arrivedAt || t.latestArrivedAt || t.updatedAt
        return {
          ...t,
          lastReceivedAt: tTime ? new Date(tTime).getTime() : Date.now()
        }
      })
      setTags(tagsWithTimestamp)
      setTotalRecords(data.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load telemetry' })
      setTags([])
      setTotalRecords(0)
    } finally {
      setLoading(false)
    }
  }

  const loadGateways = async (empId) => {
    try {
      const list = isEmployee
        ? await telemetryApi.getEmployeeDevices()
        : await telemetryApi.getManagerGateways(empId)
      setGateways(list || [])
    } catch (_) {}
  }

  useEffect(() => {
    loadData(selectedEmpId, 1, '', '')
    loadGateways(selectedEmpId)

    // Listen to TopBar changes
    const handleScopeChange = () => {
      const empId = localStorage.getItem('manager_selected_employee') || 'all'
      setSelectedEmpId(empId)
      setFirst(0)
      setDebouncedSearch('')
      setSearchTerm('')
      setSelectedGatewayId('all')
      loadData(empId, 1, '', '')
      loadGateways(empId)
    }
    window.addEventListener('manager_employee_changed', handleScopeChange)

    return () => {
      window.removeEventListener('manager_employee_changed', handleScopeChange)
    }
  }, [])

  // Real-time telemetry Socket.IO subscription
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleTelemetryReading = (reading) => {
      const validArrived = Date.now()
      const displayVal = reading.valueStr ?? reading.valStr ?? reading.value
      setActiveMeterTag((prev) => (prev && ((prev.tagId && prev.tagId === reading.tagId) || (prev._id && prev._id.toString() === reading.tagId) || (prev.id && prev.id === reading.tagId)) ? { ...prev, liveValue: displayVal, lastReceivedAt: validArrived } : prev))
      setTags((prevTags) =>
        prevTags.map((tag) => {
          const idMatches = (tag.tagId && tag.tagId === reading.tagId) || (tag._id && tag._id.toString() === reading.tagId) || (tag.id && tag.id === reading.tagId)
          if (idMatches) {
            return {
              ...tag,
              liveValue: displayVal,
              decimal: reading.decimal !== undefined ? reading.decimal : tag.decimal,
              arrivedAt: reading.arrivedAt,
              lastReceivedAt: validArrived,
              todayMax: reading.todayMax,
              yesterdayMax: reading.yesterdayMax,
              weekMax: reading.weekMax
            }
          }
          return tag
        })
      )
    }

    const handleTagsDeleted = (data) => {
      const tagIds = data?.tagIds || []
      if (!Array.isArray(tagIds) || tagIds.length === 0) return
      const delSet = new Set(tagIds.map(String))
      setTags(prev => prev.filter(t => !delSet.has(String(t._id || t.tagId || t.id))))
    }

    socket.on('telemetry:reading', handleTelemetryReading)
    socket.on('telemetry:tags-deleted', handleTagsDeleted)
    return () => {
      socket.off('telemetry:reading', handleTelemetryReading)
      socket.off('telemetry:tags-deleted', handleTagsDeleted)
    }
  }, [])

  // 500ms Search Debounce — resets to page 1 and refetches
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Refetch when filters change (reset to page 1, skip initial mount)
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }
    setFirst(0)
    loadData(selectedEmpId, 1, debouncedSearch, selectedGatewayId === 'all' ? '' : selectedGatewayId)
  }, [debouncedSearch, selectedGatewayId])

  const getThresholdMarkLine = (tag, enabled = true) => {
    if (!enabled || !tag) return undefined
    const markData = []
    const wVal = tag.warningThreshold !== null && tag.warningThreshold !== undefined && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
    const cVal = tag.criticalThreshold !== null && tag.criticalThreshold !== undefined && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null

    if (wVal !== null && !isNaN(wVal)) {
      markData.push({
        yAxis: wVal,
        name: 'Warning',
        lineStyle: { color: '#f59e0b', type: 'dashed', width: 2 },
        label: {
          formatter: `Warning: ${wVal}${tag.unit ? ' ' + tag.unit : ''}`,
          position: 'end',
          color: '#d97706',
          fontSize: 10,
          fontWeight: 'bold'
        }
      })
    }
    if (cVal !== null && !isNaN(cVal)) {
      markData.push({
        yAxis: cVal,
        name: 'Critical',
        lineStyle: { color: '#ef4444', type: 'dashed', width: 2 },
        label: {
          formatter: `Critical: ${cVal}${tag.unit ? ' ' + tag.unit : ''}`,
          position: 'end',
          color: '#dc2626',
          fontSize: 10,
          fontWeight: 'bold'
        }
      })
    }
    if (markData.length === 0) return undefined
    return {
      symbol: ['none', 'none'],
      silent: true,
      data: markData
    }
  }

  // Helper: Build the base EChart option for the live moving-window chart
  const buildLiveChartOption = useCallback((points, tag, enableThresholds = true, theme = {}) => {
    const textColor = theme.textColor || '#475569'
    const gridColor = theme.gridColor || '#e2e8f0'
    const axisLineColor = theme.axisLineColor || '#cbd5e1'
    const tooltipBg = theme.tooltipBg || 'rgba(255, 255, 255, 0.98)'
    const tooltipBorder = theme.tooltipBorder || '#cbd5e1'
    const tooltipText = theme.tooltipText || '#0f172a'
    const defaultLineColor = theme.lineColor || '#2563eb'

    // Compute line color based on latest value vs thresholds
    let lineColor = defaultLineColor
    if (enableThresholds && points && points.length > 0 && tag) {
      const latestVal = Number(points[points.length - 1].value)
      const wVal = tag.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
      const cVal = tag.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
      const isInverted = wVal !== null && cVal !== null && wVal > cVal
      if (!isNaN(latestVal)) {
        if (isInverted) {
          if (cVal !== null && !isNaN(cVal) && latestVal <= cVal) lineColor = '#ef4444'
          else if (wVal !== null && !isNaN(wVal) && latestVal <= wVal) lineColor = '#f59e0b'
        } else {
          if (cVal !== null && !isNaN(cVal) && latestVal >= cVal) lineColor = '#ef4444'
          else if (wVal !== null && !isNaN(wVal) && latestVal >= wVal) lineColor = '#f59e0b'
        }
      }
    }

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderWidth: 1,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 11 },
        formatter: (params) => {
          const p = params[0]
          if (!p) return ''
          const valNum = Number(p.value)
          const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
          const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
          const isInv = wVal !== null && cVal !== null && wVal > cVal
          let tipColor = defaultLineColor
          if (!isNaN(valNum)) {
            if (isInv) {
              if (cVal !== null && valNum <= cVal) tipColor = '#ef4444'
              else if (wVal !== null && valNum <= wVal) tipColor = '#f59e0b'
            } else {
              if (cVal !== null && valNum >= cVal) tipColor = '#ef4444'
              else if (wVal !== null && valNum >= wVal) tipColor = '#f59e0b'
            }
          }
          return `<div style="font-weight:700;font-size:10px;color:${textColor};margin-bottom:4px;">${p.axisValue}</div>
                  <div style="font-size:12px;font-weight:800;color:${tipColor};">${p.value} <span style="font-weight:400;font-size:10px;color:${textColor};">${tag?.unit || ''}</span></div>`
        }
      },
      grid: { top: 32, bottom: 44, left: 52, right: 65 },
      toolbox: {
        show: true,
        right: 15,
        top: 2,
        itemSize: 13,
        feature: {
          dataZoom: {
            yAxisIndex: 'none',
            title: { zoom: 'Box Zoom', back: 'Reset Zoom' }
          },
          restore: { title: 'Restore' }
        },
        iconStyle: { borderColor: textColor }
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0],
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: true
        },
        {
          type: 'slider',
          show: true,
          xAxisIndex: [0],
          height: 18,
          bottom: 6,
          borderColor: '#f1f5f9',
          fillerColor: 'rgba(59, 130, 246, 0.12)',
          handleSize: '120%',
          handleStyle: {
            color: '#ffffff',
            borderColor: '#3b82f6',
            borderWidth: 1.5,
            shadowBlur: 3,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          },
          moveHandleStyle: { color: '#cbd5e1' },
          textStyle: { color: textColor, fontSize: 8, fontFamily: 'ui-monospace, monospace' },
          dataBackground: {
            lineStyle: { color: 'transparent' },
            areaStyle: { color: 'transparent' }
          },
          selectedDataBackground: {
            lineStyle: { color: '#3b82f6', width: 1 },
            areaStyle: { color: 'rgba(59, 130, 246, 0.05)' }
          }
        }
      ],
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map(p => p.time),
        axisLabel: { color: textColor, fontSize: 9, fontFamily: 'ui-monospace, monospace', interval: 'auto' },
        axisLine: { lineStyle: { color: axisLineColor } },
        axisTick: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        scale: true,
        min: (extent) => {
          let minVal = extent.min
          const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
          const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
          if (enableThresholds) {
            if (wVal !== null && !isNaN(wVal)) minVal = Math.min(minVal, wVal)
            if (cVal !== null && !isNaN(cVal)) minVal = Math.min(minVal, cVal)
          }
          const span = (extent.max - minVal) || 1
          return Math.floor(minVal - span * 0.05)
        },
        max: (extent) => {
          let maxVal = extent.max
          const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
          const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
          if (enableThresholds) {
            if (wVal !== null && !isNaN(wVal)) maxVal = Math.max(maxVal, wVal)
            if (cVal !== null && !isNaN(cVal)) maxVal = Math.max(maxVal, cVal)
          }
          const span = (maxVal - extent.min) || 1
          return Math.ceil(maxVal + span * 0.05)
        },
        axisLabel: {
          color: textColor, fontSize: 9, fontFamily: 'ui-monospace, monospace',
          formatter: (v) => `${v}${tag?.unit ? ' ' + tag.unit : ''}`
        },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        name: tag?.displayName || tag?.topicName,
        type: 'line',
        smooth: 0.3,
        data: points.map(p => p.value),
        showSymbol: points.length < 30,
        symbolSize: 5,
        itemStyle: { color: lineColor },
        lineStyle: { width: 2, color: lineColor },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${lineColor}40` },
              { offset: 1, color: `${lineColor}05` }
            ]
          }
        },
        markLine: getThresholdMarkLine(tag, enableThresholds),
        markPoint: points.length > 0 ? {
          data: [{ type: 'max', name: 'Latest', label: { show: false }, itemStyle: { color: lineColor }, symbolSize: 10 }]
        } : undefined
      }]
    }
  }, [])

  const openRenameDialog = (tag) => {
    setRenameTag(tag)
    setNewDisplayName(tag.displayName || tag.topicName || '')
    setRenameDialog(true)
  }

  const handleSaveRename = async (e) => {
    e.preventDefault()
    if (!renameTag) return
    try {
      setSavingRename(true)
      await telemetryApi.renameTelemetryTag(renameTag.tagId, newDisplayName)
      showToast({ severity: 'success', summary: 'Success', detail: 'Label updated successfully' })
      
      // Update local state display labels
      setTags((prev) =>
        prev.map((t) =>
          t.tagId === renameTag.tagId ? { ...t, displayName: newDisplayName } : t
        )
      )
      setRenameDialog(false)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to update label' })
    } finally {
      setSavingRename(false)
    }
  }

  const showGraph = async (tag, overrideThresholds) => {
    // Tear down any previous live socket listener
    if (liveSocketCleanupRef.current) {
      liveSocketCleanupRef.current()
      liveSocketCleanupRef.current = null
    }

    setActiveTag(tag)
    setIsHistorical(false)
    setChartTitle(`${formatTagDisplayName(tag)} (${tag.gateway?.name || ''}) — Live Moving Window`)
    setChartData(null)
    setChartDialog(true)

    const targetTagId = tag._id || tag.tagId
    liveTagIdRef.current = targetTagId
    livePointsRef.current = []

    try {
      // --- 1. Seed: fetch 30-minute historical readings from the backend ---
      const startDate = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const endDate = new Date().toISOString()
      let seedReadings = isEmployee
        ? await telemetryApi.getEmployeeReadings(targetTagId, 10000, startDate, endDate)
        : await telemetryApi.getManagerReadings(targetTagId, 10000, startDate, endDate)

      if ((!seedReadings || seedReadings.length === 0) && tag.tagId && tag.tagId !== targetTagId) {
        seedReadings = isEmployee
          ? await telemetryApi.getEmployeeReadings(tag.tagId, 10000, startDate, endDate)
          : await telemetryApi.getManagerReadings(tag.tagId, 10000, startDate, endDate)
      }

      // Sort oldest → newest and seed the 30-minute live buffer
      const cutoff = Date.now() - 30 * 60 * 1000
      const sorted = [...(seedReadings || [])].sort((a, b) => new Date(a.arrivedAt) - new Date(b.arrivedAt))
      const seedPoints = sorted
        .filter(r => new Date(r.arrivedAt).getTime() >= cutoff)
        .map(r => ({
          time: new Date(r.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          arrivedAt: r.arrivedAt || new Date().toISOString(),
          value: r.value
        }))

      livePointsRef.current = seedPoints

      const enableLines = overrideThresholds !== undefined ? overrideThresholds : thresholdRef.current

      // Set initial chart option immediately even if empty so socket can append points without a hanging modal
      setChartData(buildLiveChartOption(seedPoints, tag, enableLines, chartTheme))

      // --- 2. Attach live Socket.IO listener for this tag ---
      const socket = getSocket()
      if (socket) {
        const handleLiveReading = (reading) => {
          if (reading.tagId !== liveTagIdRef.current) return

          const arrivedAtIso = reading.arrivedAt || new Date().toISOString()
          const newPoint = {
            time: new Date(arrivedAtIso).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            }),
            arrivedAt: arrivedAtIso,
            value: reading.value
          }

          // Push new point and drop points older than 30 minutes from current time
          livePointsRef.current.push(newPoint)
          const windowCutoff = Date.now() - 30 * 60 * 1000
          livePointsRef.current = livePointsRef.current.filter(p => new Date(p.arrivedAt).getTime() >= windowCutoff)

          const points = livePointsRef.current

          // Imperatively update the EChart instance (no React re-render = no flicker)
          if (liveChartRef.current) {
            // Recompute color from latest value
            const defaultLineColor = chartTheme.lineColor || '#2563eb'
            let newLineColor = defaultLineColor
            if (thresholdRef.current && points.length > 0 && tag) {
              const latestVal = Number(points[points.length - 1].value)
              const wVal = tag.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
              const cVal = tag.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
              const isInverted = wVal !== null && cVal !== null && wVal > cVal
              if (!isNaN(latestVal)) {
                if (isInverted) {
                  if (cVal !== null && latestVal <= cVal) newLineColor = '#ef4444'
                  else if (wVal !== null && latestVal <= wVal) newLineColor = '#f59e0b'
                } else {
                  if (cVal !== null && latestVal >= cVal) newLineColor = '#ef4444'
                  else if (wVal !== null && latestVal >= wVal) newLineColor = '#f59e0b'
                }
              }
            }
            liveChartRef.current.setOption({
              xAxis: { data: points.map(p => p.time) },
              series: [{
                data: points.map(p => p.value),
                itemStyle: { color: newLineColor },
                lineStyle: { width: 2, color: newLineColor },
                areaStyle: {
                  color: {
                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                      { offset: 0, color: `${newLineColor}40` },
                      { offset: 1, color: `${newLineColor}05` }
                    ]
                  }
                },
                markPoint: points.length > 0 ? {
                  data: [{ type: 'max', name: 'Latest', label: { show: false }, itemStyle: { color: newLineColor }, symbolSize: 10 }]
                } : undefined,
                markLine: getThresholdMarkLine(tag, thresholdRef.current)
              }]
            }, { notMerge: false, lazyUpdate: false })
          }
        }

        socket.on('telemetry:reading', handleLiveReading)

        liveSocketCleanupRef.current = () => {
          socket.off('telemetry:reading', handleLiveReading)
        }
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    }
  }

  // Cleanup live socket listener when the dialog closes
  const handleCloseChartDialog = useCallback(() => {
    if (liveSocketCleanupRef.current) {
      liveSocketCleanupRef.current()
      liveSocketCleanupRef.current = null
    }
    liveTagIdRef.current = null
    livePointsRef.current = []
    liveChartRef.current = null
    setChartDialog(false)
    setChartData(null)
  }, [])

  const showHistory = async (tag, limit = 5000, start = '', end = '') => {
    try {
      setActiveTag(tag)
      setIsHistorical(true)
      setHistoryLimit(limit)
      setChartTitle(`${formatTagDisplayName(tag)} (${tag.gateway?.name || ''}) — Historical Trend`)
      setChartData(null)
      setChartDialog(true)

      const targetTagId = tag._id || tag.tagId
      const readings = isEmployee
        ? await telemetryApi.getEmployeeReadings(targetTagId, limit, start, end)
        : await telemetryApi.getManagerReadings(targetTagId, limit, start, end)
      if (readings && readings.length > 0) {
        const sorted = [...readings].sort((a, b) => new Date(a.arrivedAt) - new Date(b.arrivedAt))
        setChartData({
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'axis',
            backgroundColor: chartTheme.tooltipBg,
            borderWidth: 1,
            borderColor: chartTheme.tooltipBorder,
            textStyle: { color: chartTheme.tooltipText, fontSize: 11 }
          },
          toolbox: {
            show: true,
            right: 15,
            top: 2,
            itemSize: 13,
            feature: {
              dataZoom: {
                yAxisIndex: 'none',
                title: { zoom: 'Box Zoom', back: 'Reset Zoom' }
              },
              restore: { title: 'Restore' }
            },
            iconStyle: { borderColor: chartTheme.textColor }
          },
          grid: { top: 32, bottom: 65, left: 45, right: 20 },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: sorted.map(r => new Date(r.arrivedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
            axisLabel: { color: chartTheme.textColor, fontSize: 9, fontFamily: 'ui-monospace, monospace' },
            axisLine: { lineStyle: { color: chartTheme.axisLineColor } }
          },
          yAxis: {
            type: 'value',
            scale: true,
            min: (extent) => {
              let minVal = extent.min
              const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
              const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
              if (showThresholdLines) {
                if (wVal !== null && !isNaN(wVal)) minVal = Math.min(minVal, wVal)
                if (cVal !== null && !isNaN(cVal)) minVal = Math.min(minVal, cVal)
              }
              const span = (extent.max - minVal) || 1
              return Math.floor(minVal - span * 0.05)
            },
            max: (extent) => {
              let maxVal = extent.max
              const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
              const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
              if (showThresholdLines) {
                if (wVal !== null && !isNaN(wVal)) maxVal = Math.max(maxVal, wVal)
                if (cVal !== null && !isNaN(cVal)) maxVal = Math.max(maxVal, cVal)
              }
              const span = (maxVal - extent.min) || 1
              return Math.ceil(maxVal + span * 0.05)
            },
            axisLabel: { color: chartTheme.textColor, fontSize: 9, fontFamily: 'ui-monospace, monospace' },
            splitLine: { lineStyle: { color: chartTheme.gridColor, type: 'dashed' } }
          },
          dataZoom: [
            {
              type: 'slider',
              show: true,
              xAxisIndex: [0],
              start: 0,
              end: 100,
              height: 20,
              bottom: 10,
              borderColor: '#f1f5f9',
              fillerColor: 'rgba(139, 92, 246, 0.08)',
              handleIcon: 'path://M-1.9,0.5h3.8v9h-3.8V0.5z M-0.9,2.5h1.8v5h-1.8V2.5z',
              handleSize: '120%',
              handleStyle: {
                color: '#ffffff',
                borderColor: '#8b5cf6',
                borderWidth: 1.5,
                shadowBlur: 3,
                shadowColor: 'rgba(0, 0, 0, 0.1)',
                shadowOffsetX: 0,
                shadowOffsetY: 1
              },
              moveHandleStyle: { color: '#e2e8f0' },
              textStyle: { color: '#94a3b8', fontSize: 8, fontFamily: 'ui-monospace, monospace' },
              dataBackground: {
                lineStyle: { color: 'transparent' },
                areaStyle: { color: 'transparent' }
              },
              selectedDataBackground: {
                lineStyle: { color: '#8b5cf6', width: 1 },
                areaStyle: { color: 'rgba(139, 92, 246, 0.03)' }
              }
            },
            {
              type: 'inside',
              xAxisIndex: [0],
              start: 0,
              end: 100
            }
          ],
          series: [{
            name: `${tag.topicName} History`,
            type: 'line',
            smooth: true,
            data: sorted.map(r => r.value),
            showSymbol: sorted.length < 200,
            symbolSize: 4,
            itemStyle: { color: '#8b5cf6' },
            lineStyle: { width: 2 },
            areaStyle: { color: 'rgba(139, 92, 246, 0.08)' },
            markLine: getThresholdMarkLine(tag, showThresholdLines)
          }]
        })
      } else {
        setChartData({
          title: {
            text: 'No readings found matching selected filters.',
            left: 'center',
            top: 'center',
            textStyle: { color: '#94a3b8', fontSize: 13, fontWeight: 'normal', fontFamily: 'sans-serif' }
          }
        })
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    }
  }

  const actionBody = (row) => {
    return (
      <div className="flex gap-1.5 justify-center items-center">
        <button
          onClick={() => showGraph(row)}
          className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center cursor-pointer transition-colors"
          title="Real-Time Graph"
        >
          <i className="pi pi-chart-line text-sm" />
        </button>
        <button
          onClick={() => showHistory(row)}
          className="w-8 h-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50 flex items-center justify-center cursor-pointer transition-colors"
          title="Historical Chart"
        >
          <i className="pi pi-history text-sm" />
        </button>
        {row.assignedMeterType && (
          <button
            onClick={() => {
              setActiveMeterTag(row)
              setMeterDialog(true)
            }}
            className="w-8 h-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center cursor-pointer transition-colors"
            title={`Assigned Digital Meter (${row.assignedMeterType})`}
          >
            <i className="pi pi-gauge text-sm" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200/60 p-4 shadow-none">
        <div className="flex items-center bg-white border border-purple-200/80 hover:border-purple-300/80 rounded-none px-2.5 h-9 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all w-full sm:max-w-xs">
          <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parameters, device..."
            className="w-full text-xs text-slate-705 bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-slate-650 ml-1 cursor-pointer shrink-0"
            >
              <i className="pi pi-times text-[9px]" />
            </button>
          )}
        </div>

        {/* Gateway Filter Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gateway:</span>
          <select
             value={selectedGatewayId}
             onChange={(e) => setSelectedGatewayId(e.target.value)}
             className="h-9 px-3 border border-purple-200/80 hover:border-purple-300 bg-white text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-none min-w-[160px] cursor-pointer transition-colors"
          >
             <option value="all">All Gateways</option>
            {gateways.map((gw) => (
              <option key={gw._id || gw.id} value={gw._id || gw.id}>
                {gw.name} ({gw.prefix})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Telemetry Registers Table */}
      <div className="bg-white border border-slate-200/60 overflow-x-auto shadow-none relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <i className="pi pi-spin pi-spinner text-blue-600 text-lg" />
          </div>
        )}
        <DataTable
          value={tags}
          emptyMessage={<EmptyState message="No telemetry tags found" description="No parameters are configured or assigned to the active employee scope. Try adjusting your filters or gateway selection." icon="pi-chart-line" />}
          className="border-none"
          rowClassName={() => 'border-b border-slate-100 hover:bg-slate-50/50 transition-colors'}
          scrollable
          scrollHeight="flex"
        >
          <Column
            header="Parameter"
            style={{ minWidth: '200px' }}
            body={(r) => (
              <div className="py-1 flex items-center gap-2 group">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-800 text-sm block truncate" title={formatTagDisplayName(r)}>
                    {formatTagDisplayName(r)}
                  </span>
                </div>
                {!isEmployee && (
                  <button
                    onClick={() => openRenameDialog(r)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer rounded shrink-0"
                    title="Rename Label"
                  >
                    <i className="pi pi-pencil text-[10px]" />
                  </button>
                )}
              </div>
            )}
          />
          <Column
            header="Device Node"
            style={{ minWidth: '160px' }}
            body={(r) => (
              <div className="py-1">
                <span className="text-slate-750 font-medium text-sm">{r.deviceName}</span>
                {r.gateway && (
                  <span className="text-xs text-slate-400 font-light ml-2">({r.gateway.name})</span>
                )}
              </div>
            )}
          />
          <Column
            header="Relative Time"
            alignHeader="center"
            align="center"
            style={{ minWidth: '110px' }}
            body={(r) => <RelativeTimeCell timestamp={getTagArrivedTime(r)} />}
          />
          <Column
            header="Live Value"
            alignHeader="center"
            align="center"
            style={{ minWidth: '120px' }}
            body={(r) => {
              const display = formatTagValue(r.liveValue, r.decimal)
              const status = getThresholdStatus(r.liveValue, r)
              const badgeClass = status === 'critical'
                ? 'bg-rose-50/80 text-rose-600 border-rose-200/80'
                : status === 'warning'
                  ? 'bg-amber-50/80 text-amber-600 border-amber-200/80'
                  : 'bg-emerald-50/60 text-emerald-700 border-emerald-100/60'
              const unitClass = status === 'critical'
                ? 'text-rose-400'
                : status === 'warning'
                  ? 'text-amber-400'
                  : 'text-emerald-500'
              return (
                <span className={`inline-flex items-center justify-center border px-3 py-1 rounded-full text-xs font-bold font-mono ${badgeClass}`}>
                  {status === 'critical' && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping mr-1.5 shrink-0" />}
                  {status === 'warning' && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping mr-1.5 shrink-0" />}
                  {display}{' '}
                  {display !== 'N/A' && r.unit && <span className={`text-[9px] font-normal ml-0.5 ${unitClass}`}>{r.unit}</span>}
                </span>
              )
            }}
          />
          <Column
            header="Today Max"
            alignHeader="center"
            align="center"
            style={{ minWidth: '110px' }}
            body={(r) => {
              const display = r.todayMax !== null && r.todayMax !== undefined ? formatTagValue(r.todayMax, r.decimal) : '0'
              return (
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {display} {r.unit && <span className="text-[9px] font-normal text-slate-400">{r.unit}</span>}
                </span>
              )
            }}
          />
          <Column
            header="Week Max"
            alignHeader="center"
            align="center"
            style={{ minWidth: '110px' }}
            body={(r) => {
              const display = r.weekMax !== null && r.weekMax !== undefined ? formatTagValue(r.weekMax, r.decimal) : '0'
              return (
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {display} {r.unit && <span className="text-[9px] font-normal text-slate-400">{r.unit}</span>}
                </span>
              )
            }}
          />

          <Column
            header="Assigned User"
            alignHeader="center"
            align="center"
            style={{ minWidth: '130px' }}
            body={(r) => (
              r.assignedEmployees && r.assignedEmployees.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200/80" title={r.assignedEmployees.map(e => e.name || e.email).join(', ')}>
                  <i className="pi pi-users text-[9px] text-blue-600" />
                  <span>{r.assignedEmployees.length === 1 ? r.assignedEmployees[0].name : `${r.assignedEmployees.length} Users`}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-medium rounded-full">
                  Unassigned
                </span>
              )
            )}
          />

          <Column 
            body={actionBody} 
            header="Actions" 
            alignHeader="center" 
            align="center" 
            style={{ minWidth: '100px' }} 
          />
        </DataTable>
      </div>

      <ReactPaginator
        totalRecords={totalRecords}
        rows={PAGE_SIZE}
        first={first}
        onPageChange={(e) => {
          setFirst(e.first)
          const pageNum = e.page + 1
          loadData(selectedEmpId, pageNum, debouncedSearch, selectedGatewayId === 'all' ? '' : selectedGatewayId)
        }}
      />

      <Dialog
        header={
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">{chartTitle}</span>
            {!isHistorical && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
        }
        visible={chartDialog}
        onHide={handleCloseChartDialog}
        draggable={false}
        style={{ width: '95vw', height: '95vh' }}
        contentStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        className="max-w-none rounded-none"
      >
        {isHistorical && (
          <div className="flex items-center justify-between gap-4 p-3.5 bg-slate-50 border-b border-slate-200/60 flex-wrap shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Limit input with enable/disable checkbox */}
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="enableLimit"
                  checked={useLimit}
                  onChange={(e) => setUseLimit(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-slate-350 focus:ring-purple-500 cursor-pointer accent-purple-600"
                />
                <label htmlFor="enableLimit" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none">
                  Limit Points:
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  disabled={!useLimit}
                  value={historyLimitInput}
                  onChange={(e) => setHistoryLimitInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-8 px-2 border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-none shadow-sm font-mono disabled:opacity-50 disabled:bg-slate-100/60"
                />
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 px-2 border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-none shadow-sm"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 px-2 border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-none shadow-sm"
                />
              </div>

              {/* Plot Button */}
              <button
                onClick={() => showHistory(activeTag, useLimit ? historyLimitInput : 5000, startDate, endDate)}
                className="h-8 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors shadow-sm"
              >
                Plot Trend
              </button>
              {/* Show Thresholds checkbox */}
              <div className="flex items-center gap-1.5 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  id="showThresholdCheck"
                  checked={showThresholdLines}
                  onChange={(e) => {
                    const checked = e.target.checked
                    thresholdRef.current = checked
                    setShowThresholdLines(checked)
                    if (activeTag) {
                      showHistory(activeTag, useLimit ? historyLimitInput : 5000, startDate, endDate)
                    }
                  }}
                  className="w-4 h-4 text-amber-600 border-slate-350 focus:ring-amber-500 cursor-pointer accent-amber-600"
                />
                <label htmlFor="showThresholdCheck" className="text-[10px] font-bold text-amber-700 uppercase tracking-wider cursor-pointer select-none">
                  Show Threshold Lines
                </label>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <i className="pi pi-info-circle text-slate-350" />
              Use bottom slider or mouse scroll to zoom &amp; pan
            </div>
          </div>
        )}
        {/* Live mode info bar */}
        {!isHistorical && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-50/80 border-b border-slate-200/60 shrink-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
              <i className="pi pi-clock text-slate-400" />
              Seeded with last <span className="text-blue-600 font-bold">30 minutes</span> of data — sliding live time window
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="showThresholdCheckLive"
                  checked={showThresholdLines}
                  onChange={(e) => {
                    const checked = e.target.checked
                    thresholdRef.current = checked
                    setShowThresholdLines(checked)
                    if (activeTag) {
                      showGraph(activeTag, checked)
                    }
                  }}
                  className="w-4 h-4 text-amber-600 border-slate-350 focus:ring-amber-500 cursor-pointer accent-amber-600"
                />
                <label htmlFor="showThresholdCheckLive" className="text-[10px] font-bold text-amber-700 uppercase tracking-wider cursor-pointer select-none">
                  Show Threshold Lines
                </label>
              </div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Updates in real-time via socket
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 w-full min-h-0 pt-2 pb-4">
          {chartData ? (
            <EChart
              option={chartData}
              className="w-full h-full"
              onChartReady={(instance) => { liveChartRef.current = instance }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 gap-2.5 p-8 text-center select-none bg-slate-50/20">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center">
                <i className="pi pi-chart-line text-slate-350 text-xl" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-700">Loading 30-min history…</h4>
                <p className="text-[11px] text-slate-400 font-medium max-w-xs leading-relaxed">
                  Fetching the last 30 minutes of telemetry readings. Live updates will stream in automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        header={
          <div className="flex items-center gap-2">
            <i className="pi pi-tag text-blue-500" />
            <span className="text-sm font-bold text-slate-800">Rename Display Label</span>
          </div>
        }
        visible={renameDialog}
        onHide={() => setRenameDialog(false)}
        draggable={false}
        style={{ width: '400px' }}
        className="rounded-none border border-slate-200"
      >
        <form onSubmit={handleSaveRename} className="space-y-4 pt-1.5">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current Name</span>
            <div className="text-xs text-slate-700 font-bold bg-slate-50 border border-slate-200/60 p-2">
              {renameTag?.displayName || renameTag?.topicName}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="displayNameInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Custom Display Name</label>
            <input
              id="displayNameInput"
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="e.g. Generator Temperature"
              className="w-full border border-slate-200 hover:border-slate-350 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-none px-3 py-2 font-semibold text-slate-750 bg-slate-50/10 text-xs focus:bg-white transition-all placeholder-slate-400"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRenameDialog(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs rounded-none transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingRename}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 rounded-none transition-all cursor-pointer disabled:opacity-50"
            >
              {savingRename && <i className="pi pi-spin pi-spinner text-xs" />}
              Save Label
            </button>
          </div>
        </form>
      </Dialog>

      {/* Digital Meter Modal */}
      <Dialog
        header={
          <div className="flex items-center gap-2">
            <i className="pi pi-gauge text-emerald-500" />
            <span className="text-sm font-bold text-slate-800">
              {formatTagDisplayName(activeMeterTag) || 'Assigned Digital Meter'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live Stream
            </span>
          </div>
        }
        visible={meterDialog}
        onHide={() => {
          setMeterDialog(false)
          setActiveMeterTag(null)
        }}
        draggable={false}
        style={{ width: '460px', maxWidth: '95vw' }}
        className="rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        {activeMeterTag && (
          <div className="flex flex-col bg-slate-950 text-white rounded-xl overflow-hidden border border-slate-800 shadow-inner">
            <div className="p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />
              <DynamicMeterRenderer
                type={activeMeterTag.assignedMeterType}
                value={activeMeterTag.liveValue ?? 0}
                unit={activeMeterTag.unit || ''}
                customProps={{
                  min: activeMeterTag.meterMin ?? 0,
                  max: activeMeterTag.meterMax ?? 100,
                  idle: activeMeterTag.meterIdle ?? 0,
                  color: activeMeterTag.meterColor || '#22c55e',
                  unit: activeMeterTag.unit || '',
                  label: formatTagDisplayName(activeMeterTag)
                }}
              />
              {activeMeterTag.assignedMeterType !== 'VERTICAL_BAR_IDLE' && activeMeterTag.assignedMeterType !== 'VERTICAL_BAR_NORMAL' && (
                <div className="w-full max-w-sm pt-2">
                  <HorizontalBarGauge
                    value={activeMeterTag.liveValue ?? 0}
                    min={activeMeterTag.meterMin ?? 0}
                    max={activeMeterTag.meterMax ?? 100}
                    unit={activeMeterTag.unit || ''}
                    color={activeMeterTag.meterColor || '#22c55e'}
                    label={formatTagDisplayName(activeMeterTag)}
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span className="truncate">Node: <strong className="text-slate-200">{activeMeterTag.deviceName}</strong></span>
              <span className="truncate ml-2">Gateway: <strong className="text-slate-200">{activeMeterTag.gateway?.name || 'N/A'}</strong></span>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
