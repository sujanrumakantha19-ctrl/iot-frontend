import './MotorDigitalTwin2D.css'

function getSlotStatus(value, thresholds = {}) {
  if (value == null || Number.isNaN(value)) return 'normal'
  const { warningThreshold, criticalThreshold } = thresholds
  if (criticalThreshold != null && value >= criticalThreshold) return 'critical'
  if (warningThreshold != null && value >= warningThreshold) return 'warning'
  return 'normal'
}

function worstStatus(...statuses) {
  if (statuses.includes('critical')) return 'critical'
  if (statuses.includes('warning')) return 'warning'
  return 'normal'
}

function formatValue(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(digits)
}

function BearingCard({
  side,
  title,
  sub,
  vib,
  temp,
  vibLabel,
  tempLabel,
  vibUnit = 'mm/s',
  tempUnit = '°C',
  previewMode,
  vibThresholds,
  tempThresholds,
  className
}) {
  const vibStatus = previewMode ? 'normal' : getSlotStatus(vib, vibThresholds)
  const tempStatus = previewMode ? 'normal' : getSlotStatus(temp, tempThresholds)
  const cardStatus = previewMode ? 'normal' : worstStatus(vibStatus, tempStatus)

  return (
    <div className={`telemetry-card ${className} status-${cardStatus}`}>
      <div className="card-header">
        <div className="min-w-0">
          <div className="card-title">{title}</div>
          <div className="card-sub">{sub}</div>
        </div>
        <div className="sensor-status-dot" />
      </div>
      <div className="metric-row">
        <span className="metric-label" title={vibLabel}>{vibLabel}</span>
        <span className={`metric-value status-${vibStatus} ${previewMode ? 'text-slate-400 italic font-semibold' : ''}`}>
          {previewMode ? '—' : formatValue(vib, 2)}
          {!previewMode && vib != null && vibUnit && <span className="metric-unit"> {vibUnit}</span>}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label" title={tempLabel}>{tempLabel}</span>
        <span className={`metric-value status-${tempStatus} ${previewMode ? 'text-slate-400 italic font-semibold' : ''}`}>
          {previewMode ? '—' : formatValue(temp, 1)}
          {!previewMode && temp != null && tempUnit && <span className="metric-unit"> {tempUnit}</span>}
        </span>
      </div>
      {side === 'DE' && <span className="sr-only">{side}</span>}
    </div>
  )
}

function slotLabel(slots, key, fallback) {
  return slots?.find(s => s.key === key)?.label || fallback
}

