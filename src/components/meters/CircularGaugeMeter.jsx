import React from 'react'

export default function CircularGaugeMeter({ value = 0, min = 0, max = 100, unit = '', warning = 75, critical = 90 }) {
  const numVal = Number(value) || 0
  const clampedVal = Math.min(Math.max(numVal, min), max)
  const percentage = (clampedVal - min) / (max - min || 1)

  const isWarning = numVal >= warning && numVal < critical
  const isCritical = numVal >= critical

  const color = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'

  // SVG Arc Math (Radius 60, circumference ~ 377)
  const radius = 60
  const strokeWidth = 10
  const circumference = Math.PI * radius // Semi-circle arc length ~ 188.5
  const strokeDashoffset = circumference * (1 - percentage)

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center my-auto h-48 shadow-inner relative overflow-hidden">
        {/* SVG Arc Gauge */}
        <div className="relative flex items-center justify-center">
          <svg width="160" height="100" viewBox="0 0 160 100" className="overflow-visible">
            {/* Background Arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 140 80"
              fill="none"
              stroke="#1e293b"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Active Progress Arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 140 80"
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>

          {/* Center Live Readout */}
          <div className="absolute top-[35px] flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
              {numVal.toFixed(1)}
            </span>
            {unit && (
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                {unit}
              </span>
            )}
          </div>
        </div>

        {/* Min / Max scale labels */}
        <div className="w-full flex items-center justify-between text-[10px] font-mono font-semibold text-slate-500 px-4 mt-2">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
