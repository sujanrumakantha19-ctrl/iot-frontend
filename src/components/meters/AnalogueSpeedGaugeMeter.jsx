import React from 'react'

export default function AnalogueSpeedGaugeMeter({ value = 130, min = 0, max = 180, unit = '' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  // Sweep from -120deg to +120deg (240deg total)
  const needleAngle = -120 + percentage * 240

  const speedNumbers = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180]

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Speedometer Dial */}
      <div className="relative w-44 h-44 rounded-full bg-slate-100 border-4 border-slate-300 p-1 flex items-center justify-center my-auto shadow-2xl">
        <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
          {/* Yellow/Orange Speed Band Arc */}
          <svg width="150" height="150" viewBox="0 0 150 150" className="absolute inset-0">
            {/* Yellow Low Speed Arc */}
            <path d="M 28 102 A 55 55 0 0 1 122 102" fill="none" stroke="#fef08a" strokeWidth="8" />
            {/* Orange High Speed Arc */}
            <path d="M 85 22 A 55 55 0 0 1 122 102" fill="none" stroke="#f97316" strokeWidth="8" opacity="0.9" />

            {/* Dial Ticks */}
            {Array.from({ length: 37 }).map((_, i) => {
              const angle = -120 + (i / 36) * 240
              const isMajor = i % 4 === 0
              return (
                <line
                  key={i}
                  x1="75"
                  y1="20"
                  x2="75"
                  y2={isMajor ? "27" : "24"}
                  stroke={isMajor ? "#334155" : "#94a3b8"}
                  strokeWidth={isMajor ? "2" : "1"}
                  transform={`rotate(${angle} 75 75)`}
                />
              )
            })}

            {/* Polar Computed Numbers */}
            {speedNumbers.map((val, idx) => {
              const angleDeg = -120 + (idx / (speedNumbers.length - 1)) * 240
              const rad = (angleDeg - 90) * (Math.PI / 180)
              const rNum = 35
              const x = 75 + rNum * Math.cos(rad)
              const y = 75 + rNum * Math.sin(rad) + 2.5

              return (
                <text
                  key={val}
                  x={x}
                  y={y}
                  fontSize="7.5"
                  fontWeight="bold"
                  fill="#334155"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {val}
                </text>
              )
            })}

            {/* Unit Label */}
            {unit && (
              <text x="75" y="100" fontSize="8" fontWeight="bold" fill="#64748b" textAnchor="middle">
                {unit}
              </text>
            )}
          </svg>

          {/* Needle */}
          <div
            style={{ transform: `rotate(${needleAngle}deg)` }}
            className="absolute w-1.5 h-14 bg-gradient-to-t from-orange-600 to-orange-500 origin-bottom bottom-1/2 rounded-t-full transition-transform duration-500 ease-out z-20 shadow-md"
          />
          {/* Center Pivot Cap */}
          <div className="absolute w-4 h-4 rounded-full bg-slate-100 border-2 border-orange-600 shadow-md z-30" />

          {/* LCD Readout Box at Bottom */}
          <div className="absolute bottom-2 bg-slate-100 border border-slate-300 px-2.5 py-0.5 z-30 shadow-inner">
            <span className="text-xs font-mono font-bold text-slate-800">
              {Math.round(numVal).toString().padStart(3, '0')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
