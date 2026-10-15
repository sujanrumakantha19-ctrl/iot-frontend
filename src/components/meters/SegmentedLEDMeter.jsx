import React from 'react'

export default function SegmentedLEDMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Temperature', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const statusColor = isCritical ? 'text-rose-500' : isWarning ? 'text-amber-400' : 'text-emerald-400'
  const bgGlow = isCritical ? 'shadow-rose-900/50 border-rose-500/40' : isWarning ? 'shadow-amber-900/50 border-amber-500/40' : 'shadow-emerald-900/50 border-emerald-500/40'
  const textGlow = isCritical ? 'drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]' : isWarning ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'

  const formattedVal = numVal.toFixed(1).padStart(6, ' ')

  return (
    <div className={`bg-slate-950 border p-4 shadow-xl flex flex-col items-center justify-between transition-all duration-300 relative overflow-hidden min-h-[220px] ${bgGlow}`}>
      {/* Top Label & Status */}
      <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-none border ${
          isCritical ? 'bg-rose-950/80 border-rose-800 text-rose-400 animate-pulse' : isWarning ? 'bg-amber-950/80 border-amber-800 text-amber-400' : 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
        }`}>
          {isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NORMAL'}
        </span>
      </div>

      {/* Main 7-Segment LED Display Box */}
      <div className="w-full bg-black/90 border border-slate-850 p-4 flex flex-col items-center justify-center relative my-auto shadow-inner">
        {/* Ghost background numbers 8888.8 for 7-segment illusion */}
        <span className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-slate-850 select-none absolute inset-0 flex items-center justify-center opacity-25">
          8888.8
        </span>
        
        {/* Live glowing value */}
        <div className="relative z-10 flex items-baseline gap-1">
          <span className={`text-3xl sm:text-4xl font-mono font-black tracking-widest ${statusColor} ${textGlow}`}>
            {formattedVal}
          </span>
          <span className={`text-xs font-mono font-bold ${statusColor}`}>
            {unit}
          </span>
        </div>
      </div>

      {/* Min / Max Footer Scale */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-3 border-t border-slate-800/80 mt-3">
        <span>MIN: {min}</span>
        <span>MAX: {max}</span>
      </div>
    </div>
  )
}
