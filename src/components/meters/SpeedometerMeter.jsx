import React from 'react'

export default function SpeedometerMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Velocity Tachometer', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = (clampedVal - min) / (max - min || 1)

  // Angle from -120deg to +120deg (240deg total sweep)
  const angle = -120 + percentage * 240

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const needleColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#3b82f6'

  return (
    <div className="bg-slate-950 border border-slate-800 p-4 shadow-xl flex flex-col items-center justify-between text-slate-200 min-h-[220px]">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        <span className="text-[9px] font-mono font-bold text-slate-400">DIAL-V2</span>
      </div>

      {/* Speedometer Dial */}
      <div className="relative w-36 h-36 flex items-center justify-center my-auto">
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Outer Ring Ticks */}
          <circle cx="70" cy="70" r="60" fill="none" stroke="#1e293b" strokeWidth="6" />
          {/* Warning Zone Arc */}
          <path d="M 27 113 A 60 60 0 0 1 113 113" fill="none" stroke="#334155" strokeWidth="6" />
          <path d="M 100 35 A 60 60 0 0 1 113 113" fill="none" stroke="#ef4444" strokeWidth="6" />
        </svg>

        {/* Rotating Needle */}
        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className="absolute w-1 h-14 bg-gradient-to-t from-transparent to-rose-500 origin-bottom bottom-[70px] transition-transform duration-500 ease-out z-10"
        />

        {/* Center Cap & Readout */}
        <div className="absolute w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-700 flex flex-col items-center justify-center shadow-md z-20">
          <span className="text-sm font-black font-mono text-white leading-none">
            {numVal.toFixed(0)}
          </span>
          <span className="text-[8px] font-mono font-bold text-slate-400 leading-tight mt-0.5">
            {unit}
          </span>
        </div>
      </div>

      {/* Footer Range */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800 mt-1">
        <span>0</span>
        <span style={{ color: needleColor }} className="font-bold">{(percentage * 100).toFixed(0)}%</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
