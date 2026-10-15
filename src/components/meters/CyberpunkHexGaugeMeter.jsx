import React from 'react'

export default function CyberpunkHexGaugeMeter({ value = 72, min = 0, max = 100, unit = '', label = 'Cyberpunk Hex Core' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const circ = 339
  const strokeDashoffset = circ * (1 - percentage)

  return (
    <div className="bg-slate-950 border border-fuchsia-500/40 p-4 shadow-[0_0_20px_rgba(217,70,239,0.15)] flex flex-col items-center justify-between min-h-[260px] rounded-none relative overflow-hidden">
      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-fuchsia-500" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-fuchsia-500" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-fuchsia-500" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-fuchsia-500" />

      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-fuchsia-500/20 pb-2 mb-2">
        <span className="text-xs font-mono font-black text-fuchsia-400 uppercase tracking-widest truncate">{label}</span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-fuchsia-950 border border-fuchsia-500/40 text-fuchsia-300">HEX-HUD</span>
      </div>

      {/* Hexagonal Frame with SVG Ring */}
      <div className="relative w-40 h-40 flex items-center justify-center my-auto">
        <svg width="150" height="150" viewBox="0 0 150 150" className="transform -rotate-90">
          {/* Outer Ring */}
          <circle cx="75" cy="75" r="54" fill="none" stroke="#1e1b4b" strokeWidth="8" />
          <circle
            cx="75"
            cy="75"
            r="54"
            fill="none"
            stroke="#d946ef"
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 drop-shadow-[0_0_8px_#d946ef]"
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-mono font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] tracking-tighter">
            {numVal.toFixed(1)}
          </span>
          <span className="text-[10px] font-mono font-bold text-fuchsia-400 tracking-widest">
            {unit}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-between text-[9px] font-mono text-fuchsia-500/80 pt-2 border-t border-fuchsia-500/20">
        <span>MIN: {min}</span>
        <span className="text-fuchsia-300 font-bold">{(percentage * 100).toFixed(0)}%</span>
        <span>MAX: {max}</span>
      </div>
    </div>
  )
}
