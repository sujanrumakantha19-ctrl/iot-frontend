import React from 'react'

export default function MatrixLcdMeter({ value = 0, min = 0, max = 100, unit = '', label = 'Frequency', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = Math.round(((clampedVal - min) / (max - min || 1)) * 100)

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const statusText = isCritical ? 'ALARM' : isWarning ? 'ALERT' : 'ONLINE'

  return (
    <div className="bg-lime-950/95 border-2 border-lime-800 p-4 shadow-[0_0_15px_rgba(132,204,22,0.2)] flex flex-col items-center justify-between text-lime-400 font-mono min-h-[220px] relative">
      {/* LCD Header */}
      <div className="w-full flex items-center justify-between border-b border-lime-800/80 pb-2 mb-2">
        <span className="text-[11px] font-black uppercase tracking-widest text-lime-300 truncate" title={label}>
          [ {label} ]
        </span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${
          isCritical ? 'bg-rose-900 border-rose-600 text-rose-200 animate-pulse' : isWarning ? 'bg-amber-900 border-amber-600 text-amber-200' : 'bg-lime-900 border-lime-600 text-lime-200'
        }`}>
          {statusText}
        </span>
      </div>

      {/* Main LCD Screen */}
      <div className="w-full bg-lime-900/40 border border-lime-700/60 p-4 flex flex-col items-center justify-center my-auto shadow-inner relative overflow-hidden">
        {/* Scanlines Effect Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

        <div className="text-3xl font-black text-lime-300 tracking-widest drop-shadow-[0_0_6px_rgba(190,242,100,0.8)]">
          {numVal.toFixed(2)}
        </div>
        <div className="text-xs font-bold text-lime-400 mt-1 uppercase tracking-widest">
          UNIT: {unit}
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="w-full flex items-center justify-between text-[9px] text-lime-500/80 pt-2 border-t border-lime-800/80 mt-2">
        <span>MIN: {min}</span>
        <span className="text-lime-300 font-bold">LEVEL: {percentage}%</span>
        <span>MAX: {max}</span>
      </div>
    </div>
  )
}