export default function MotorDigitalTwin2D({
  title = 'SIEMENS 3-Phase Induction Motor',
  values = {},
  thresholds = {},
  compact = false,
  miniPreview = false,
  showHeader = true,
  showFooter = true,
  previewMode = false,
  bindingLabels = {},
  bindingUnits = {},
  slotLabels = []
}) {
  const deVib = values.deVib ?? null
  const deTemp = values.deTemp ?? null
  const ndeVib = values.ndeVib ?? null
  const ndeTemp = values.ndeTemp ?? null
  const rpm = values.rpm ?? null
  const current = values.current ?? null

  const overallStatus = previewMode ? 'normal' : worstStatus(
    getSlotStatus(deVib, thresholds.deVib),
    getSlotStatus(deTemp, thresholds.deTemp),
    getSlotStatus(ndeVib, thresholds.ndeVib),
    getSlotStatus(ndeTemp, thresholds.ndeTemp)
  )

  const healthPct = previewMode ? '—' : (overallStatus === 'critical' ? 72.4 : overallStatus === 'warning' ? 88.2 : 98.5)

  // Prefer assigned tag label (displayName / P1 / topic); fall back to slot role name
  const labelFor = (key, fallback) => {
    if (bindingLabels[key]) return bindingLabels[key]
    if (previewMode) return fallback
    return slotLabel(slotLabels, key, fallback)
  }

  const unitFor = (key, fallback) => bindingUnits[key] || fallback

  const deVibLabel = labelFor('deVib', 'DE Vibration')
  const deTempLabel = labelFor('deTemp', 'DE Bearing Temp')
  const ndeVibLabel = labelFor('ndeVib', 'NDE Vibration')
  const ndeTempLabel = labelFor('ndeTemp', 'NDE Bearing Temp')
  const rpmLabel = labelFor('rpm', 'Motor Speed')
  const currentLabel = labelFor('current', 'Supply Current')

  const deVibUnit = unitFor('deVib', 'mm/s')
  const deTempUnit = unitFor('deTemp', '°C')
  const ndeVibUnit = unitFor('ndeVib', 'mm/s')
  const ndeTempUnit = unitFor('ndeTemp', '°C')
  const rpmUnit = unitFor('rpm', 'RPM')
  const currentUnit = unitFor('current', 'A')

  return (
    <div className={`motor-twin-root ${compact ? 'compact' : ''} ${miniPreview ? 'mini-preview' : ''}`}>
      {showHeader && (
        <div className="motor-twin-header">
          <div className="flex items-center gap-3">
            <span className="motor-twin-badge">{previewMode ? 'Template Preview' : 'Live 2D Digital Twin'}</span>
            <h2 className="motor-twin-title">{title}</h2>
          </div>
        </div>
      )}

      {miniPreview && slotLabels.length > 0 && (
        <div className="motor-twin-binding-bar">
          {slotLabels.map((slot) => (
            <div key={slot.key} className={`binding-chip ${bindingLabels[slot.key] ? 'mapped' : ''}`}>
              <span className="binding-slot">{slot.label}</span>
              <span className="binding-tag">{bindingLabels[slot.key] || '—'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="motor-twin-viewport">
        <div className="motor-twin-grid" />

        {!miniPreview && (
        <BearingCard
          side="DE"
          title="Front Bearing (DE)"
          sub="Drive End Housing"
          vib={deVib}
          temp={deTemp}
          vibLabel={deVibLabel}
          tempLabel={deTempLabel}
          vibUnit={deVibUnit}
          tempUnit={deTempUnit}
          previewMode={previewMode}
          vibThresholds={thresholds.deVib}
          tempThresholds={thresholds.deTemp}
          className="card-de"
        />
        )}

        {!miniPreview && (
        <BearingCard
          side="NDE"
          title="Rear Bearing (NDE)"
          sub="Non-Drive Fan End"
          vib={ndeVib}
          temp={ndeTemp}
          vibLabel={ndeVibLabel}
          tempLabel={ndeTempLabel}
          vibUnit={ndeVibUnit}
          tempUnit={ndeTempUnit}
          previewMode={previewMode}
          vibThresholds={thresholds.ndeVib}
          tempThresholds={thresholds.ndeTemp}
          className="card-nde"
        />
        )}

        <svg className="motor-svg" viewBox="0 0 1000 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="metalDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="metalBody" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="25%" stopColor="#64748b" />
              <stop offset="60%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="finGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="50%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="shaftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="30%" stopColor="#cbd5e1" />
              <stop offset="70%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="fanCowlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="50%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <ellipse cx="480" cy="485" rx="380" ry="25" fill="#0f172a" opacity="0.15" />

          <g>
            <path d="M 310 420 L 330 470 L 410 470 L 390 420 Z" fill="url(#metalDark)" stroke="#1e293b" strokeWidth="2" />
            <circle cx="370" cy="455" r="7" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
            <path d="M 570 420 L 590 470 L 670 470 L 650 420 Z" fill="url(#metalDark)" stroke="#1e293b" strokeWidth="2" />
            <circle cx="630" cy="455" r="7" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
          </g>

          <g>
            <rect x="290" y="200" width="370" height="230" rx="16" fill="url(#metalBody)" stroke="#334155" strokeWidth="2.5" />
            {[215, 235, 255, 275, 295, 315, 335, 355, 375, 395].map(y => (
              <rect key={y} x="295" y={y} width="360" height="8" rx="3" fill="url(#finGradient)" stroke="#475569" />
            ))}
            <rect x="420" y="270" width="100" height="45" rx="4" fill="#ffffff" stroke="#64748b" strokeWidth="1.5" />
            <text x="470" y="288" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="900" fill="#0284c7" textAnchor="middle">SIEMENS</text>
            <text x="470" y="304" fontFamily="monospace" fontSize="8" fontWeight="700" fill="#475569" textAnchor="middle">3~MOT 45kW</text>
          </g>

          <g>
            <path d="M 360 110 L 520 110 L 535 200 L 345 200 Z" fill="url(#metalDark)" stroke="#1e293b" strokeWidth="2" />
            <rect x="400" y="145" width="28" height="30" rx="4" fill="#f8fafc" stroke="#0284c7" strokeWidth="1.5" />
            <rect x="450" y="145" width="28" height="30" rx="4" fill="#f8fafc" stroke="#0284c7" strokeWidth="1.5" />
          </g>

          <g>
            <path d="M 290 200 C 230 230, 230 400, 290 430 Z" fill="url(#metalDark)" stroke="#1e293b" strokeWidth="2.5" />
            <circle cx="270" cy="315" r="65" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="8 6" />
            <circle cx="270" cy="315" r="40" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="270" cy="315" r="24" fill="#f8fafc" stroke="#0284c7" strokeWidth="2" />
          </g>

          <g>
            <rect x="110" y="295" width="145" height="40" rx="5" fill="url(#shaftGrad)" stroke="#334155" strokeWidth="2" />
            <rect x="130" y="297" width="70" height="6" rx="2" fill="#334155" />
          </g>

          <g>
            <rect x="660" y="210" width="130" height="210" rx="14" fill="url(#fanCowlGrad)" stroke="#334155" strokeWidth="2" />
            <path d="M 780 215 C 810 240, 810 390, 780 415 Z" fill="#334155" stroke="#475569" strokeWidth="2" />
          </g>

          <g>
            <path d="M 150 145 L 270 145 L 270 260" stroke="#0284c7" strokeWidth="2.5" strokeDasharray="6 4" />
            <circle cx="270" cy="260" r="5" fill="#0284c7" />
            <circle cx="270" cy="260" r="10" fill="none" stroke="#0284c7" strokeWidth="2" className="hotspot-pulse" filter="url(#cyanGlow)" />
            <circle cx="270" cy="260" r="3" fill="#ffffff" />
          </g>

          <g>
            <path d="M 850 145 L 730 145 L 730 250" stroke="#059669" strokeWidth="2.5" strokeDasharray="6 4" />
            <circle cx="730" cy="250" r="5" fill="#059669" />
            <circle cx="730" cy="250" r="10" fill="none" stroke="#059669" strokeWidth="2" className="hotspot-pulse" filter="url(#emeraldGlow)" />
            <circle cx="730" cy="250" r="3" fill="#ffffff" />
          </g>
        </svg>
      </div>

      {showFooter && (
        <div className="info-footer">
          <div className="stat-box">
            <span className="stat-label">Motor Status</span>
            <span className="stat-val" style={{ color: previewMode ? '#64748b' : (overallStatus === 'critical' ? '#dc2626' : overallStatus === 'warning' ? '#d97706' : '#059669') }}>
              {previewMode ? '—' : `● ${overallStatus === 'critical' ? 'ALARM' : overallStatus === 'warning' ? 'WARNING' : 'OPERATIONAL'}`}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label" title={rpmLabel}>{rpmLabel}</span>
            <span className={`stat-val ${previewMode ? 'text-slate-400 italic text-sm' : ''}`}>
              {previewMode
                ? '—'
                : (rpm != null ? `${Math.round(rpm)}${rpmUnit ? ` ${rpmUnit}` : ''}` : '—')}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label" title={currentLabel}>{currentLabel}</span>
            <span className={`stat-val ${previewMode ? 'text-slate-400 italic text-sm' : ''}`}>
              {previewMode
                ? '—'
                : (current != null ? `${formatValue(current, 1)}${currentUnit ? ` ${currentUnit}` : ''}` : '—')}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Overall Health</span>
            <span className="stat-val">{previewMode ? '—' : `${healthPct} %`}</span>
          </div>
        </div>
      )}
    </div>
  )
}
