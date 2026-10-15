import React from 'react'

export default function SimpleNeonGaugeMeter({ value = 9.98, min = 0, max = 100, unit = '', color }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const totalTicks = 44
  const activeTicks = Math.round(percentage * totalTicks)
  const valColor = color || '#34d399'

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Dark LCD Display */}
      <div className="w-full bg-black border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center my-auto h-48 shadow-inner">
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Radial Neon Ticks */}
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
                    isActive ? (color ? '' : 'bg-emerald-400 shadow-[0_0_6px_#34d399]') : 'bg-slate-800'
                  }`}
                  style={isActive && color ? { backgroundColor: color, boxShadow: `0 0 6px ${color}` } : {}}
                />
              </div>
            )
          })}

          {/* Center Digital Value */}
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
