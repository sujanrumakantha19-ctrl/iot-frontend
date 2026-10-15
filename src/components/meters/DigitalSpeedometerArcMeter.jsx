import React from 'react'

export default function DigitalSpeedometerArcMeter({ value = 76.25, min = 0, max = 100, unit = '', color }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const totalTicks = 28
  const activeTicks = Math.round(percentage * totalTicks)
  const valColor = color || '#67e8f9'

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center p-1 select-none overflow-hidden">
      {/* Main Dark Arc Screen */}
      <div className="w-full h-full flex-1 min-h-0 bg-black border border-slate-800 rounded-xl p-3 flex flex-col items-between justify-between relative shadow-inner">
        {/* Semi-Circle Arc Ticks */}
        <div className="relative w-full flex-1 min-h-0 max-w-[280px] max-h-[160px] mt-1 flex justify-center overflow-hidden mx-auto">
          {Array.from({ length: totalTicks }).map((_, idx) => {
            const angle = -90 + (idx / (totalTicks - 1)) * 180
            const isActive = idx < activeTicks
            return (
              <div
                key={idx}
                style={{ transform: `rotate(${angle}deg)` }}
                className="absolute bottom-0 w-1.5 h-full origin-bottom flex flex-col items-center justify-start"
              >
                <div
                  className={`w-1 h-4 transition-colors duration-300 ${
                    isActive ? (color ? '' : 'bg-amber-400 shadow-[0_0_6px_#f59e0b]') : 'bg-slate-800'
                  }`}
                  style={isActive && color ? { backgroundColor: color, boxShadow: `0 0 6px ${color}` } : {}}
                />
              </div>
            )
          })}
        </div>

        {/* Center Digital Display & Footer Bounds */}
        <div className="flex flex-col items-center justify-center -mt-4 shrink-0">
          <span className="text-3xl font-black font-mono tracking-wider" style={{ color: valColor }}>
            {numVal.toFixed(2)}
          </span>
          {unit && (
            <span className="text-[10px] font-bold font-mono tracking-widest mt-0.5 opacity-90" style={{ color: valColor }}>
              {unit}
            </span>
          )}
        </div>

        <div className="w-full flex items-center justify-between text-xs font-mono font-bold text-slate-500 px-2 shrink-0">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
