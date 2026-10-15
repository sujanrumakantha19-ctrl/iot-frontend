import React from 'react'

export default function SubmarineDepthGaugeMeter({ value = 420, min = 0, max = 600, unit = '', label = 'Submarine Depth Gauge' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  // Sweep -135deg to +135deg (270deg sweep)
  const needleAngle = -135 + percentage * 270

  const scaleValues = [0, 100, 200, 300, 400, 500, 600]

  return (
    <div className="w-full h-full flex flex-col items-center justify-center my-auto">
      {/* Round Navy & Brass Dial */}
      <div className="relative w-44 h-44 rounded-full bg-slate-950 border-4 border-amber-600/90 p-1 flex items-center justify-center my-auto shadow-2xl shrink-0">
        <div className="relative w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
          {/* SVG Dial Arc Ticks */}
          <svg width="150" height="150" viewBox="0 0 150 150" className="absolute inset-0">
            {/* Red Crush Danger Arc */}
            <path d="M 100 28 A 55 55 0 0 1 114 114" fill="none" stroke="#ef4444" strokeWidth="8" opacity="0.8" />

            {/* Radial Ticks */}
            {Array.from({ length: 31 }).map((_, i) => {
              const angle = -135 + (i / 30) * 270
              const isMajor = i % 5 === 0
              return (
                <line
                  key={i}
                  x1="75"
                  y1="20"
                  x2="75"
                  y2={isMajor ? "27" : "24"}
                  stroke={isMajor ? "#f59e0b" : "#64748b"}
                  strokeWidth={isMajor ? "2" : "1"}
                  transform={`rotate(${angle} 75 75)`}
                />
              )
            })}

            {/* Polar Computed Numbers */}
            {scaleValues.map((val, idx) => {
              const angleDeg = -135 + (idx / (scaleValues.length - 1)) * 270
              const rad = (angleDeg - 90) * (Math.PI / 180)
              const rNum = 41
              const x = 75 + rNum * Math.cos(rad)
              const y = 75 + rNum * Math.sin(rad) + 2.5

              return (
                <text
                  key={val}
                  x={x}
                  y={y}
                  fontSize="7.5"
                  fontWeight="bold"
                  fill={val >= 500 ? '#f87171' : '#f59e0b'}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {val}
                </text>
              )
            })}

            {/* Label Titles */}
            <text x="75" y="58" fontSize="8" fontWeight="bold" fill="#f59e0b" textAnchor="middle">
              DEPTH
            </text>
            <text x="75" y="98" fontSize="7.5" fontWeight="bold" fill="#94a3b8" textAnchor="middle">
              {unit}
            </text>
          </svg>

          {/* Brass Needle */}
          <div
            style={{ transform: `rotate(${needleAngle}deg)` }}
            className="absolute w-1.5 h-14 bg-gradient-to-t from-amber-600 via-yellow-500 to-amber-400 origin-bottom bottom-1/2 rounded-t-full transition-transform duration-500 ease-out z-20 shadow-lg"
          />
          {/* Center Brass Cap */}
          <div className="absolute w-4 h-4 rounded-full bg-amber-600 border-2 border-slate-900 shadow-md z-30" />

          {/* LCD Box at Bottom */}
          <div className="absolute bottom-2 bg-slate-950 border border-amber-600/60 px-2.5 py-0.5 z-30 shadow-inner">
            <span className="text-xs font-mono font-bold text-amber-400">
              {Math.round(numVal)}m
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
