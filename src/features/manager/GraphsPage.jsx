import { useState, useEffect, useRef, useCallback, memo } from 'react'
import EChart from '../../components/shared/EChart'
import { Dialog } from 'primereact/dialog'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { telemetryApi } from '../../services/telemetryApi'
import { showToast } from '../../utils/toast'
import { getSession } from '../../services/auth'
import { getSocket } from '../../services/socketClient'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import { useChartTheme } from '../../hooks/useChartTheme'
import DynamicGraphRenderer from '../../components/graphs/DynamicGraphRenderer'

const PAGE_SIZE = 10
const WINDOW_MS = 30 * 60 * 1000 // 30-minute historical and live sliding window

// ─── helpers ────────────────────────────────────────────────

function fmtTime(iso) {
  return new Date(iso || Date.now()).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function formatTagLiveValue(latestValue, decimal) {
  if (latestValue === null || latestValue === undefined) return null
  const num = Number(latestValue)
  if (isNaN(num)) return String(latestValue)
  const isNone = decimal === null || decimal === undefined || String(decimal).toLowerCase() === 'none' || Number(decimal) === 0
  if (!isNone && !isNaN(Number(decimal)) && Number(decimal) > 0) {
    const d = parseInt(decimal, 10)
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
  return String(Math.trunc(num))
}

// ─── Threshold State & Color Helpers ──────────────────────────

function getThresholdStatus(currentVal, tag) {
  if (currentVal === null || currentVal === undefined || !tag) return 'normal'
  const num = Number(currentVal)
  if (isNaN(num)) return 'normal'
  const wVal = tag.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
  const cVal = tag.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null

  if (cVal !== null && !isNaN(cVal)) {
    if (wVal !== null && wVal > cVal) {
      // Inverted logic: lower is worse (e.g. pressure/tank level drop)
      if (num <= cVal) return 'critical'
    } else {
      if (num >= cVal) return 'critical'
    }
  }
  if (wVal !== null && !isNaN(wVal)) {
    if (cVal !== null && wVal > cVal) {
      if (num <= wVal) return 'warning'
    } else {
      if (num >= wVal) return 'warning'
    }
  }
  return 'normal'
}

function getThresholdVisualMap(tag, defaultColor = '#2563eb') {
  // NOTE: visualMap with dimension:1 only works with [x,y] 2D data.
  // Since our data is plain scalar values, we use a different approach.
  // This function now returns null to signal "use direct color" approach.
  return null
}

// Returns the correct line color based on the LATEST data point crossing thresholds
function getLineColorForData(points, tag, defaultColor = '#2563eb') {
  if (!tag || !points || points.length === 0) return defaultColor
  const wVal = tag.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
  const cVal = tag.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
  if (wVal === null && cVal === null) return defaultColor

  // Use the LATEST value only — so color reflects current state, not history
  const latestVal = Number(points[points.length - 1].value)
  if (isNaN(latestVal)) return defaultColor

  const isInverted = wVal !== null && cVal !== null && wVal > cVal

  if (isInverted) {
    if (cVal !== null && !isNaN(cVal) && latestVal <= cVal) return '#ef4444'
    if (wVal !== null && !isNaN(wVal) && latestVal <= wVal) return '#f59e0b'
  } else {
    if (cVal !== null && !isNaN(cVal) && latestVal >= cVal) return '#ef4444'
    if (wVal !== null && !isNaN(wVal) && latestVal >= wVal) return '#f59e0b'
  }

  return defaultColor
}

function buildMiniOption(points = [], topicName, theme = {}, tag = null) {
  const textColor = theme.textColor || '#475569'
  const gridColor = theme.gridColor || '#e2e8f0'
  const axisLineColor = theme.axisLineColor || '#cbd5e1'
  const tooltipBg = theme.tooltipBg || 'rgba(255, 255, 255, 0.98)'
  const tooltipBorder = theme.tooltipBorder || '#cbd5e1'
  const tooltipText = theme.tooltipText || '#0f172a'
  const defaultLineColor = theme.lineColor || '#2563eb'

  const pts = points || []

  // Use the most severe status across ALL visible data points (not just the last value)
  const activeLineColor = getLineColorForData(pts, tag, defaultLineColor)

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderWidth: 1,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 10 },
      formatter: (params) => {
        const p = params[0]
        if (!p) return ''
        const valNum = Number(p.value)
        const st = getThresholdStatus(valNum, tag)
        const valColor = st === 'critical' ? '#ef4444' : st === 'warning' ? '#f59e0b' : defaultLineColor
        return `<div style="font-weight:700;font-size:9px;color:${textColor};">${p.axisValue}</div>
                <div style="font-size:11px;font-weight:800;color:${valColor};">${p.value}</div>`
      }
    },
    grid: { top: 8, bottom: 28, left: 38, right: 8 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: pts.map(p => p.time),
      axisLabel: {
        color: textColor, fontSize: 8, fontFamily: 'ui-monospace, monospace',
        interval: pts.length > 0 ? Math.floor(pts.length / 4) : 0,
        rotate: 0
      },
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      min: (extent) => {
        let minVal = extent.min
        const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
        const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
        if (wVal !== null && !isNaN(wVal)) minVal = Math.min(minVal, wVal)
        if (cVal !== null && !isNaN(cVal)) minVal = Math.min(minVal, cVal)
        const span = (extent.max - minVal) || 1
        return Math.floor(minVal - span * 0.05)
      },
      max: (extent) => {
        let maxVal = extent.max
        const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
        const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
        if (wVal !== null && !isNaN(wVal)) maxVal = Math.max(maxVal, wVal)
        if (cVal !== null && !isNaN(cVal)) maxVal = Math.max(maxVal, cVal)
        const span = (maxVal - extent.min) || 1
        return Math.ceil(maxVal + span * 0.05)
      },
      axisLabel: { color: textColor, fontSize: 8, fontFamily: 'ui-monospace, monospace' },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
    },
    series: [
      {
        name: topicName,
        type: 'line',
        smooth: 0.3,
        showSymbol: pts.length <= 1,
        symbolSize: 6,
        data: pts.map(p => p.value),
        itemStyle: { color: activeLineColor },
        lineStyle: { width: 1.8, color: activeLineColor },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${activeLineColor}40` },
              { offset: 1, color: `${activeLineColor}05` }
            ]
          }
        },
        markLine: getThresholdMarkLine(tag)
      }
    ]
  }
}

function getThresholdMarkLine(tag) {
  if (!tag) return undefined
  const markData = []
  const wVal = tag.warningThreshold !== null && tag.warningThreshold !== undefined && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
  const cVal = tag.criticalThreshold !== null && tag.criticalThreshold !== undefined && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null

  if (wVal !== null && !isNaN(wVal)) {
    markData.push({
      yAxis: wVal,
      name: 'Warning',
      lineStyle: { color: '#f59e0b', type: 'dashed', width: 1.8 },
      label: {
        formatter: `Warning: ${wVal}${tag.unit ? ' ' + tag.unit : ''}`,
        position: 'end',
        color: '#d97706',
        fontSize: 9,
        fontWeight: 'bold'
      }
    })
  }
  if (cVal !== null && !isNaN(cVal)) {
    markData.push({
      yAxis: cVal,
      name: 'Critical',
      lineStyle: { color: '#ef4444', type: 'dashed', width: 1.8 },
      label: {
        formatter: `Critical: ${cVal}${tag.unit ? ' ' + tag.unit : ''}`,
        position: 'end',
        color: '#dc2626',
        fontSize: 9,
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

function buildZoomOption(points, tag, theme = {}) {
  const textColor = theme.textColor || '#475569'
  const gridColor = theme.gridColor || '#e2e8f0'
  const axisLineColor = theme.axisLineColor || '#cbd5e1'
  const tooltipBg = theme.tooltipBg || 'rgba(255, 255, 255, 0.98)'
  const tooltipBorder = theme.tooltipBorder || '#cbd5e1'
  const tooltipText = theme.tooltipText || '#0f172a'
  const defaultLineColor = theme.lineColor || '#2563eb'

  const activeLineColor = getLineColorForData(points || [], tag, defaultLineColor)
  const markPointColor = activeLineColor

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
        const st = getThresholdStatus(valNum, tag)
        const color = st === 'critical' ? '#ef4444' : st === 'warning' ? '#f59e0b' : defaultLineColor
        return `<div style="font-weight:700;font-size:10px;color:${textColor};margin-bottom:4px;">${p.axisValue}</div>
                <div style="font-size:12px;font-weight:800;color:${color};">${p.value} <span style="font-weight:400;font-size:10px;color:${textColor};">${tag?.unit || ''}</span></div>`
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
        fillerColor: 'rgba(37, 99, 235, 0.12)',
        handleSize: '120%',
        handleStyle: {
          color: '#ffffff',
          borderColor: activeLineColor,
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
          lineStyle: { color: activeLineColor, width: 1 },
          areaStyle: { color: 'rgba(37, 99, 235, 0.05)' }
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
        if (wVal !== null && !isNaN(wVal)) minVal = Math.min(minVal, wVal)
        if (cVal !== null && !isNaN(cVal)) minVal = Math.min(minVal, cVal)
        const span = (extent.max - minVal) || 1
        return Math.floor(minVal - span * 0.05)
      },
      max: (extent) => {
        let maxVal = extent.max
        const wVal = tag?.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
        const cVal = tag?.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
        if (wVal !== null && !isNaN(wVal)) maxVal = Math.max(maxVal, wVal)
        if (cVal !== null && !isNaN(cVal)) maxVal = Math.max(maxVal, cVal)
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
      itemStyle: { color: activeLineColor },
      lineStyle: { width: 2.2, color: activeLineColor },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: `${activeLineColor}40` },
            { offset: 1, color: `${activeLineColor}05` }
          ]
        }
      },
      markLine: getThresholdMarkLine(tag),
      markPoint: points.length > 0 ? {
        data: [{ type: 'max', name: 'Latest', label: { show: false }, itemStyle: { color: markPointColor }, symbolSize: 10 }]
      } : undefined
    }]
  }
}

// ─── Individual Mini Card Component (Isolated live state + Zero Page Re-render) ───

const MiniGraphCard = memo(function MiniGraphCard({ tag, isEmployee, chartTheme, onOpenZoom }) {
  const targetTagId = tag._id || tag.tagId
  const [loading, setLoading] = useState(true)
  const [latestVal, setLatestVal] = useState(() => formatTagLiveValue(tag.liveValue ?? tag.latestValue, tag.decimal))
  const [status, setStatus] = useState(() => getThresholdStatus(tag.liveValue ?? tag.latestValue, tag))
  const [points, setPoints] = useState([])
  const pointsRef = useRef([])
  const chartInstanceRef = useRef(null)

  // 1. Initial 30-min data load
  useEffect(() => {
    let isCancelled = false
    async function fetchPastData() {
      try {
        setLoading(true)
        const endIso = new Date().toISOString()
        const startIso = new Date(Date.now() - WINDOW_MS).toISOString()

        let list = isEmployee
          ? await telemetryApi.getEmployeeReadings(targetTagId, 10000, startIso, endIso)
          : await telemetryApi.getManagerReadings(targetTagId, 10000, startIso, endIso)

        if ((!list || list.length === 0) && tag.tagId && tag.tagId !== targetTagId) {
          list = isEmployee
            ? await telemetryApi.getEmployeeReadings(tag.tagId, 10000, startIso, endIso)
            : await telemetryApi.getManagerReadings(tag.tagId, 10000, startIso, endIso)
        }

        if (isCancelled) return

        const cutoff = Date.now() - WINDOW_MS
        const sorted = (list || [])
          .filter(r => new Date(r.arrivedAt).getTime() >= cutoff)
          .sort((a, b) => new Date(a.arrivedAt) - new Date(b.arrivedAt))

        let pts = sorted.map(r => ({
          time: fmtTime(r.arrivedAt),
          arrivedAtIso: r.arrivedAt,
          value: r.value
        }))

        // If no past readings in window, but tag has latestValue, seed with 1 initial point so plot starts immediately
        if (pts.length === 0 && tag.latestValue !== null && tag.latestValue !== undefined) {
          const tTime = tag.arrivedAt || tag.latestArrivedAt || new Date()
          pts = [{
            time: fmtTime(tTime),
            arrivedAtIso: new Date(tTime).toISOString(),
            value: Number(tag.latestValue) || 0
          }]
        }

        pointsRef.current = pts
        setPoints(pts)

        if (pts.length > 0) {
          const lastVal = pts[pts.length - 1].value
          setLatestVal(formatTagLiveValue(lastVal, tag.decimal))
          setStatus(getThresholdStatus(lastVal, tag))
        }

        if (chartInstanceRef.current) {
          chartInstanceRef.current.setOption(
            buildMiniOption(pts, tag.displayName || tag.parameterName || tag.topicName, chartTheme, tag),
            true
          )
        }
      } catch (err) {
        console.error('Failed to load chart readings for tag:', targetTagId, err)
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    fetchPastData()
    return () => { isCancelled = true }
  }, [targetTagId, isEmployee, chartTheme, tag.displayName, tag.parameterName, tag.topicName, tag.decimal, tag.latestValue, tag.warningThreshold, tag.criticalThreshold])

  // 2. Real-time Plotting: Listen to socket for THIS tag only
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleReading = (reading) => {
      const match = String(reading.tagId) === String(targetTagId) || (tag.tagId && String(reading.tagId) === String(tag.tagId))
      if (!match) return

      const arrivedAtIso = reading.arrivedAt || new Date().toISOString()
      const newPt = {
        time: fmtTime(arrivedAtIso),
        arrivedAtIso,
        value: reading.value
      }

      pointsRef.current.push(newPt)

      // Retain last 30 minutes
      const cutoff = Date.now() - WINDOW_MS
      pointsRef.current = pointsRef.current.filter(p => new Date(p.arrivedAtIso).getTime() >= cutoff)

      // Smoothly update EChart in-place — ZERO parent re-render, ZERO other cards re-render!
      if (chartInstanceRef.current) {
        const newLineColor = getLineColorForData(pointsRef.current, tag, '#2563eb')
        chartInstanceRef.current.setOption({
          xAxis: {
            data: pointsRef.current.map(p => p.time),
            axisLabel: {
              interval: pointsRef.current.length > 0 ? Math.floor(pointsRef.current.length / 4) : 0
            }
          },
          series: [{
            data: pointsRef.current.map(p => p.value),
            showSymbol: pointsRef.current.length <= 1,
            itemStyle: { color: newLineColor },
            lineStyle: { width: 1.8, color: newLineColor },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: `${newLineColor}40` },
                  { offset: 1, color: `${newLineColor}05` }
                ]
              }
            },
            markLine: getThresholdMarkLine(tag)
          }]
        }, false) // notMerge: false avoids wiping the chart!
      }

      // Update latest value text badge & threshold status
      const dec = reading.decimal !== undefined ? reading.decimal : tag.decimal
      const isNone = dec === null || dec === undefined || String(dec).toLowerCase() === 'none' || Number(dec) === 0
      const rawVal = reading.valueStr ?? reading.valStr ?? reading.value
      const displayVal = isNone
        ? (!isNaN(Number(rawVal)) ? String(Math.trunc(Number(rawVal))) : String(rawVal).replace(/\.\d+$/, ''))
        : rawVal
      setLatestVal(displayVal)
      setStatus(getThresholdStatus(reading.value, tag))

      if (tag.assignedGraphType) {
        setPoints([...pointsRef.current])
      }
    }

    socket.on('telemetry:reading', handleReading)
    return () => socket.off('telemetry:reading', handleReading)
  }, [targetTagId, tag.tagId, tag.decimal, tag.assignedGraphType, tag.warningThreshold, tag.criticalThreshold])

  const cardBorderClass = status === 'critical'
    ? 'border-rose-500/70 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/20'
    : status === 'warning'
      ? 'border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20'
      : ''

  const valColor = status === 'critical'
    ? '#ef4444'
    : status === 'warning'
      ? '#f59e0b'
      : 'var(--text-primary)'

  return (
    <div
      onClick={() => onOpenZoom(tag, pointsRef.current)}
      className={`border hover:shadow-md cursor-pointer transition-all flex flex-col h-64 overflow-hidden group rounded-2xl relative ${cardBorderClass}`}
      style={{ background: 'var(--bg-card)', borderColor: cardBorderClass ? undefined : 'var(--border-color)' }}
    >
      {/* Card Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between shrink-0"
        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
      >
        <div className="min-w-0">
          <h4 className="text-xs font-bold group-hover:text-blue-600 transition-colors truncate" style={{ color: 'var(--text-primary)' }}>
            {tag.displayName || tag.topicName}
          </h4>
          <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[220px]">
            {tag.deviceName}
          </p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <span className="font-mono text-sm font-extrabold" style={{ color: valColor }}>
            {latestVal !== null && latestVal !== undefined ? latestVal : '—'}
          </span>
          {tag.unit && <span className="text-[9px] text-slate-400 font-normal ml-0.5">{tag.unit}</span>}

          {status === 'critical' ? (
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span className="text-[9px] text-rose-500 font-black uppercase tracking-wider">Critical</span>
            </div>
          ) : status === 'warning' ? (
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-[9px] text-amber-500 font-black uppercase tracking-wider">Warning</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Body */}
      <div className="flex-1 px-2 pb-2 pt-1 min-h-0 relative">
        {loading && points.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px]">
            <i className="pi pi-spin pi-spinner text-blue-600 text-xs" />
          </div>
        )}
        {tag.assignedGraphType ? (
          <div className="w-full h-full p-1 flex items-center justify-center">
            <DynamicGraphRenderer
              type={tag.assignedGraphType}
              masterVal={latestVal !== null ? latestVal : 65}
              customProps={{
                points: pointsRef.current,
                name: tag.displayName || tag.parameterName || tag.topicName,
                title: tag.displayName || tag.parameterName || tag.topicName,
                unit: tag.unit || '',
                onChartReady: (instance) => {
                  chartInstanceRef.current = instance
                }
              }}
              height="100%"
            />
          </div>
        ) : (
          <EChart
            option={buildMiniOption(
              pointsRef.current,
              tag.displayName || tag.parameterName || tag.topicName,
              chartTheme,
              tag
            )}
            className="w-full h-full"
            onChartReady={(instance) => {
              chartInstanceRef.current = instance
              if (pointsRef.current.length > 0) {
                instance.setOption(
                  buildMiniOption(pointsRef.current, tag.displayName || tag.parameterName || tag.topicName, chartTheme, tag),
                  true
                )
              }
            }}
          />
        )}
      </div>
    </div>
  )
})

// ─── Main GraphsPage Component ───────────────────────────────

export default function GraphsPage() {
  const session   = getSession()
  const isEmployee = session?.role === 'employee'
  const chartTheme = useChartTheme()

  const [tags, setTags]                 = useState([])
  const [loading, setLoading]           = useState(true)
  const [refreshKey, setRefreshKey]     = useState(0)
  const [selectedEmpId, setSelectedEmpId] = useState(
    localStorage.getItem('manager_selected_employee') || 'all'
  )
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage]                 = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)

  // ── Zoom dialog live state ──
  const [zoomDialog, setZoomDialog]         = useState(false)
  const [zoomTag, setZoomTag]               = useState(null)
  const [zoomChartData, setZoomChartData]   = useState(null)
  const [zoomEmpty, setZoomEmpty]           = useState(false)
  const [zoomLatestVal, setZoomLatestVal]   = useState(null)
  const zoomChartRef     = useRef(null)
  const zoomPointsRef    = useRef([])
  const zoomTagIdRef     = useRef(null)
  const zoomCleanupRef   = useRef(null)

  // ── Load telemetry list ──
  const loadTelemetry = async () => {
    try {
      setLoading(true)
      const data = isEmployee
        ? await telemetryApi.getEmployeeTelemetry(debouncedSearch, page + 1, PAGE_SIZE)
        : await telemetryApi.getManagerTelemetry(selectedEmpId, debouncedSearch, page + 1, PAGE_SIZE)
      setTags(data.tags || [])
      setTotalRecords(data.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load parameters' })
    } finally {
      setLoading(false)
    }
  }

  // ── Real-time tag deletion listener ──
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handleTagsDeleted = (data) => {
      const tagIds = data?.tagIds || []
      if (!Array.isArray(tagIds) || tagIds.length === 0) return
      const delSet = new Set(tagIds.map(String))
      setTags(prev => prev.filter(t => !delSet.has(String(t._id || t.tagId || t.id))))
    }
    socket.on('telemetry:tags-deleted', handleTagsDeleted)
    return () => socket.off('telemetry:tags-deleted', handleTagsDeleted)
  }, [])

  // ── Debounce search ──
  useEffect(() => {
    const h = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 500)
    return () => clearTimeout(h)
  }, [search])

  // ── Reload on scope / search / page change ──
  useEffect(() => { loadTelemetry() }, [selectedEmpId, debouncedSearch, page, isEmployee, refreshKey])

  // ── TopBar scope listener ──
  useEffect(() => {
    const h = () => { setSelectedEmpId(localStorage.getItem('manager_selected_employee') || 'all'); setPage(0) }
    window.addEventListener('manager_employee_changed', h)
    return () => window.removeEventListener('manager_employee_changed', h)
  }, [])

  // ── Zoom dialog — open with live moving-window ──
  const handleOpenZoom = useCallback(async (tag, existingPoints = []) => {
    if (zoomCleanupRef.current) { zoomCleanupRef.current(); zoomCleanupRef.current = null }

    setZoomTag(tag)
    setZoomDialog(true)
    setZoomChartData(null)
    setZoomEmpty(false)
    const initialVal = formatTagLiveValue(tag.liveValue ?? tag.latestValue, tag.decimal)
    setZoomLatestVal(initialVal)
    const targetTagId = tag._id || tag.tagId
    zoomTagIdRef.current = targetTagId

    try {
      let seedPoints = existingPoints && existingPoints.length > 0 ? [...existingPoints] : []

      if (seedPoints.length === 0) {
        const startDate = new Date(Date.now() - WINDOW_MS).toISOString()
        const endDate = new Date().toISOString()

        let seedReadings = isEmployee
          ? await telemetryApi.getEmployeeReadings(targetTagId, 10000, startDate, endDate)
          : await telemetryApi.getManagerReadings(targetTagId, 10000, startDate, endDate)

        if ((!seedReadings || seedReadings.length === 0) && tag.tagId && tag.tagId !== targetTagId) {
          seedReadings = isEmployee
            ? await telemetryApi.getEmployeeReadings(tag.tagId, 10000, startDate, endDate)
            : await telemetryApi.getManagerReadings(tag.tagId, 10000, startDate, endDate)
        }

        const cutoff = Date.now() - WINDOW_MS
        const sorted = [...(seedReadings || [])].sort((a, b) => new Date(a.arrivedAt) - new Date(b.arrivedAt))
        seedPoints = sorted
          .filter(r => new Date(r.arrivedAt).getTime() >= cutoff)
          .map(r => ({
            time: fmtTime(r.arrivedAt),
            arrivedAt: r.arrivedAt || new Date().toISOString(),
            value: r.value
          }))
      }

      if (seedPoints.length === 0 && tag.latestValue !== null && tag.latestValue !== undefined) {
        const tTime = tag.arrivedAt || tag.latestArrivedAt || new Date()
        seedPoints = [{
          time: fmtTime(tTime),
          arrivedAt: new Date(tTime).toISOString(),
          value: Number(tag.latestValue) || 0
        }]
      }

      zoomPointsRef.current = seedPoints
      setZoomChartData(buildZoomOption(seedPoints, tag, chartTheme))

      const socket = getSocket()
      if (socket) {
        const handleLive = (reading) => {
          const match = String(reading.tagId) === String(zoomTagIdRef.current) || (tag.tagId && String(reading.tagId) === String(tag.tagId))
          if (!match) return

          const arrivedAtIso = reading.arrivedAt || new Date().toISOString()
          const pt = {
            time: fmtTime(arrivedAtIso),
            arrivedAt: arrivedAtIso,
            value: reading.value
          }
          zoomPointsRef.current.push(pt)

          const windowCutoff = Date.now() - WINDOW_MS
          zoomPointsRef.current = zoomPointsRef.current.filter(p => new Date(p.arrivedAt).getTime() >= windowCutoff)

          if (zoomChartRef.current) {
            zoomChartRef.current.setOption({
              xAxis: {
                data: zoomPointsRef.current.map(p => p.time)
              },
              series: [{
                data: zoomPointsRef.current.map(p => p.value),
                markLine: getThresholdMarkLine(tag)
              }]
            }, false)
          }

          const dec = reading.decimal !== undefined ? reading.decimal : tag.decimal
          const isNone = dec === null || dec === undefined || String(dec).toLowerCase() === 'none' || Number(dec) === 0
          const rawVal = reading.valueStr ?? reading.valStr ?? reading.value
          const displayVal = isNone
            ? (!isNaN(Number(rawVal)) ? String(Math.trunc(Number(rawVal))) : String(rawVal).replace(/\.\d+$/, ''))
            : rawVal
          setZoomLatestVal(displayVal)
        }
        socket.on('telemetry:reading', handleLive)
        zoomCleanupRef.current = () => socket.off('telemetry:reading', handleLive)
      }
    } catch (err) {
      setZoomEmpty(true)
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to fetch history' })
    }
  }, [isEmployee, chartTheme])

  // ── Zoom dialog close ──
  const handleCloseZoom = useCallback(() => {
    if (zoomCleanupRef.current) { zoomCleanupRef.current(); zoomCleanupRef.current = null }
    zoomTagIdRef.current  = null
    zoomPointsRef.current = []
    zoomChartRef.current  = null
    setZoomDialog(false)
    setZoomChartData(null)
    setZoomEmpty(false)
    setZoomLatestVal(null)
  }, [])

  return (
    <div className="space-y-6">

      {/* Search + Refresh toolbar */}
      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-2xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div
          className="flex items-center rounded-xl px-2.5 h-9 focus-within:ring-1 focus-within:ring-purple-500 transition-all w-full sm:max-w-xs border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parameters..."
            className="w-full text-xs bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
            style={{ color: 'var(--text-primary)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer shrink-0">
              <i className="pi pi-times text-[9px]" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live indicator */}
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live
          </span>

          <button
            onClick={() => { setRefreshKey(k => k + 1) }}
            className="px-4 py-2 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all rounded-xl border"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            <i className={`pi pi-refresh text-[10px] ${loading ? 'pi-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {tags.length === 0 ? (
        <EmptyState
          message="No parameters found"
          description="Try adjusting your filters or search keywords to view other telemetry charts."
          icon="pi-chart-line"
        />
      ) : (
        <div className="space-y-6">
          {/* Charts Grid — 2-column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative">
            {loading && (
              <div
                className="absolute inset-0 backdrop-blur-[1px] z-10 flex items-center justify-center col-span-full"
                style={{ background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)' }}
              >
                <i className="pi pi-spin pi-spinner text-blue-600 text-lg" />
              </div>
            )}
            {tags.map(t => (
              <MiniGraphCard
                key={t._id || t.tagId}
                tag={t}
                isEmployee={isEmployee}
                chartTheme={chartTheme}
                onOpenZoom={handleOpenZoom}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalRecords > PAGE_SIZE && (
            <ReactPaginator
              totalRecords={totalRecords}
              rows={PAGE_SIZE}
              first={page * PAGE_SIZE}
              onPageChange={(e) => setPage(e.page)}
            />
          )}
        </div>
      )}

      {/* ── Live Zoom Dialog ── */}
      <Dialog
        visible={zoomDialog}
        onHide={handleCloseZoom}
        draggable={false}
        style={{ width: '90vw', maxWidth: '960px' }}
        contentStyle={{ display: 'flex', flexDirection: 'column' }}
        header={
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Live Moving Window</span>
              <span className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {zoomTag?.displayName || zoomTag?.topicName}
                {zoomTag?.unit && <span className="text-slate-400 font-normal text-xs ml-1.5">({zoomTag.unit})</span>}
                <span className="text-slate-400 font-normal text-xs ml-1.5">&bull; {zoomTag?.deviceName}</span>
              </span>
            </div>
            {(() => {
              const zStatus = getThresholdStatus(zoomLatestVal, zoomTag)
              if (zStatus === 'critical') {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full ml-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    Critical Alert
                  </span>
                )
              }
              if (zStatus === 'warning') {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full ml-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    Warning Alert
                  </span>
                )
              }
              return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full ml-auto">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Live Normal
                </span>
              )
            })()}
          </div>
        }
      >
        {/* Info bar */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 border-b shrink-0"
          style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
            <i className="pi pi-clock text-slate-400" />
            Seeded with last <span className="text-blue-600 font-bold mx-1">30 minutes</span> of data — sliding live time window
          </div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Real-time via socket
          </div>
        </div>

        <div className="w-full" style={{ height: '460px' }}>
          {zoomTag?.assignedGraphType ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <DynamicGraphRenderer
                type={zoomTag.assignedGraphType}
                masterVal={zoomLatestVal ?? zoomPointsRef.current.at(-1)?.value ?? 65}
                customProps={{
                  points: zoomPointsRef.current || [],
                  name: zoomTag.displayName || zoomTag.parameterName || zoomTag.topicName,
                  title: zoomTag.displayName || zoomTag.parameterName || zoomTag.topicName,
                  unit: zoomTag.unit || ''
                }}
                height="400px"
              />
            </div>
          ) : zoomChartData ? (
            <EChart
              option={zoomChartData}
              className="w-full h-full"
              onChartReady={(instance) => { zoomChartRef.current = instance }}
            />
          ) : zoomEmpty ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center border border-dashed gap-2.5 p-8 text-center select-none"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <i className="pi pi-chart-line text-slate-400 text-xl" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No recent data</h4>
                <p className="text-[11px] text-slate-400 font-medium max-w-xs leading-relaxed">
                  No readings found in the last 30 minutes. Live values will appear here once received.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center border border-dashed gap-2.5 p-8 text-center select-none"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <i className="pi pi-chart-line text-slate-400 text-xl" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Loading 30-min history…</h4>
                <p className="text-[11px] text-slate-400 font-medium max-w-xs leading-relaxed">
                  Fetching seed data. Live updates will stream in automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      </Dialog>

    </div>
  )
}
