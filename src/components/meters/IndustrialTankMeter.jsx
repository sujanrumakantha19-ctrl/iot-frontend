import React from 'react'

export default function IndustrialTankMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Chemical Tank 01', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = Math.round(((clampedVal - min) / (max - min || 1)) * 100)

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const liquidGradient = isCritical
    ? 'from-rose-600/90 to-rose-400/90'
    : isWarning
      ? 'from-amber-500/90 to-amber-300/90'
      : 'from-cyan-600/90 to-blue-400/90'

  return (
    <div className="w-full h-full max-h-full bg-slate-900 border border-slate-800 p-3 shadow-xl flex flex-col items-center justify-between text-white overflow-hidden rounded-xl">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1 shrink-0">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        <span className="text-[10px] font-mono font-bold text-cyan-400">TANK-3D</span>
      </div>

      {/* Tank Graphic Container */}
      <div className="flex items-center gap-4 my-auto w-full justify-center">
        {/* 3D Tank Cylinder */}
        <div className="w-16 h-32 bg-slate-950 border-2 border-slate-700 rounded-t-xl rounded-b-xl relative overflow-hidden shadow-inner flex flex-col justify-end">
          {/* Liquid Fill */}
          <div
            style={{ height: `${percentage}%` }}
            className={`w-full bg-gradient-to-t ${liquidGradient} transition-all duration-500 relative`}
          >
            {/* Animated Surface Wave Line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-white/70 animate-pulse" />
          </div>

          {/* Overlay Grid Ticks */}
          <div className="absolute inset-0 flex flex-col justify-between p-1 opacity-20 pointer-events-none">
            <div className="border-b border-white w-full" />
            <div className="border-b border-white w-full" />
            <div className="border-b border-white w-full" />
            <div className="border-b border-white w-full" />
          </div>
        </div>

        {/* Live Value Details */}
        <div className="flex flex-col justify-center text-left">
          <span className="text-3xl font-black font-mono text-white tracking-tight">
            {percentage}%
          </span>
          <span className="text-sm font-bold text-cyan-300 font-mono mt-0.5">
            {numVal.toFixed(0)} <span className="text-[10px] text-slate-400 font-normal">{unit}</span>
          </span>
          <span className={`text-[9px] font-mono font-bold uppercase mt-2 px-2 py-0.5 w-max ${
            isCritical ? 'bg-rose-950 border border-rose-800 text-rose-400' : isWarning ? 'bg-amber-950 border border-amber-800 text-amber-400' : 'bg-cyan-950 border border-cyan-800 text-cyan-400'
          }`}>
            {isCritical ? 'HIGH ALARM' : isWarning ? 'WARNING' : 'STABLE'}
          </span>
        </div>
      </div>

      {/* Footer Range */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800 mt-2">
        <span>MIN: {min}</span>
        <span>MAX: {max} {unit}</span>
      </div>
    </div>
  )
}
