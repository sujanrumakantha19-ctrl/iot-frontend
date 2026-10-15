import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { assignApi } from '../../services/assignApi'
import { quickInsightsApi } from '../../services/quickInsightsApi'
import { assetTwinsApi } from '../../services/assetTwinsApi'
import { METER_REGISTRY } from '../meters/DynamicMeterRenderer'
import { GRAPH_REGISTRY } from '../graphs/DynamicGraphRenderer'
import DynamicMeterRenderer from '../meters/DynamicMeterRenderer'
import DynamicGraphRenderer from '../graphs/DynamicGraphRenderer'
import { formatTagDisplayName } from '../../utils/tagUtils'

export default function AddWidgetModal({
  visible,
  employeeId,
  tabId,
  onClose,
  onAdded,
  assignPermissionMode,
  allowedGraphIds,
  allowedMeterTypes
}) {
  const [step, setStep] = useState(1)
  const [flow, setFlow] = useState('tag') // 'tag' | 'assetTwin'
  const [tags, setTags] = useState([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState(null)
  const [selectedType, setSelectedType] = useState(null) // 'meter' | 'graph'
  const [selectedVizId, setSelectedVizId] = useState(null)
  const [twinInstances, setTwinInstances] = useState([])
  const [twinsLoading, setTwinsLoading] = useState(false)
  const [twinSearch, setTwinSearch] = useState('')

  // Meter configuration parameters
  const [meterMin, setMeterMin] = useState(0)
  const [meterMax, setMeterMax] = useState(100)
  const [meterIdle, setMeterIdle] = useState(0)
  const [meterColor, setMeterColor] = useState('#22c55e')
  const [submitting, setSubmitting] = useState(false)

  const isLimited = assignPermissionMode === 'limit'

  const filteredMeters = useMemo(() => {
    let list = Object.values(METER_REGISTRY)
    if (isLimited && allowedMeterTypes?.length) {
      list = list.filter(m => allowedMeterTypes.includes(m.id))
    }
    return list
  }, [isLimited, allowedMeterTypes])

  const filteredGraphs = useMemo(() => {
    let list = Object.values(GRAPH_REGISTRY)
    if (isLimited && allowedGraphIds?.length) {
      list = list.filter(g => allowedGraphIds.includes(g.id))
    }
    return list
  }, [isLimited, allowedGraphIds])

  const loadTags = useCallback(async () => {
    if (!employeeId || !visible) return
    setTagsLoading(true)
    try {
      const res = await assignApi.getAssignTags(employeeId, 1, 200, searchTerm)
      setTags(res.tags || [])
    } catch (err) {
      console.error('Failed to load tags:', err)
      setTags([])
    } finally {
      setTagsLoading(false)
    }
  }, [employeeId, visible, searchTerm])

  const loadTwinInstances = useCallback(async () => {
    if (!employeeId || !visible || flow !== 'assetTwin') return
    setTwinsLoading(true)
    try {
      const res = await assetTwinsApi.listInstances({ page: 1, limit: 100, search: twinSearch })
      const filtered = (res.instances || []).filter(inst =>
        (inst.assignedEmployeeIds || []).includes(employeeId)
      )
      setTwinInstances(filtered)
    } catch (err) {
      console.error('Failed to load asset twins:', err)
      setTwinInstances([])
    } finally {
      setTwinsLoading(false)
    }
  }, [employeeId, visible, flow, twinSearch])

  useEffect(() => {
    if (visible) {
      if (flow === 'tag') loadTags()
      if (flow === 'assetTwin') loadTwinInstances()
      setStep(1)
      setSelectedTag(null)
      setSelectedType(null)
      setSelectedVizId(null)
      setSearchTerm('')
      setTwinSearch('')
      setMeterMin(0)
      setMeterMax(100)
      setMeterIdle(0)
      setMeterColor('#22c55e')
    }
  }, [visible, flow])

  useEffect(() => {
    if (visible && flow === 'tag') {
      const timer = setTimeout(loadTags, 300)
      return () => clearTimeout(timer)
    }
  }, [searchTerm, visible, loadTags, flow])

  useEffect(() => {
    if (visible && flow === 'assetTwin') {
      const timer = setTimeout(loadTwinInstances, 300)
      return () => clearTimeout(timer)
    }
  }, [twinSearch, visible, loadTwinInstances, flow])

  const handleSelectTag = (tag) => {
    setSelectedTag(tag)
    setStep(2)
    setSelectedType(null)
    setSelectedVizId(null)
  }

  const handleSelectType = (type) => {
    setSelectedType(type)
    setSelectedVizId(null)
    if (type === 'meter') {
      setStep(3)
    } else {
      setStep(4) // Skip config for graphs
    }
  }

  const handleSelectViz = (id) => {
    setSelectedVizId(id)
    if (selectedType === 'meter') {
      // Auto-set initial min/idle defaults for vertical meters
      if (id === 'VERTICAL_BAR_IDLE') {
        setMeterMin(-100)
        setMeterMax(100)
        setMeterIdle(0)
      }
      setStep(4)
    } else {
      handleSubmit(id)
    }
  }

  const handleSubmitAssetTwin = async (instance) => {
    setSubmitting(true)
    try {
      const data = {
        type: 'assetTwin',
        assetTwinInstanceId: instance._id,
        visualizationId: instance.templateId || 'MOTOR_2D_SIEMENS',
        w: 12,
        h: 6
      }
      const res = await quickInsightsApi.addWidget(tabId, data)
      if (onAdded) onAdded(res.data.widget)
    } catch (err) {
      console.error('Failed to add asset twin widget:', err)
    } finally {
      setSubmitting(false)
      onClose()
    }
  }

  const handleSubmit = async (vizIdOverride) => {
    const vizId = vizIdOverride || selectedVizId
    if (!selectedTag || !selectedType || !vizId) return

    setSubmitting(true)
    try {
      const data = {
        tagId: selectedTag.tagId,
        type: selectedType,
        visualizationId: vizId,
        w: 3,
        h: 2,
      }
      if (selectedType === 'meter') {
        data.meterMin = meterMin
        data.meterMax = meterMax
        data.meterIdle = meterIdle
        data.meterColor = meterColor
      }
      const res = await quickInsightsApi.addWidget(tabId, data)
      if (onAdded) onAdded(res.data.widget)
    } catch (err) {
      console.error('Failed to add widget:', err)
    } finally {
      setSubmitting(false)
      onClose()
    }
  }

  if (!visible) return null

  const selectedVizDef = selectedVizId
    ? (selectedType === 'meter' ? METER_REGISTRY[selectedVizId] : GRAPH_REGISTRY[selectedVizId])
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="rounded-3xl shadow-2xl border max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
        >
          <div>
            <h3 className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>Add Widget to Tab</h3>
            <p className="text-xs font-semibold text-blue-500 mt-0.5">
              {flow === 'assetTwin' && 'Select an asset twin instance (full-width widget)'}
              {flow === 'tag' && step === 1 && 'Step 1 of 4: Select a parameter tag'}
              {flow === 'tag' && step === 2 && 'Step 2 of 4: Select visualization type'}
              {flow === 'tag' && step === 3 && selectedType === 'meter' && 'Step 3 of 4: Select meter style'}
              {flow === 'tag' && step === 4 && selectedType === 'meter' && 'Step 4 of 4: Range & color configuration'}
              {flow === 'tag' && step === 4 && selectedType === 'graph' && 'Step 3 of 3: Select graph style'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-colors cursor-pointer border-none"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            <i className="pi pi-times text-xs" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFlow('tag')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${flow === 'tag' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200'}`}
            >
              Tag Widget
            </button>
            <button
              type="button"
              onClick={() => setFlow('assetTwin')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${flow === 'assetTwin' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200'}`}
            >
              Asset Twin
            </button>
          </div>

          {flow === 'assetTwin' && (
            <div className="space-y-3">
              <div className="relative">
                <i className="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                <input
                  value={twinSearch}
                  onChange={e => setTwinSearch(e.target.value)}
                  placeholder="Search asset twin instances..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-xs font-semibold outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              {twinsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <i className="pi pi-spin pi-spinner text-violet-600 text-xl" />
                </div>
              ) : twinInstances.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-dashed" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No asset twins assigned to this employee</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {twinInstances.map(inst => (
                    <button
                      key={inst._id}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSubmitAssetTwin(inst)}
                      className="flex items-center gap-3 p-3 rounded-2xl border hover:border-violet-500 text-left transition-all cursor-pointer"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                        <i className="pi pi-box text-xs" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{inst.name}</div>
                        <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{inst.templateId}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {flow === 'tag' && step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <i className="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search parameter tags by name or device node..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              {tagsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <i className="pi pi-spin pi-spinner text-blue-600 text-xl" />
                </div>
              ) : tags.length === 0 ? (
                <div
                  className="text-center py-12 rounded-2xl border border-dashed"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
                >
                  <i className="pi pi-tag text-slate-400 text-2xl mb-2" />
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No telemetry parameters found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ensure this employee has parameters assigned.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.tagId}
                      onClick={() => handleSelectTag(tag)}
                      className="flex items-center gap-3 p-3 rounded-2xl border hover:border-blue-500 hover:bg-blue-50/10 text-left transition-all cursor-pointer group shadow-none"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <i className="pi pi-sliders-h text-xs" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {formatTagDisplayName(tag)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                          {tag.deviceName && `${tag.deviceName} • `}{tag.parameterName}{tag.unit ? ` (${tag.unit})` : ''}
                        </div>
                      </div>
                      <div
                        className="text-xs font-mono font-bold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                      >
                        {tag.liveValue != null ? Number(tag.liveValue).toFixed(2) : '---'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Type (Meter vs Graph) */}
          {flow === 'tag' && step === 2 && selectedTag && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center gap-2">
                <i className="pi pi-info-circle text-blue-600 text-sm shrink-0" />
                <span className="text-xs font-semibold text-blue-900 truncate">
                  Selected Tag: <strong>{formatTagDisplayName(selectedTag)}</strong> ({selectedTag.unit})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSelectType('meter')}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:border-blue-600 hover:bg-blue-50/10 transition-all cursor-pointer group shadow-sm hover:shadow-md"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i className="pi pi-gauge" />
                  </div>
                  <div className="text-center">
                    <div className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>Digital / Analogue Meter</div>
                    <div className="text-xs font-semibold text-slate-400 mt-0.5">22 high-performance styles</div>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectType('graph')}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border hover:border-emerald-600 hover:bg-emerald-50/10 transition-all cursor-pointer group shadow-sm hover:shadow-md"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <i className="pi pi-chart-line" />
                  </div>
                  <div className="text-center">
                    <div className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>Live Graph</div>
                    <div className="text-xs font-semibold text-slate-400 mt-0.5">25 real-time chart styles</div>
                  </div>
                </button>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => { setStep(1); setSelectedType(null) }}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  &larr; Back to Parameters
                </button>
              </div>
            </div>
          )}

          {/* Step 3 for Meter: Select Meter Style */}
          {flow === 'tag' && step === 3 && selectedType === 'meter' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                {filteredMeters.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectViz(m.id)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border hover:border-blue-600 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="w-full h-36 flex items-center justify-center rounded-xl overflow-hidden bg-slate-950 p-2.5">
                      <DynamicMeterRenderer type={m.id} value={45} />
                    </div>
                    <div className="text-xs font-bold text-center truncate w-full" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => { setStep(2); setSelectedVizId(null) }}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  &larr; Back
                </button>
              </div>
            </div>
          )}

          {/* Step 4 for Meter: Range & Color Configuration */}
          {flow === 'tag' && step === 4 && selectedType === 'meter' && selectedVizId && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="rounded-2xl p-4 flex items-center justify-center bg-slate-950 border border-slate-800 min-h-[220px]">
                <DynamicMeterRenderer
                  type={selectedVizId}
                  value={45}
                  customProps={{
                    min: meterMin,
                    max: meterMax,
                    idle: meterIdle,
                    color: meterColor,
                    unit: selectedTag?.unit || '',
                    label: formatTagDisplayName(selectedTag)
                  }}
                />
              </div>

              {/* Range & Color Inputs */}
              <div
                className="grid grid-cols-2 gap-3 p-4 rounded-2xl border"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Minimum Value</label>
                  <input
                    type="number"
                    value={meterMin}
                    onChange={e => setMeterMin(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none focus:border-blue-500"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Maximum Value</label>
                  <input
                    type="number"
                    value={meterMax}
                    onChange={e => setMeterMax(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none focus:border-blue-500"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                {selectedVizId === 'VERTICAL_BAR_IDLE' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Idle Baseline Value</label>
                    <input
                      type="number"
                      value={meterIdle}
                      onChange={e => setMeterIdle(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none focus:border-blue-500"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Accent Color</label>
                  <input
                    type="color"
                    value={meterColor}
                    onChange={e => setMeterColor(e.target.value)}
                    className="w-full h-[36px] rounded-xl border cursor-pointer px-1 py-1"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  &larr; Back
                </button>
                <button
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                  className="px-6 py-2.5 text-xs font-extrabold rounded-xl cursor-pointer border-none text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 shadow-sm"
                >
                  {submitting ? 'Adding Widget...' : `Add "${selectedVizDef?.name || 'Meter'}" Widget`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 for Graph: Select Graph Style */}
          {flow === 'tag' && step === 4 && selectedType === 'graph' && !selectedVizId && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                {filteredGraphs.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleSubmit(g.id)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border hover:border-emerald-600 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                  >
                    <div
                      className="w-full h-32 overflow-hidden rounded-xl border p-1 flex flex-col justify-center"
                      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
                    >
                      <DynamicGraphRenderer type={g.id} masterVal={65} height="110px" />
                    </div>
                    <div className="text-xs font-bold text-center truncate w-full" style={{ color: 'var(--text-primary)' }}>{g.title}</div>
                    <div className="text-[10px] text-slate-400 font-semibold text-center">{g.tag}</div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => { setStep(2); setSelectedType(null) }}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  &larr; Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
