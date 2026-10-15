import { useState, useMemo } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import DynamicMeterRenderer, { METER_REGISTRY } from '../../components/meters/DynamicMeterRenderer'
import AdminVisualizationModal from '../../components/admin/AdminVisualizationModal'

const METER_DISPLAY_ORDER = [
  // Digital & LED
  'MINI_GAUGE',
  'DIGITAL_THERMOMETER_360',
  'DIGITAL_SPEEDOMETER_ARC',
  'DIGITAL_VERTICAL_BAR',
  'DIGITAL_HORIZONTAL_BAR',
  'SIMPLE_NEON_GAUGE',
  'NEON_GAUGE_ARC',
  'LCD_GAUGE_ARC',
  'CYBERPUNK_HEX',
  'SCIFI_ENERGY_CORE',
  'VERTICAL_BAR_IDLE',
  'VERTICAL_BAR_NORMAL',
  // Analogue Gauges
  'ANALOGUE_TEMP_GAUGE',
  'ANALOGUE_THERMOMETER_SCALE',
  'ANALOGUE_SPEED_GAUGE',
  'ANALOGUE_RADIAL_GAUGE',
  'ANALOGUE_COMPASS',
  'RETRO_VU_METER',
  'SUBMARINE_DEPTH',
  'BATTERY_LEVEL',
  'LINEAR_THERMOMETER_V',
  'AIRCRAFT_ALTIMETER'
]

export default function DigitalMetersPage() {
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'digital' | 'analogue'

  // Modal State
  const [selectedVisualization, setSelectedVisualization] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)

  const allKeys = useMemo(() => {
    const registryKeys = Object.keys(METER_REGISTRY)
    const ordered = METER_DISPLAY_ORDER.filter(k => registryKeys.includes(k))
    const remaining = registryKeys.filter(k => !ordered.includes(k))
    return [...ordered, ...remaining]
  }, [])

  const filteredKeys = useMemo(() => {
    return allKeys.filter(key => {
      if (activeTab === 'digital') return METER_REGISTRY[key].group === 'digital'
      if (activeTab === 'analogue') return METER_REGISTRY[key].group === 'analogue'
      return true
    })
  }, [allKeys, activeTab])

  const openAssignModal = (meterKey) => {
    const meta = METER_REGISTRY[meterKey] || {}
    setSelectedVisualization({
      key: meterKey,
      type: 'meter',
      metadata: meta
    })
    setModalVisible(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Meters & Gauges Showcase"
        subtitle="Industrial IoT Digital LED Meters & Analogue Dial Gauges Library. Click card to assign to parameters."
      />

      {/* Sticky Filter Tabs Bar */}
      <div
        style={{ backgroundColor: '#ffffff', borderColor: 'var(--border-color, #e2e8f0)' }}
        className="sticky top-[-24px] z-40 bg-white -mx-6 -mt-6 px-6 py-3.5 border-b shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div
          style={{ backgroundColor: 'var(--bg-hover, #f8fafc)', borderColor: 'var(--border-color, #e2e8f0)' }}
          className="flex items-center gap-1 p-1 border rounded-lg w-full sm:w-auto"
        >
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={activeTab === 'all' ? { backgroundColor: 'var(--accent-primary, #3b82f6)', color: 'var(--accent-contrast, #ffffff)' } : { color: 'var(--text-secondary, #64748b)' }}
            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all rounded-md cursor-pointer"
          >
            All Meters ({allKeys.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('digital')}
            style={activeTab === 'digital' ? { backgroundColor: 'var(--accent-primary, #3b82f6)', color: 'var(--accent-contrast, #ffffff)' } : { color: 'var(--text-secondary, #64748b)' }}
            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all rounded-md cursor-pointer"
          >
            Digital & LED (10)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analogue')}
            style={activeTab === 'analogue' ? { backgroundColor: 'var(--accent-primary, #3b82f6)', color: 'var(--accent-contrast, #ffffff)' } : { color: 'var(--text-secondary, #64748b)' }}
            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all rounded-md cursor-pointer"
          >
            Analogue Gauges (10)
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <strong className="text-slate-800">{filteredKeys.length}</strong> meters. Click card to assign.
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredKeys.map(key => {
          const item = METER_REGISTRY[key]
          return (
            <div
              key={key}
              onClick={() => openAssignModal(key)}
              style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
              className="border rounded-xl p-5 space-y-4 hover:shadow-lg transition-all duration-300 group cursor-pointer relative overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-bold group-hover:text-blue-600 transition-colors">
                    {item.name || item.title || key}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">key: {key}</span>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider border rounded-md shrink-0 ${
                  item.group === 'digital' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {item.group}
                </span>
              </div>

              {/* Dynamic Meter Renderer */}
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 shadow-inner min-h-[190px] flex items-center justify-center">
                <DynamicMeterRenderer
                  type={key}
                  value={45}
                  customProps={{
                    label: item.name || item.title || key,
                    unit: item.defaultProps?.unit || '°C',
                    min: item.defaultProps?.min ?? 0,
                    max: item.defaultProps?.max ?? 100
                  }}
                />
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-1">
                <p style={{ color: 'var(--text-secondary)' }} className="text-xs line-clamp-1 font-medium pr-2">
                  {item.description || item.category || 'Industrial IoT Meter'}
                </p>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-md transition-all shrink-0 shadow-xs flex items-center gap-1"
                >
                  <i className="pi pi-sliders-h text-[10px]" />
                  <span>Assign</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Admin Visualization Assignment Modal */}
      <AdminVisualizationModal
        visible={modalVisible}
        onHide={() => setModalVisible(false)}
        visualization={selectedVisualization}
      />
    </div>
  )
}
