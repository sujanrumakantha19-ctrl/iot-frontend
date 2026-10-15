import React from 'react'

export default function MiniGaugeMeter({ value = 0, min = 0, max = 100, unit = '', color = '#84cc16' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const radius = 54
  const circ = 2 * Math.PI * radius
  const strokeDashoffset = circ * (1 - percentage)
  const strokeColor = color || '#84cc16'

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center p-1 select-none overflow-hidden">
      <div className="w-full h-full flex-1 min-h-0 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
        {/* Circle Arc — scales with available card space */}
        <div className="relative w-full h-full max-w-[260px] max-h-[260px] aspect-square flex items-center justify-center p-1">
          <svg viewBox="0 0 140 140" className="w-full h-full transform -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth="14"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="14"
              strokeDasharray={circ}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>

          {/* Centered Value & Unit */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black font-mono tracking-tight" style={{ color: strokeColor }}>
              {Number.isInteger(numVal) ? numVal : numVal.toFixed(2)}
            </span>
            {unit && (
              <span className="text-[10px] font-bold font-mono tracking-wider -mt-0.5 opacity-90" style={{ color: strokeColor }}>
                {unit}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
