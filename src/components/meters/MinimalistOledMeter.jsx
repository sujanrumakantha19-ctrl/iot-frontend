import React from 'react'

export default function MinimalistOledMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Power Output', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = Math.round(((clampedVal - min) / (max - min || 1)) * 100)

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const pillColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-slate-900'

  return (
    <div className="bg-white border border-slate-200 p-4 shadow-sm flex flex-col items-center justify-between min-h-[220px]">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        <span className="text-[10px] font-bold font-mono text-slate-400">OLED</span>
      </div>

      {/* Main OLED Pill Display */}
      <div className="w-full bg-slate-50 border border-slate-200 p-4 flex flex-col items-center justify-center my-auto rounded-none">
        <div className="text-3xl font-black font-mono text-slate-850 tracking-tight">
          {numVal.toFixed(1)}{' '}
          <span className="text-xs font-semibold text-slate-400 font-sans">{unit}</span>
        </div>

        {/* Micro Bar */}
        <div className="w-full bg-slate-200 h-2 mt-3 overflow-hidden rounded-none relative">
          <div
            style={{ width: `${percentage}%` }}
            className={`h-full ${pillColor} transition-all duration-300`}
          />
        </div>
      </div>

      {/* Footer Scale */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-100 mt-2">
        <span>{min} {unit}</span>
        <span className="font-bold text-slate-700">{percentage}%</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  )
}
