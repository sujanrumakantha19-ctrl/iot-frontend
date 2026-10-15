import React from 'react'

export default function VerticalBarWithIdleMeter({
  tag,
  value,
  min = -140,
  max = 140,
  idle = 0,
  color = '#22c55e',
  unit
}) {
  const displayUnit = unit || tag?.unit || ''

  const numMax = Number(max)
  let numIdle = Number(idle)
  let numMin = Number(min)

  // Guarantee MIN < IDLE < MAX so that IDLE and MIN are NEVER the same value!
  if (numIdle <= numMin) {
    if (numIdle === 0 && numMin === 0) {
      numMin = -Math.abs(numMax) || -100
    } else {
      numMin = numIdle - Math.max(10, (numMax - numIdle))
    }
  }

  const hasValue = value !== null && value !== undefined && value !== '' && !isNaN(Number(value))
  const numVal = hasValue ? Number(value) : null

  // IDLE line is visually centered at 50% height
  let barBottomPct = 50
  let barHeightPct = 0
  let isBelowIdle = false

  if (numVal !== null) {
    if (numVal > numIdle) {
      const rangeAbove = (numMax - numIdle) || 1
      const clampedVal = Math.min(numMax, numVal)
      const ratio = (clampedVal - numIdle) / rangeAbove
      barBottomPct = 50
      barHeightPct = Math.max(0, Math.min(50, ratio * 50))
      isBelowIdle = false
    } else if (numVal < numIdle) {
      const rangeBelow = (numIdle - numMin) || 1
      const clampedVal = Math.max(numMin, numVal)
      const ratio = (numIdle - clampedVal) / rangeBelow
      const valPct = 50 - Math.max(0, Math.min(50, ratio * 50))
      barBottomPct = valPct
      barHeightPct = 50 - valPct
      isBelowIdle = true
    }
  }

  const fillColor = isBelowIdle ? '#ef4444' : (color || '#22c55e')

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
          <span style={{ color: '#38bdf8' }}>{numIdle}</span>
          <span>{numMin}</span>
        </div>

        {/* Center: Vertical Bar Track */}
        <div className="relative w-10 h-full bg-[#0b1525] border border-slate-700/60 rounded-lg overflow-hidden shadow-inner mx-1">
          {/* Filled bar — grows UP or DOWN from IDLE line */}
          <div
            style={{
              position: 'absolute',
              bottom: `${barBottomPct}%`,
              height: `${barHeightPct}%`,
              left: 0,
              right: 0,
              backgroundColor: fillColor,
              transition: 'all 0.35s ease'
            }}
          />

          {/* White glowing IDLE line at 50% */}
          <div
            style={{
              position: 'absolute',
              bottom: '50%',
              left: 0,
              right: 0,
              height: '3px',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 10px #ffffff, 0 0 4px #ffffff',
              zIndex: 20
            }}
          />
        </div>

        {/* Right Scale: Text Labels */}
        <div className="flex flex-col justify-between text-[9px] font-mono font-bold text-slate-500 text-left shrink-0 w-7 py-1 select-none">
          <span>MAX</span>
          <span className="text-amber-400 tracking-wider">IDLE</span>
          <span>MIN</span>
        </div>
      </div>
    </div>
  )
}
