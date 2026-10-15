import React from 'react'

export default function LcdGaugeArcMeter({ value = 99, min = 0, max = 180, unit = '' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const totalTicks = 32
  const activeTicks = Math.round(percentage * totalTicks)

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Gray LCD Display */}
      <div className="w-full bg-[#bbb8ac] border border-[#a3a093] rounded-xl p-4 flex flex-col items-center justify-between my-auto h-48 shadow-inner">
        {/* Arc Ticks */}
        <div className="relative w-44 h-24 mt-1 flex justify-center overflow-hidden">
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
                  className={`w-1 h-4 transition-colors duration-300 ${
                    isActive ? 'bg-[#2b2b2b]' : 'bg-[#a3a093]'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* Center Digital LCD Display */}
        <div className="flex flex-col items-center justify-center -mt-6">
          <span className="text-3xl font-black font-mono text-[#2b2b2b] tracking-wider">
            {Math.round(numVal)}
          </span>
          {unit && (
            <span className="text-[10px] font-bold font-mono text-[#444] tracking-widest">
              {unit}
            </span>
          )}
        </div>

        <div className="w-full flex items-center justify-between text-xs font-mono font-bold text-[#444] px-2">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
