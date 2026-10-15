import React from 'react'

export default function DigitalHorizontalBarMeter({ value = 105.77, min = 0, max = 180, unit = '', color }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const totalBars = 24
  const activeBars = Math.round(percentage * totalBars)
  const valColor = color || '#67e8f9'

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Dark Screen */}
      <div className="w-full bg-black border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-between my-auto h-48 overflow-hidden relative shadow-inner">
        {/* Top Digital Readout */}
        <span className="text-3xl font-black font-mono tracking-wider pt-1" style={{ color: valColor }}>
          {numVal.toFixed(2)}
        </span>

        {/* Horizontal LED Bar Stack */}
        <div className="flex items-center gap-[2px] w-full my-auto px-2 h-12 bg-slate-950 p-1 border border-slate-800 rounded">
          {Array.from({ length: totalBars }).map((_, idx) => {
            const isActive = idx < activeBars
            return (
              <div
                key={idx}
                className={`h-full flex-1 transition-all duration-300 ${
                  isActive ? 'bg-amber-400 shadow-[0_0_4px_#f59e0b]' : 'bg-slate-900'
                }`}
              />
            )
          })}
        </div>

        {/* Footer Bounds & Unit */}
        <div className="w-full flex items-center justify-between text-xs font-mono font-bold text-slate-500 px-2 pb-1">
          <span>{min}</span>
          {unit && <span className="text-cyan-400 tracking-widest">{unit}</span>}
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
