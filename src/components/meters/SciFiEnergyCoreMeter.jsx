import React from 'react'

export default function SciFiEnergyCoreMeter({ value = 85, min = 0, max = 100, unit = '', label = 'Plasma Reactor Core' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const circ = 301
  const offset = circ * (1 - percentage)

  return (
    <div className="bg-slate-950 border border-violet-500/40 p-4 shadow-[0_0_20px_rgba(139,92,246,0.15)] flex flex-col items-center justify-between min-h-[260px] rounded-none text-violet-300 relative overflow-hidden">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-violet-500/20 pb-2 mb-1">
        <span className="text-xs font-mono font-black text-violet-300 uppercase tracking-widest truncate">{label}</span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-violet-950 border border-violet-500/40 text-violet-200">CORE-V9</span>
      </div>

      {/* Sci-Fi Core Arc Graphic */}
      <div className="relative w-40 h-40 flex items-center justify-center my-auto">
        <svg width="150" height="150" viewBox="0 0 150 150" className="transform -rotate-90">
          {/* Inner Ring */}
          <circle cx="75" cy="75" r="40" fill="none" stroke="#2e1065" strokeWidth="6" />
          {/* Outer Ring */}
          <circle cx="75" cy="75" r="48" fill="none" stroke="#4c1d95" strokeWidth="8" />
          <circle
            cx="75"
            cy="75"
            r="48"
            fill="none"
            stroke="#a855f7"
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 drop-shadow-[0_0_10px_#a855f7]"
          />
        </svg>

        {/* Pulsing Center Plasma Core */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-violet-900/40 border border-violet-400/60 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-pulse">
            <span className="text-2xl font-mono font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]">
              {numVal.toFixed(0)}
            </span>
            <span className="text-[9px] font-mono font-bold text-violet-300 ">
              {unit}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-between text-[9px] font-mono text-violet-400/80 pt-2 border-t border-violet-500/20">
        <span>STABILITY: NORMAL</span>
        <span className="text-violet-200 font-bold">{(percentage * 100).toFixed(0)}% CORE</span>
      </div>
    </div>
  )
}
