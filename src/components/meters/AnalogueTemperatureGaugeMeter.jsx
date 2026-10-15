import React from 'react'

export default function AnalogueTemperatureGaugeMeter({ value = -6.0, min = -60, max = 60, unit = '' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  // Sweep from -135deg to +135deg (270deg total)
  const needleAngle = -135 + percentage * 270

  // Polar numbers placement (-60 to 60)
  const scaleValues = [-60, -40, -20, 0, 20, 40, 60]

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Round Analogue Dial */}
      <div className="relative w-44 h-44 rounded-full bg-slate-100 border-4 border-slate-300 p-1 flex items-center justify-center my-auto shadow-2xl">
        <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
          {/* SVG Dial Arc Ticks & Text */}
          <svg width="150" height="150" viewBox="0 0 150 150" className="absolute inset-0">
            {/* Blue (Cold) Arc (-135deg to 0deg) */}
            <path d="M 36 114 A 55 55 0 0 1 75 20" fill="none" stroke="#93c5fd" strokeWidth="12" opacity="0.8" />
            {/* Red (Hot) Arc (0deg to +135deg) */}
            <path d="M 75 20 A 55 55 0 0 1 114 114" fill="none" stroke="#fca5a5" strokeWidth="12" opacity="0.8" />

            {/* Scale Tick Marks */}
            {Array.from({ length: 31 }).map((_, i) => {
              const angle = -135 + (i / 30) * 270
              const isMajor = i % 5 === 0
              return (
                <line
                  key={i}
                  x1="75"
                  y1="20"
                  x2="75"
                  y2={isMajor ? "28" : "24"}
                  stroke={isMajor ? "#475569" : "#94a3b8"}
                  strokeWidth={isMajor ? "2" : "1"}
                  transform={`rotate(${angle} 75 75)`}
                />
              )
            })}

            {/* Polar Computed Numbers */}
            {scaleValues.map((val, idx) => {
              const angleDeg = -135 + (idx / (scaleValues.length - 1)) * 270
              const rad = (angleDeg - 90) * (Math.PI / 180)
              const rNum = 42
              const x = 75 + rNum * Math.cos(rad)
              const y = 75 + rNum * Math.sin(rad) + 3

              return (
                <text
                  key={val}
                  x={x}
                  y={y}
                  fontSize="7.5"
                  fontWeight="bold"
                  fill="#475569"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {val}
                </text>
              )
            })}

            {/* Unit Label */}
            {unit && (
              <text x="75" y="60" fontSize="8" fontWeight="bold" fill="#64748b" textAnchor="middle">
                {unit}
              </text>
            )}
          </svg>

          {/* Needle */}
          <div
            style={{ transform: `rotate(${needleAngle}deg)` }}
            className="absolute w-1.5 h-14 bg-gradient-to-t from-red-600 to-rose-500 origin-bottom bottom-1/2 rounded-t-full transition-transform duration-500 ease-out z-20 shadow-md"
          />
          {/* Pivot Cap */}
          <div className="absolute w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-md z-30" />

          {/* LCD Readout Box */}
          <div className="absolute bottom-2 bg-slate-100 border border-slate-300 px-2.5 py-0.5 z-30 shadow-inner">
            <span className="text-xs font-mono font-bold text-slate-800">
              {numVal.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
