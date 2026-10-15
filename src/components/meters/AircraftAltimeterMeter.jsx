import React from 'react'

export default function AircraftAltimeterMeter({ value = 4500, min = 0, max = 10000, unit = '', label = 'Aircraft Altimeter' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)

  // 100s needle angle (1000 feet per 360deg rotation)
  const angle100 = (clamped % 1000) * (360 / 1000)
  // 1000s needle angle (10000 feet per 360deg rotation)
  const angle1000 = (clamped % 10000) * (360 / 10000)

  const altNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  return (
    <div className="bg-zinc-950 border-4 border-zinc-800 p-4 shadow-2xl flex flex-col items-center justify-between min-h-[260px] rounded-none text-slate-100 relative overflow-hidden">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-2 mb-1">
        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider truncate">{label}</span>
        <span className="text-[9px] font-mono font-bold text-amber-400 bg-zinc-900 px-2 py-0.5 border border-zinc-700">ALT-AV3</span>
      </div>

      {/* Cockpit Altimeter Dial */}
      <div className="relative w-44 h-44 rounded-full bg-black border-4 border-zinc-800 p-1 flex items-center justify-center my-auto shadow-2xl">
        <div className="relative w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
          {/* Dial Face Numbers & Markings */}
          <svg width="150" height="150" viewBox="0 0 150 150" className="absolute inset-0">
            {/* 50 Tick Marks around 360deg */}
            {Array.from({ length: 50 }).map((_, i) => {
              const rot = i * (360 / 50)
              const isMajor = i % 5 === 0
              return (
                <line
                  key={i}
                  x1="75"
                  y1="12"
                  x2="75"
                  y2={isMajor ? "22" : "17"}
                  stroke="#ffffff"
                  strokeWidth={isMajor ? "2" : "1"}
                  transform={`rotate(${rot} 75 75)`}
                />
              )
            })}

            {/* Polar Numbers 0..9 */}
            {altNumbers.map((val, idx) => {
              const angleDeg = idx * 36
              const rad = (angleDeg - 90) * (Math.PI / 180)
              const rNum = 42
              const x = 75 + rNum * Math.cos(rad)
              const y = 75 + rNum * Math.sin(rad) + 2.5

              return (
                <text
                  key={val}
                  x={x}
                  y={y}
                  fontSize="9"
                  fontWeight="extrabold"
                  fill="#ffffff"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {val}
                </text>
              )
            })}

            <text x="75" y="58" fontSize="7" fontWeight="bold" fill="#94a3b8" textAnchor="middle">
              ALTITUDE
            </text>
            <text x="75" y="98" fontSize="7" fontWeight="bold" fill="#94a3b8" textAnchor="middle">
              {unit}
            </text>
          </svg>

          {/* 1000s Pointer Hand (Shorter, Thick White) */}
          <div
            style={{ transform: `rotate(${angle1000}deg)` }}
            className="absolute w-2 h-11 bg-white origin-bottom bottom-1/2 rounded-t-sm z-20 shadow-md"
          />

          {/* 100s Pointer Hand (Longer, Thin Amber) */}
          <div
            style={{ transform: `rotate(${angle100}deg)` }}
            className="absolute w-1 h-16 bg-amber-400 origin-bottom bottom-1/2 rounded-t-full z-25 shadow-md"
          />

          {/* Center Pivot Cap */}
          <div className="absolute w-4 h-4 rounded-full bg-zinc-800 border-2 border-white z-30 shadow-md" />

          {/* Pressure Window Box */}
          <div className="absolute bottom-2 bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 z-30 shadow-inner">
            <span className="text-[11px] font-mono font-bold text-amber-400">
              {Math.round(clamped)} FT
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
