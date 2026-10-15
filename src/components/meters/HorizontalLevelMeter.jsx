import React from 'react'

export default function HorizontalLevelMeter({ value = 0, min = 0, max = 100, unit = '' }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = (clampedVal - min) / (max - min || 1)
  const totalBlocks = 15
  const activeBlocks = Math.round(percentage * totalBlocks)

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-between my-auto h-48 shadow-inner relative overflow-hidden">
        {/* Main Reading Callout */}
        <div className="w-full space-y-4 my-auto">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-3xl font-black font-mono text-white">
              {numVal.toFixed(1)}
            </span>
            {unit && (
              <span className="text-xs font-bold text-slate-400 font-mono">
                {unit}
              </span>
            )}
          </div>

          {/* Multi-block Segmented LED Bar */}
          <div className="flex items-center gap-1 bg-slate-900 p-1.5 border border-slate-800 rounded-md w-full">
            {Array.from({ length: totalBlocks }).map((_, idx) => {
              const isActive = idx < activeBlocks
              const blockPercent = (idx / totalBlocks) * 100
              
              let colorClass = 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
              if (blockPercent >= 80) colorClass = 'bg-rose-500 shadow-[0_0_6px_#ef4444]'
              else if (blockPercent >= 60) colorClass = 'bg-amber-500 shadow-[0_0_6px_#f59e0b]'

              return (
                <div
                  key={idx}
                  className={`h-6 flex-1 rounded-xs transition-all duration-300 ${
                    isActive ? colorClass : 'bg-slate-800/60'
                  }`}
                />
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800">
          <span>MIN: {min}</span>
          <span className="font-bold text-slate-300">{(percentage * 100).toFixed(0)}%</span>
          <span>MAX: {max}</span>
        </div>
      </div>
    </div>
  )
}
