import { useState, useMemo } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import DynamicGraphRenderer, { GRAPH_REGISTRY } from '../../components/graphs/DynamicGraphRenderer'
import AdminVisualizationModal from '../../components/admin/AdminVisualizationModal'

export default function GraphsShowcasePage() {
  const [activeTab, setActiveTab] = useState('all')

  // Modal State
  const [selectedVisualization, setSelectedVisualization] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)

  const allKeys = Object.keys(GRAPH_REGISTRY)

  const filteredKeys = useMemo(() => {
    return allKeys.filter(key => {
      if (activeTab === 'all') return true
      return GRAPH_REGISTRY[key].category === activeTab
    })
  }, [allKeys, activeTab])

  const categories = [
    { id: 'all', label: 'All Graphs' },
    { id: 'power', label: '⚡ Electrical & Power (5)' },
    { id: 'environment', label: '🌿 Environment & Climate (5)' },
    { id: 'machinery', label: '⚙️ Machinery & Telemetry (5)' },
    { id: 'solar', label: '☀️ Solar & Microgrid (5)' },
    { id: 'sensors', label: '📡 Smart Sensors (5)' }
  ]

  const openAssignModal = (graphKey) => {
    const meta = GRAPH_REGISTRY[graphKey] || {}
    setSelectedVisualization({
      key: graphKey,
      type: 'graph',
      metadata: meta
    })
    setModalVisible(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="IoT Telemetry Visual Analytics & Graphs Showcase"
        subtitle="Click any graph card to assign or reassign visualization to company telemetry parameters"
        icon="pi pi-chart-line"
      />

      {/* Sticky Category Tabs Header Bar */}
      <div
        style={{ backgroundColor: 'var(--bg-card, #ffffff)' }}
        className="sticky top-[-24px] z-10 -mx-6 -mt-6 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200"
      >
        <div
          style={{ backgroundColor: 'var(--bg-hover, #f8fafc)', borderColor: 'var(--border-color, #e2e8f0)' }}
          className="flex items-center gap-1 p-1 border rounded-lg overflow-x-auto w-full md:w-auto scrollbar-none"
        >
          {categories.map(cat => {
            const isActive = activeTab === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                style={isActive ? { backgroundColor: 'var(--accent-primary, #3b82f6)', color: 'var(--accent-contrast, #ffffff)' } : { color: 'var(--text-secondary, #64748b)' }}
                className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all rounded-md cursor-pointer shrink-0"
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <strong className="text-slate-800">{filteredKeys.length}</strong> graph types. Click card to assign.
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredKeys.map(key => {
          const item = GRAPH_REGISTRY[key]
          return (
            <div
              key={key}
              onClick={() => openAssignModal(key)}
              style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
              className="border rounded-xl p-5 space-y-4 hover:shadow-lg transition-all duration-300 group cursor-pointer relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-bold group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">key: {key}</span>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 rounded-md shrink-0">
                  {item.category}
                </span>
              </div>

              {/* Dynamic Graph Render */}
              <div className="bg-slate-900 rounded-lg p-2 border border-slate-800 shadow-inner min-h-[190px] flex items-center justify-center">
                <DynamicGraphRenderer
                  type={key}
                  masterVal={65}
                />
              </div>

              {/* Description & Action Trigger */}
              <div className="flex items-center justify-between pt-1">
                <p style={{ color: 'var(--text-secondary)' }} className="text-xs line-clamp-1 font-medium pr-2">
                  {item.description}
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
