export default function HorizontalBarGauge({
  value,
  min = 0,
  max = 100,
  unit = '',
  color = '#22c55e',
  label = ''
}) {
  const numVal = parseFloat(value)
  const minValue = Number(min)
  const maxValue = Number(max)
  const range = maxValue - minValue || 1

  let fillPct = 0
  if (!isNaN(numVal)) {
    const clampedVal = Math.max(minValue, Math.min(maxValue, numVal))
    fillPct = ((clampedVal - minValue) / range) * 100
  }

  const midValue = (minValue + maxValue) / 2
  const barColor = color || '#22c55e'

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-1.5 font-sans">
      {/* Header: Label and Value */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[11px] font-semibold text-slate-300 truncate max-w-[70%]" title={label}>
          {label || 'Gauge Bar'}
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: !isNaN(numVal) ? barColor : '#94a3b8' }}>
          {!isNaN(numVal) ? `${numVal} ${unit}`.trim() : 'N/A'}
        </span>
      </div>

      {/* Horizontal Bar Track */}
      <div className="relative w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner">
        <div
          style={{
            width: `${fillPct}%`,
            backgroundColor: barColor,
            transition: 'width 0.4s ease',
            height: '100%'
          }}
          className="rounded-full shadow-sm"
        />
      </div>

      {/* Scale Labels */}
      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 leading-none pt-0.5">
        <span>{minValue}</span>
        <span>{Number.isInteger(midValue) ? midValue : midValue.toFixed(1)}</span>
        <span>{maxValue}</span>
      </div>
    </div>
  )
}
