import React from 'react'

export default function DigitalThermometer360Meter({ value = 30.45, min = 0, max = 100, unit = '', color }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const totalTicks = 48
  const activeTicks = Math.round(percentage * totalTicks)
  const valColor = color || '#67e8f9'

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center p-1 select-none overflow-hidden">
      {/* Main Dark LCD Display */}
      <div className="w-full h-full flex-1 min-h-0 bg-black border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
        <div className="relative w-full h-full max-w-[240px] max-h-[240px] aspect-square flex items-center justify-center">
          {/* Radial Ticks */}
          {Array.from({ length: totalTicks }).map((_, idx) => {
            const rot = (idx / totalTicks) * 360
            const isActive = idx < activeTicks
            return (
              <div
                key={idx}
                style={{ transform: `rotate(${rot}deg)` }}
                className="absolute w-full h-full flex justify-center items-start pointer-events-none"
              >
                <div
                  className={`w-1 h-3.5 transition-colors duration-300 ${
                    isActive ? (color ? '' : 'bg-pink-500 shadow-[0_0_6px_#ec4899]') : 'bg-slate-800'
                  }`}
                  style={isActive && color ? { backgroundColor: color, boxShadow: `0 0 6px ${color}` } : {}}
                />
              </div>
            )
          })}

          {/* Center Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black font-mono tracking-wider" style={{ color: valColor }}>
              {numVal.toFixed(2)}
            </span>
            {unit && (
              <span className="text-[10px] font-bold font-mono tracking-widest mt-0.5 opacity-90" style={{ color: valColor }}>
                {unit}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
