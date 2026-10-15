import React from 'react'

export default function VerticalBarMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Flow Rate', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = Math.round(((clampedVal - min) / (max - min || 1)) * 100)

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const fillGradient = isCritical
    ? 'from-rose-600 to-rose-400 shadow-rose-500/50'
    : isWarning
      ? 'from-amber-500 to-amber-300 shadow-amber-500/50'
      : 'from-blue-600 to-cyan-400 shadow-blue-500/50'

  const ticks = [100, 75, 50, 25, 0]

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 shadow-xl flex flex-col items-center justify-between text-white min-h-[220px]">
      {/* Label Header */}
      <div className="w-full flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        <span className="text-[10px] font-mono font-bold text-cyan-400">{percentage}%</span>
      </div>

      {/* Vertical Bar Container */}
      <div className="flex items-center gap-4 my-auto w-full justify-center">
        {/* Tick Marks Scale */}
        <div className="flex flex-col justify-between h-32 text-[9px] font-mono text-slate-400">
          {ticks.map(t => (
            <span key={t} className="leading-none">{t}%</span>
          ))}
        </div>

        {/* Outer Bar Slot */}
        <div className="w-8 h-32 bg-slate-950 border border-slate-750 p-1 relative shadow-inner flex flex-col justify-end">
          {/* Fill Level */}
          <div
            style={{ height: `${percentage}%` }}
            className={`w-full bg-gradient-to-t ${fillGradient} transition-all duration-500 shadow-md relative`}
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-white/60 animate-pulse" />
          </div>
        </div>

        {/* Live Reading Panel */}
        <div className="flex flex-col justify-center items-start text-left pl-2">
          <span className="text-2xl font-mono font-black text-white">
            {numVal.toFixed(1)}
          </span>
          <span className="text-[10px] font-mono text-slate-400 ">
            {unit}
          </span>
        </div>
      </div>

      {/* Min / Max Scale */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800 mt-2">
        <span>MIN: {min}</span>
        <span>MAX: {max}</span>
      </div>
    </div>
  )
}
