import React from 'react'

export default function VerticalBarNormalMeter({
  tag,
  value,
  min = 0,
  max = 100,
  color = '#22c55e',
  unit
}) {
  const displayUnit = unit || tag?.unit || ''

  const numMin = Number(min)
  const numMax = Number(max)
  const range = (numMax - numMin) || 1

  const hasValue = value !== null && value !== undefined && value !== '' && !isNaN(Number(value))
  const numVal = hasValue ? Number(value) : null

  let fillPct = 0
  if (numVal !== null) {
    const clampedVal = Math.max(numMin, Math.min(numMax, numVal))
    fillPct = Math.max(0, Math.min(100, ((clampedVal - numMin) / range) * 100))
  }

  const midVal = Math.round((numMax + numMin) / 2)

  return (
    <div className="w-full h-full flex flex-col items-center justify-between p-1.5 select-none overflow-hidden flex-1 min-h-0">
      {/* Centered Digital Readout */}
      <div className="text-xl font-black font-mono tracking-tight text-center shrink-0" style={{ color: color || '#22c55e' }}>
        {hasValue ? `${numVal.toFixed(2)}${displayUnit ? ` ${displayUnit}` : ''}` : 'N/A'}
      </div>

      {/* Horizontal Divider */}
      <div className="w-full border-t border-slate-700/40 my-1.5 shrink-0" />

      {/* Centered Narrow Dark Pill Box Panel — Fills card height */}
      <div className="w-[140px] max-w-full flex-1 h-full min-h-0 bg-[#050c18] rounded-2xl border border-slate-800/80 p-3 flex items-stretch justify-between relative overflow-hidden shadow-lg mx-auto">
        {/* Left Scale: Numeric Values */}
        <div className="flex flex-col justify-between text-[11px] font-mono font-bold text-slate-400 text-right shrink-0 w-7 py-1 select-none">
          <span>{numMax}</span>
          <span>{midVal}</span>
          <span>{numMin}</span>
        </div>

        {/* Center: Vertical Bar Track */}
        <div className="relative w-10 h-full bg-[#0b1525] border border-slate-700/60 rounded-lg overflow-hidden shadow-inner mx-1">
          {/* Filled bar — grows UP from MIN at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              height: `${fillPct}%`,
              left: 0,
              right: 0,
              backgroundColor: color || '#22c55e',
              transition: 'height 0.35s ease'
            }}
          />

          {/* Top edge indicator line */}
          {fillPct > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: `${fillPct}%`,
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#ffffff',
                boxShadow: '0 0 8px #ffffff',
                zIndex: 20
              }}
            />
          )}
        </div>

        {/* Right Scale: Text Labels */}
        <div className="flex flex-col justify-between text-[9px] font-mono font-bold text-slate-500 text-left shrink-0 w-7 py-1 select-none">
          <span>MAX</span>
          <span>MID</span>
          <span>MIN</span>
        </div>
      </div>
    </div>
  )
}
