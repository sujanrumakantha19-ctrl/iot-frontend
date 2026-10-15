import React from 'react'

export default function RetroVUMeter({ value = -9.0, min = -20, max = 3, unit = '', label = 'Vintage VU Meter' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  // Sweep -40deg to +40deg (80deg sweep)
  const needleAngle = -40 + percentage * 80

  const vuScale = [
    { text: '-20', val: -20, isRed: false },
    { text: '-10', val: -10, isRed: false },
    { text: '-5', val: -5, isRed: false },
    { text: '0', val: 0, isRed: false },
    { text: '+1', val: 1, isRed: true },
    { text: '+2', val: 2, isRed: true },
    { text: '+3', val: 3, isRed: true }
  ]

  // Polar calculations for SVG path points centered at (120, 135) with radius 95
  const getPoint = (deg, r = 95) => {
    const rad = (deg - 90) * (Math.PI / 180)
    return {
      x: 120 + r * Math.cos(rad),
      y: 135 + r * Math.sin(rad)
    }
  }

  // Black arc: -40deg to +16deg
  const pStart = getPoint(-40)
  const pZero = getPoint(16)
  // Red arc: +16deg to +40deg
  const pEnd = getPoint(40)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center my-auto">
      {/* Warm Incandescent Cream Dial Panel */}
      <div className="relative w-64 h-44 bg-[#fffbeb] border border-amber-900/30 p-2 flex flex-col items-center justify-between my-auto shadow-inner overflow-hidden rounded-md shrink-0">
        {/* Arc Scale & Markings SVG */}
        <svg width="240" height="140" viewBox="0 0 240 140" className="absolute inset-0 mx-auto">
          {/* Normal Black Arc (-40deg to +16deg) */}
          <path
            d={`M ${pStart.x.toFixed(1)} ${pStart.y.toFixed(1)} A 95 95 0 0 1 ${pZero.x.toFixed(1)} ${pZero.y.toFixed(1)}`}
            fill="none"
            stroke="#27272a"
            strokeWidth="2.5"
          />
          {/* Overload Red Arc (+16deg to +40deg) */}
          <path
            d={`M ${pZero.x.toFixed(1)} ${pZero.y.toFixed(1)} A 95 95 0 0 1 ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)}`}
            fill="none"
            stroke="#dc2626"
            strokeWidth="4.5"
          />

          {/* Scale Tick Marks and Numbers */}
          {vuScale.map((s) => {
            const pct = (s.val - min) / (max - min)
            const deg = -40 + pct * 80
            const pInner = getPoint(deg, 90)
            const pOuter = getPoint(deg, 98)
            const pText = getPoint(deg, 112)

            return (
              <g key={s.text}>
                {/* Tick Line */}
                <line
                  x1={pInner.x}
                  y1={pInner.y}
                  x2={pOuter.x}
                  y2={pOuter.y}
                  stroke={s.isRed ? '#dc2626' : '#27272a'}
                  strokeWidth="2"
                />
                {/* Scale Number Text outside arc */}
                <text
                  x={pText.x}
                  y={pText.y}
                  fontSize="9.5"
                  fontWeight="bold"
                  fontStyle="italic"
                  fill={s.isRed ? '#dc2626' : '#27272a'}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {s.text}
                </text>
              </g>
            )
          })}

          {/* VU Label placed nicely inside the arc */}
          <text x="120" y="82" fontSize="12" fontWeight="black" fill="#78350f" textAnchor="middle">
            VU
          </text>
          <text x="120" y="96" fontSize="8.5" fontWeight="bold" fill="#92400e" textAnchor="middle">
            {unit}
          </text>
        </svg>

        {/* Pivoting Needle originating from (120, 135) */}
        <div className="absolute bottom-[9px] inset-x-0 flex justify-center items-center pointer-events-none z-20">
          <div
            style={{ transform: `rotate(${needleAngle}deg)` }}
            className="w-0.5 h-[98px] bg-zinc-900 origin-bottom transition-transform duration-500 ease-out shadow-sm"
          />
        </div>

        {/* Pivot Center Cap */}
        <div className="absolute bottom-[2px] w-7 h-7 rounded-full bg-zinc-900 border-2 border-amber-700 z-30 shadow-md" />

        {/* Digital Readout Badge */}
        <div className="absolute bottom-2 right-2 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 z-30 shadow-sm">
          <span className="text-xs font-mono font-bold text-amber-950">
            {numVal >= 0 ? `+${numVal.toFixed(1)}` : numVal.toFixed(1)} {unit}
          </span>
        </div>
      </div>
    </div>
  )
}
