import React from 'react'

export default function LinearThermometerVerticalMeter({ value = 42, min = -20, max = 100, unit = '', label = 'Vertical Glass Thermometer' }) {
  const numVal = Number(value) || 0
  const clamped = Math.min(Math.max(numVal, min), max)
  const percentage = (clamped - min) / (max - min || 1)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center my-auto">
      {/* Main Glass Tube & Scale Ticks */}
      <div className="my-auto flex items-center gap-6 justify-center w-full">
        {/* Left Scale Marks */}
        <div className="flex flex-col justify-between h-36 text-[10px] font-mono font-bold text-slate-400 text-right">
          <span>100°</span>
          <span>75°</span>
          <span>50°</span>
          <span>25°</span>
          <span>0°</span>
          <span>-20°</span>
        </div>

        {/* Vertical Thermometer Assembly */}
        <div className="flex flex-col items-center">
          {/* Glass Column Tube */}
          <div className="w-6 h-36 bg-slate-900 border-2 border-slate-700 rounded-t-full relative overflow-hidden shadow-inner flex flex-col justify-end">
            {/* Red Mercury Liquid Fill */}
            <div
              style={{ height: `${percentage * 100}%` }}
              className="w-full bg-gradient-to-t from-rose-600 to-rose-500 transition-all duration-500 relative"
            >
              {/* Glass Reflection Line */}
              <div className="absolute inset-y-0 left-1 w-1 bg-white/40" />
            </div>
          </div>

          {/* Bottom Mercury Bulb */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 border-2 border-slate-700 -mt-2 shadow-md flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white/40" />
          </div>
        </div>

        {/* Right Digital Readout */}
        <div className="flex flex-col items-start justify-center">
          <span className="text-2xl font-mono font-extrabold text-white tracking-tight">
            {numVal.toFixed(1)}
          </span>
          <span className="text-xs font-bold text-rose-400 tracking-wider">
            {unit}
          </span>
        </div>
      </div>
    </div>
  )
}
