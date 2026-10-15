import React from 'react'

export default function AnalogueCompassMeter({ value = 35 }) {
  const numVal = Number(value) || 0
  const clampedAngle = (numVal * 3.6) % 360 // Convert 0-100 percentage to 0-360 degrees

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Dark Compass Face */}
      <div className="relative w-48 h-48 rounded-full bg-slate-900 border-4 border-slate-800 p-1 flex items-center justify-center my-auto shadow-2xl">
        <div className="relative w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Compass Rose & Cardinal Ticks SVG */}
          <svg width="150" height="150" viewBox="0 0 150 150" className="absolute inset-0">
            {/* Compass Outer Ticks */}
            {Array.from({ length: 48 }).map((_, i) => {
              const rot = (i / 48) * 360
              return (
                <line
                  key={i}
                  x1="75"
                  y1="8"
                  x2="75"
                  y2={i % 6 === 0 ? "16" : "12"}
                  stroke={i % 6 === 0 ? "#cbd5e1" : "#475569"}
                  strokeWidth={i % 6 === 0 ? "2" : "1"}
                  transform={`rotate(${rot} 75 75)`}
                />
              )
            })}

            {/* Cardinal Direction Texts */}
            <text x="71" y="24" fontSize="10" fontWeight="extrabold" fill="#ffffff">N</text>
            <text x="126" y="79" fontSize="10" fontWeight="extrabold" fill="#cbd5e1">E</text>
            <text x="72" y="134" fontSize="10" fontWeight="extrabold" fill="#cbd5e1">S</text>
            <text x="16" y="79" fontSize="10" fontWeight="extrabold" fill="#cbd5e1">W</text>

            <text x="106" y="42" fontSize="7" fontWeight="bold" fill="#64748b">NE</text>
            <text x="106" y="115" fontSize="7" fontWeight="bold" fill="#64748b">SE</text>
            <text x="32" y="115" fontSize="7" fontWeight="bold" fill="#64748b">SW</text>
            <text x="32" y="42" fontSize="7" fontWeight="bold" fill="#64748b">NW</text>
          </svg>

          {/* Rotating Compass Pointer Needle */}
          <div
            style={{ transform: `rotate(${clampedAngle}deg)` }}
            className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out z-20 pointer-events-none"
          >
            {/* North Red Pointer */}
            <div className="w-1.5 h-16 bg-gradient-to-t from-transparent to-rose-500 origin-bottom bottom-1/2 absolute rounded-t-full shadow-[0_0_8px_#f43f5e]" />
            {/* South White Pointer */}
            <div className="w-1.5 h-16 bg-gradient-to-b from-transparent to-slate-300 origin-top top-1/2 absolute rounded-b-full opacity-60" />
          </div>

          {/* Center Cap */}
          <div className="absolute w-4 h-4 rounded-full bg-white border-2 border-slate-900 shadow-md z-30" />
        </div>
      </div>
    </div>
  )
}
