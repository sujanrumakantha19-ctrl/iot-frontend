import React from 'react'

export default function NeumorphicMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Humidity Sensor', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = (clampedVal - min) / (max - min || 1)

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const statusColor = isCritical ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-indigo-600'

  return (
    <div className="bg-slate-100 border border-slate-200 p-4 shadow-[5px_5px_10px_#cbd5e1,-5px_-5px_10px_#ffffff] flex flex-col items-center justify-between min-h-[220px]">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        <span className="text-[9px] font-bold text-slate-400 px-2 py-0.5 rounded-full bg-slate-200/80 shadow-inner">
          NEUMORPHIC
        </span>
      </div>

      {/* Center Neumorphic Circular Well */}
      <div className="relative w-28 h-28 rounded-full bg-slate-100 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff] flex flex-col items-center justify-center my-auto">
        <div className="text-2xl font-black font-mono text-slate-800 tracking-tight">
          {numVal.toFixed(1)}
        </div>
        <div className={`text-[10px] font-bold font-mono ${statusColor} uppercase`}>
          {unit}
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden shadow-inner my-2">
        <div
          style={{ width: `${percentage * 100}%` }}
          className={`h-full transition-all duration-500 ${
            isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-600'
          }`}
        />
      </div>

      {/* Footer Range */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
        <span>{min}</span>
        <span className="font-bold text-slate-600">{(percentage * 100).toFixed(0)}%</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
