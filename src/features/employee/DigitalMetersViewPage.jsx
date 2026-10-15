import { useState, useEffect, useCallback } from 'react'
import DynamicMeterRenderer from '../../components/meters/DynamicMeterRenderer'
import HorizontalBarGauge from '../../components/meters/HorizontalBarGauge'
import ReactPaginator from '../../components/shared/ReactPaginator'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import { assignApi } from '../../services/assignApi'
import { getSocket } from '../../services/socketClient'
import { showToast } from '../../utils/toast'
import { formatTagDisplayName } from '../../utils/tagUtils'

function getThresholdStatus(val, tag) {
  if (val === null || val === undefined) return 'normal'
  const num = Number(val)
  if (isNaN(num)) return 'normal'
  const wVal = tag.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
  const cVal = tag.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
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

function formatTagValue(val, dec) {
  if (val === null || val === undefined || val === '') return null
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
  return String(Math.trunc(num))
}

export default function DigitalMetersViewPage() {
  const [meters, setMeters] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const [first, setFirst] = useState(0)
  const PAGE_SIZE = 10

  const loadMeters = useCallback(async (pageNum) => {
    try {
      setLoading(true)
      const data = await assignApi.getEmployeeDigitalMeters(pageNum, PAGE_SIZE)
      setMeters(data.tags || [])
      setTotalRecords(data.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load assigned digital meters' })
      setMeters([])
      setTotalRecords(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMeters(1)
  }, [loadMeters])

  // Real-time telemetry Socket.IO subscription to update live values on meters
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleTelemetryReading = (reading) => {
      setMeters((prevMeters) =>
        prevMeters.map((m) => {
          const idMatches = (m.tagId && m.tagId === reading.tagId) || (m._id && m._id.toString() === reading.tagId) || (m.id && m.id === reading.tagId)
          if (idMatches) {
            return {
              ...m,
              decimal: reading.decimal !== undefined ? reading.decimal : m.decimal,
              liveValue: reading.valueStr ?? reading.valStr ?? reading.value,
              arrivedAt: reading.arrivedAt
            }
          }
          return m
        })
      )
    }

    const handleTagsChanged = () => {
      loadMeters(1)
    }

    socket.on('telemetry:reading', handleTelemetryReading)
    socket.on('telemetry:tags-deleted', handleTagsChanged)
    socket.on('telemetry:assignments-updated', handleTagsChanged)
    socket.on('dashboard:refresh-required', handleTagsChanged)

    return () => {
      socket.off('telemetry:reading', handleTelemetryReading)
      socket.off('telemetry:tags-deleted', handleTagsChanged)
      socket.off('telemetry:assignments-updated', handleTagsChanged)
      socket.off('dashboard:refresh-required', handleTagsChanged)
    }
  }, [loadMeters])

  const handlePageChange = (e) => {
    setFirst(e.first)
    const pageNum = e.page + 1
    loadMeters(pageNum)
  }

  if (loading && meters.length === 0) {
    return <LoadingSpinner text="Connecting your digital meters..." />
  }

  return (
    <div className="space-y-6">
      {/* Main Grid of Digital Meters */}
      <div className="bg-white border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <i className="pi pi-gauge text-purple-600 text-lg" />
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Assigned Digital Meters List
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            Showing {meters.length} of {totalRecords} assigned meters
          </span>
        </div>

        {meters.length === 0 ? (
          <EmptyState
            message="No digital meters assigned"
            description="Your manager has not assigned any digital meter visualizations to your parameter scope yet."
            icon="pi-gauge"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {meters.map((meter) => {
              const rawVal = meter.liveValue ?? meter.latestValue
              const status = getThresholdStatus(rawVal, meter)
              const displayVal = formatTagValue(rawVal, meter.decimal)
              const valColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#0f172a'
              const cardBorder = status === 'critical'
                ? 'border-rose-400/70 shadow-lg shadow-rose-500/10 ring-1 ring-rose-400/20'
                : status === 'warning'
                  ? 'border-amber-400/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/20'
                  : 'border-slate-200/90 hover:border-purple-400/80'
              const liveBadge = status === 'critical'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : status === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
              const liveLabel = status === 'critical' ? 'Critical' : status === 'warning' ? 'Warning' : 'Live'

              return (
              <div
                key={meter.tagId || meter._id}
                className={`bg-white border rounded-2xl shadow-sm transition-all duration-300 flex flex-col overflow-hidden group hover:shadow-xl ${cardBorder}`}
              >
                {/* Meter Card Header */}
                <div className="px-4 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between gap-3 group-hover:bg-purple-50/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-extrabold text-slate-800 truncate group-hover:text-purple-700 transition-colors" title={formatTagDisplayName(meter)}>
                      {formatTagDisplayName(meter)}
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono font-medium truncate mt-0.5">
                      {meter.deviceName} <span className="text-slate-350">({meter.gateway?.name || 'N/A'})</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="font-mono text-sm font-extrabold" style={{ color: valColor }}>
                      {displayVal !== null && displayVal !== undefined ? displayVal : '—'}
                    </span>
                    {meter.unit && <span className="text-[9px] text-slate-400 font-normal ml-0.5">{meter.unit}</span>}
                    <div className="mt-0.5 flex justify-end">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border text-[9px] font-bold uppercase rounded-full shrink-0 ${liveBadge}`}>
                        {status === 'critical' ? (
                          <span className="relative flex h-2 w-2 mr-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                          </span>
                        ) : status === 'warning' ? (
                          <span className="relative flex h-2 w-2 mr-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-0.5" />
                        )}
                        {liveLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Instrument Display Canvas */}
                <div className={`relative overflow-hidden flex-1 min-h-[260px] ${
                  meter.assignedMeterType === 'VERTICAL_BAR_IDLE' || meter.assignedMeterType === 'VERTICAL_BAR_NORMAL'
                    ? 'bg-white p-3 flex flex-col items-center justify-center'
                    : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-3 ring-1 ring-black/10 flex flex-col gap-3 items-center justify-center'
                }`}>
                  {/* Background grid glow overlay (for non-vertical meters) */}
                  {meter.assignedMeterType !== 'VERTICAL_BAR_IDLE' && meter.assignedMeterType !== 'VERTICAL_BAR_NORMAL' && (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent opacity-60 pointer-events-none" />
                  )}

                  <div className="relative z-10 w-full">
                    <DynamicMeterRenderer
                      type={meter.assignedMeterType}
                      value={meter.liveValue ?? 0}
                      unit={meter.unit || ''}
                      customProps={{
                        min: meter.meterMin ?? 0,
                        max: meter.meterMax ?? 100,
                        idle: meter.meterIdle ?? 0,
                        color: status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : (meter.meterColor || '#22c55e'),
                        unit: meter.unit || '',
                        label: formatTagDisplayName(meter)
                      }}
                    />
                  </div>

                  {/* Horizontal Bar Gauge placed horizontally below digital meter (except vertical bar meters) */}
                  {meter.assignedMeterType !== 'VERTICAL_BAR_IDLE' && meter.assignedMeterType !== 'VERTICAL_BAR_NORMAL' && (
                    <HorizontalBarGauge
                      value={meter.liveValue ?? 0}
                      min={meter.meterMin ?? 0}
                      max={meter.meterMax ?? 100}
                      unit={meter.unit || ''}
                      color={status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : (meter.meterColor || '#22c55e')}
                      label={formatTagDisplayName(meter)}
                    />
                  )}
                </div>

                {/* Meter Footer Info Bar */}
                <div className="px-4 py-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono font-semibold text-slate-500 gap-2">
                  <span className="flex items-center gap-1 shrink-0">
                    <i className="pi pi-sliders-h text-[9px] text-slate-400" />
                    Scale: {meter.meterMin ?? 0} &rarr; {meter.meterMax ?? 100} {meter.unit}
                  </span>

                  {/* Assigned User Badge (Reference Image Match) */}
                  {meter.assignedEmployees && meter.assignedEmployees.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded-full border border-blue-200/80 shadow-xs" title={meter.assignedEmployees.map(e => e.name || e.email).join(', ')}>
                      <i className="pi pi-users text-[9px] text-blue-600" />
                      <span>{meter.assignedEmployees.length === 1 ? meter.assignedEmployees[0].name : `${meter.assignedEmployees.length} User`}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-medium rounded-full">
                      <i className="pi pi-user text-[8px] text-slate-350" />
                      <span>Unassigned</span>
                    </span>
                  )}

                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/80 text-[9px] font-bold uppercase tracking-wider rounded shrink-0">
                    {meter.assignedMeterType}
                  </span>
                </div>
              </div>
            )})}
          </div>
        )}

        {/* Server-side Paginator */}
        {totalRecords > PAGE_SIZE && (
          <div className="pt-4">
            <ReactPaginator
              totalRecords={totalRecords}
              rows={PAGE_SIZE}
              first={first}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
