import React from 'react'

export default function NeonGaugeArcMeter({ value = 49.51, min = 0, max = 100, unit = '', color }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const totalTicks = 24
  const activeTicks = Math.round(percentage * totalTicks)
  const valColor = color || '#67e8f9'

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Dark Screen */}
      <div className="w-full bg-black border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-between my-auto h-48 shadow-inner">
        {/* Arc Radial Ticks */}
        <div className="relative w-44 h-24 mt-2 flex justify-center overflow-hidden">
          {Array.from({ length: totalTicks }).map((_, idx) => {
            const angle = -90 + (idx / (totalTicks - 1)) * 180
            const isActive = idx < activeTicks
            return (
              <div
                key={idx}
                style={{ transform: `rotate(${angle}deg)` }}
                className="absolute bottom-0 w-1.5 h-20 origin-bottom flex flex-col items-center justify-start"
              >
                <div
                  className={`w-1 h-5 transition-colors duration-300 ${
                    isActive ? (color ? '' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]') : 'bg-slate-800'
                  }`}
                  style={isActive && color ? { backgroundColor: color, boxShadow: `0 0 8px ${color}` } : {}}
                />
              </div>
            )
          })}
        </div>

        {/* Center Readout */}
        <div className="flex flex-col items-center justify-center -mt-6">
          <span className="text-3xl font-black font-mono tracking-wider" style={{ color: valColor }}>
            {numVal.toFixed(2)}
          </span>
          {unit && (
            <span className="text-[10px] font-bold font-mono tracking-widest mt-0.5 opacity-90" style={{ color: valColor }}>
              {unit}
            </span>
          )}
        </div>

        <div className="w-full flex items-center justify-between text-xs font-mono font-bold text-slate-500 px-2">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
