import React from 'react'

export default function AnalogueThermometerScaleMeter({ value = 20, min = -60, max = 100, unit = '', label = 'Thermometer scale' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  const ticks = [-60, -40, -20, 0, 20, 40, 60, 80, 100]

  return (
    <div className="w-full h-full flex flex-col items-center justify-center my-auto p-4 max-w-xl mx-auto">
      {/* Label Sub-header */}
      <div className="text-xs font-semibold text-slate-300 mb-2 font-sans tracking-wide">
        Temperature, {unit}
      </div>

      {/* Main Thermometer Scale Assembly */}
      <div className="w-full space-y-2 flex flex-col items-center">
        {/* Top Scale Numbers */}
        <div className="w-full flex justify-between text-xs font-mono font-bold text-slate-300 px-1">
          {ticks.map((t) => (
            <span key={t} className="w-7 text-center">{t}</span>
          ))}
        </div>

        {/* Dual Scale Bar Graphic */}
        <div className="w-full space-y-1">
          {/* Top Blue-to-Red Colored Scale Bar */}
          <div className="w-full h-4 bg-gradient-to-r from-sky-400 via-slate-300 to-rose-500 rounded-sm border border-slate-700/80 relative flex items-center shadow-inner">
            {/* Center Zero Line */}
            <div className="absolute left-[37.5%] inset-y-0 w-0.5 bg-slate-800 z-10" />
          </div>

          {/* Bulb and Liquid Fill Bar */}
          <div className="w-full flex items-center">
            {/* Bulb */}
            <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-sky-400 -mr-1 z-20 flex items-center justify-center shadow-md shrink-0">
              <div className="w-4 h-4 rounded-full bg-sky-400 animate-pulse" />
            </div>

            {/* Horizontal Glass Tube */}
            <div className="flex-1 h-5 bg-slate-900 border border-slate-700 rounded-r relative overflow-hidden shadow-inner">
              {/* Liquid Fill */}
              <div
                style={{ width: `${percentage * 100}%` }}
                className={`h-full transition-all duration-500 ${
                  numVal >= 0 ? 'bg-rose-500' : 'bg-sky-400'
                }`}
              />
              {/* Indicator Pin */}
              <div
                style={{ left: `${percentage * 100}%` }}
                className="absolute inset-y-0 w-1 bg-white transform -translate-x-1/2 z-30 shadow-md"
              />
            </div>
          </div>

          {/* Bottom Mirror Scale Bar */}
          <div className="w-full h-4 bg-gradient-to-r from-sky-400 via-slate-300 to-rose-500 rounded-sm border border-slate-700/80 relative flex items-center shadow-inner">
            <div className="absolute left-[37.5%] inset-y-0 w-0.5 bg-slate-800 z-10" />
          </div>
        </div>

        {/* Bottom Scale Numbers */}
        <div className="w-full flex justify-between text-xs font-mono font-bold text-slate-300 px-1">
          {ticks.map((t) => (
            <span key={t} className="w-7 text-center">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
