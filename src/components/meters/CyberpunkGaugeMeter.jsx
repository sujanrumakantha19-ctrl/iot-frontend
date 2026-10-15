import React from 'react'

export default function CyberpunkGaugeMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Motor Velocity', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = (clampedVal - min) / (max - min || 1)

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const neonColor = isCritical ? '#f43f5e' : isWarning ? '#fbbf24' : '#06b6d4'
  const neonGlow = isCritical ? 'drop-shadow-[0_0_10px_#f43f5e]' : isWarning ? 'drop-shadow-[0_0_10px_#fbbf24]' : 'drop-shadow-[0_0_10px_#06b6d4]'

  // Circular ring math
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - percentage)

  return (
    <div className="bg-slate-950 border border-cyan-500/30 p-4 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col items-center justify-between text-cyan-400 min-h-[220px] relative overflow-hidden">
      {/* HUD Corner Accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2 z-10">
        <span className="text-[11px] font-mono font-black tracking-widest text-cyan-300 uppercase truncate" title={label}>
          {label}
        </span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/40 text-cyan-300">
          HUD-v4
        </span>
      </div>

      {/* Cyber Circular Ring */}
      <div className="relative flex items-center justify-center my-auto">
        <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#0f172a"
            strokeWidth="8"
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={neonColor}
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-500 ${neonGlow}`}
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-mono font-black tracking-tighter text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
            {numVal.toFixed(1)}
          </span>
          <span className="text-[10px] font-mono font-bold text-cyan-300 tracking-widest">
            {unit}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-between text-[9px] font-mono text-cyan-500/70 pt-2 border-t border-cyan-500/20 mt-2">
        <span>MIN: {min}</span>
        <span className="text-cyan-300 font-bold">{(percentage * 100).toFixed(0)}%</span>
        <span>MAX: {max}</span>
      </div>
    </div>
  )
}
