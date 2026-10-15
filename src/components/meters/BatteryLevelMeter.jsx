import React from 'react'

export default function BatteryLevelMeter({ value = 78, min = 0, max = 100, unit = '' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = Math.round(((clamped - min) / (max - min || 1)) * 100)

  const totalBars = 5
  const activeBars = Math.ceil((percentage / 100) * totalBars)

  const isLow = percentage <= 20
  const isWarning = percentage > 20 && percentage <= 50

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Battery Shell Graphic */}
      <div className="my-auto w-full bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center space-y-3 shadow-inner h-48">
        {/* Battery Top Terminal Nipple */}
        <div className="w-10 h-2 bg-slate-600 rounded-t-sm border border-slate-500 shadow-sm" />

        {/* Battery Main Body Tube */}
        <div className="w-40 h-20 bg-slate-900 border-2 border-slate-700 p-2 shadow-inner flex items-center gap-1.5 rounded-md">
          {Array.from({ length: totalBars }).map((_, idx) => {
            const isActive = idx < activeBars
            let color = 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
            if (isLow) color = 'bg-rose-500 shadow-[0_0_8px_#ef4444]'
            else if (isWarning) color = 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'

            return (
              <div
                key={idx}
                className={`h-full flex-1 rounded-xs transition-all duration-300 ${
                  isActive ? color : 'bg-slate-800/60'
                }`}
              />
            )
          })}
        </div>

        {/* Large Readout */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black font-mono text-white">
            {percentage}
          </span>
          <span className="text-sm font-bold text-slate-400 font-mono">
            {unit}
          </span>
        </div>
      </div>
    </div>
  )
}
