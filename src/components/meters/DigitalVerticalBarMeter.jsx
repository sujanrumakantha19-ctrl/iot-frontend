import React from 'react'

export default function DigitalVerticalBarMeter({ value = 17.73, min = -60, max = 60, unit = '', color }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const totalBars = 14
  const activeBars = Math.round(percentage * totalBars)
  const valColor = color || '#67e8f9'

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-1 select-none overflow-hidden">
      {/* Dark LCD Screen */}
      <div className="w-full h-full flex-1 min-h-[90px] max-h-[190px] bg-black border border-slate-800 rounded-xl p-2.5 flex flex-col items-center justify-between text-cyan-300 overflow-hidden relative shadow-inner">
        {/* Top Digital Readout */}
        <span className="text-xl font-black font-mono tracking-wider pt-0.5 shrink-0" style={{ color: valColor }}>
          {numVal.toFixed(2)}
        </span>

        {/* Center Vertical LED Stack & Scale Numbers */}
        <div className="flex items-center justify-center gap-4 w-full my-auto px-4">
          {/* LED Stack Container */}
          <div className="flex flex-col-reverse justify-between gap-[3px] w-28 h-28 p-1 bg-slate-950 border border-slate-800">
            {Array.from({ length: totalBars }).map((_, idx) => {
              const isActive = idx < activeBars
              return (
                <div
                  key={idx}
                  className={`h-1.5 w-full transition-all duration-300 ${
                    isActive ? 'bg-pink-500 shadow-[0_0_6px_#ec4899]' : 'bg-slate-900'
                  }`}
                />
              )
            })}
          </div>

          {/* Scale Numbers Aligned Perfectly */}
          <div className="flex flex-col justify-between h-28 text-[11px] font-mono font-bold text-slate-500 py-0.5">
            <span>{max}</span>
            <span>{Math.round((max + min) / 2)}</span>
            <span>{min}</span>
          </div>
        </div>

        {unit && (
          <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 pb-1">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
