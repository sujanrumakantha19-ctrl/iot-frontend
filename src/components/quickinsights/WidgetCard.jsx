import React, { useMemo } from 'react'
import DynamicMeterRenderer from '../meters/DynamicMeterRenderer'
import DynamicGraphRenderer from '../graphs/DynamicGraphRenderer'
import AssetTwinRenderer, { buildThresholdsFromBindings, buildTagIdMap } from '../assetTwins/AssetTwinRenderer'
import useAssetTwinLiveValues from '../../hooks/useAssetTwinLiveValues'
import { formatTagDisplayName } from '../../utils/tagUtils'

function getTagThresholdStatus(val, tag) {
  if (val === null || val === undefined) return 'normal'
  const num = Number(val)
  if (isNaN(num)) return 'normal'
  const wVal = tag.warningThreshold != null && tag.warningThreshold !== '' ? Number(tag.warningThreshold) : null
  const cVal = tag.criticalThreshold != null && tag.criticalThreshold !== '' ? Number(tag.criticalThreshold) : null
  if (wVal === null && cVal === null) return 'normal'
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

function AssetTwinWidgetContent({ assetTwin }) {
  const tagIdMap = buildTagIdMap(assetTwin?.tagBindings || {})
  const initialValues = assetTwin?.values || {}
  const { values } = useAssetTwinLiveValues(tagIdMap, initialValues)
  const thresholds = buildThresholdsFromBindings(assetTwin?.tagBindings || {})

  return (
    <AssetTwinRenderer
      templateId={assetTwin?.templateId || 'MOTOR_2D_SIEMENS'}
      title={assetTwin?.name}
      values={values}
      thresholds={thresholds}
      tagBindings={assetTwin?.tagBindings}
      compact
      showHeader={false}
      showFooter={false}
    />
  )
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

export default function WidgetCard({ widget, editable, onDelete }) {
  const isAssetTwin = widget.type === 'assetTwin'
  const tag = widget.tag || {}
  const rawValue = tag.latestValue ?? null
  const value = rawValue ?? 0
  const displayVal = formatTagValue(rawValue, tag.decimal)
  const displayName = isAssetTwin
    ? (widget.assetTwin?.name || 'Asset Digital Twin')
    : (formatTagDisplayName(tag) || 'Unknown Parameter')
  const unit = tag.unit || ''
  const isMeter = widget.type === 'meter'
  const isVerticalBar = widget.visualizationId === 'VERTICAL_BAR_IDLE' || widget.visualizationId === 'VERTICAL_BAR_NORMAL'

  // Threshold status for meter/graph widgets
  const status = (!isAssetTwin && tag) ? getTagThresholdStatus(rawValue, tag) : 'normal'
  const meterColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : (widget.meterColor || '#22c55e')
  const valColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : 'var(--text-primary)'

  const cardBorderClass = status === 'critical'
    ? 'border-rose-400/80 shadow-lg shadow-rose-500/10 ring-1 ring-rose-400/20'
    : status === 'warning'
      ? 'border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/20'
      : ''

  const badgeLabel = useMemo(() => {
    if (isAssetTwin) return 'Asset Twin'
    if (status === 'critical') return 'Critical'
    if (status === 'warning') return 'Warning'
    return isMeter ? 'Meter' : 'Graph'
  }, [isAssetTwin, isMeter, status])

  const badgeClass = useMemo(() => {
    if (isAssetTwin) return 'bg-violet-50 text-violet-700 border-violet-200/80'
    if (status === 'critical') return 'bg-rose-50/90 text-rose-600 border-rose-200/90 shadow-xs'
    if (status === 'warning') return 'bg-amber-50/90 text-amber-600 border-amber-200/90 shadow-xs'
    return isMeter ? 'bg-blue-50 text-blue-700 border-blue-200/80' : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
  }, [isAssetTwin, isMeter, status])

  return (
    <div
      className={`w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group relative ${cardBorderClass}`}
      style={{ background: 'var(--bg-card)', border: cardBorderClass ? undefined : '1px solid var(--border-color)' }}
    >
      <div
        className={`flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {status === 'critical' ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
          ) : status === 'warning' ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-extrabold truncate leading-tight" style={{ color: 'var(--text-primary)' }} title={displayName}>
              {displayName}
            </span>
            {!isAssetTwin && tag.deviceName && (
              <span className="text-[10px] font-semibold text-slate-400 truncate leading-tight">
                {tag.deviceName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isAssetTwin && displayVal !== null && (
            <div className="text-right">
              <span className="font-mono text-xs font-extrabold" style={{ color: valColor }}>
                {displayVal}
              </span>
              {unit && <span className="text-[9px] text-slate-400 font-normal ml-0.5">{unit}</span>}
            </div>
          )}

          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeClass}`}>
            {badgeLabel}
          </span>

          {editable && (
            <button
              onClick={() => onDelete(widget._id)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer border-none ml-1"
              title="Remove widget"
            >
              <i className="pi pi-trash text-[11px]" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full h-full flex flex-col relative overflow-hidden" style={{ background: 'var(--bg-card)' }}>
        {isAssetTwin ? (
          <div className="w-full h-full overflow-hidden p-1">
            <AssetTwinWidgetContent assetTwin={widget.assetTwin} />
          </div>
        ) : isMeter ? (
          <div
            className={`w-full h-full flex flex-col items-center justify-center p-2.5 overflow-hidden ${
              isVerticalBar ? '' : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950'
            }`}
            style={isVerticalBar ? { background: 'var(--bg-card)' } : {}}
          >
            <DynamicMeterRenderer
              type={widget.visualizationId}
              value={value}
              customProps={{
                min: widget.meterMin ?? 0,
                max: widget.meterMax ?? 100,
                idle: widget.meterIdle ?? 0,
                color: meterColor,
                unit,
                label: displayName
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full p-2 flex flex-col justify-center overflow-hidden" style={{ background: 'var(--bg-card)' }}>
            <DynamicGraphRenderer
              type={widget.visualizationId}
              masterVal={value != null ? Number(value) : 50}
              height="100%"
            />
          </div>
        )}
      </div>
    </div>
  )
}
