import { useState, useEffect, useMemo } from 'react'
import AssetTwinRenderer, { buildThresholdsFromBindings, tagDisplayLabel } from '../../components/assetTwins/AssetTwinRenderer'
import { getAssetTwinTemplate } from '../../components/assetTwins/AssetTwinRegistry'
import TagSearchCombobox, { formatTagLabel } from '../../components/shared/TagSearchCombobox'
import { assetTwinsApi } from '../../services/assetTwinsApi'
import { gatewaysApi } from '../../services/gatewaysApi'
import useAssetTwinLiveValues from '../../hooks/useAssetTwinLiveValues'
import { showToast } from '../../utils/toast'

const TEMPLATE_ID = 'MOTOR_2D_SIEMENS'

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'

const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1'

export default function AssetTwinFormModal({ visible, instance, onClose, onSaved }) {
  const template = getAssetTwinTemplate(TEMPLATE_ID)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [gatewayId, setGatewayId] = useState('')
  const [gateways, setGateways] = useState([])
  const [tagBindings, setTagBindings] = useState({})
  const [selectedTags, setSelectedTags] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [previewBindings, setPreviewBindings] = useState({})

  const tagIdMap = useMemo(() => {
    const map = {}
    Object.entries(tagBindings).forEach(([key, id]) => {
      if (id) map[key] = id
    })
    return map
  }, [tagBindings])
  const { values: liveValues } = useAssetTwinLiveValues(tagIdMap, previewBindings)

  const bindingLabels = useMemo(() => {
    const labels = {}
    Object.entries(selectedTags).forEach(([key, tag]) => {
      if (tag) labels[key] = tagDisplayLabel(tag) || formatTagLabel(tag)
    })
    return labels
  }, [selectedTags])

  const bindingUnits = useMemo(() => {
    const units = {}
    Object.entries(selectedTags).forEach(([key, tag]) => {
      if (tag?.unit) units[key] = tag.unit
    })
    return units
  }, [selectedTags])

  useEffect(() => {
    if (!visible) return
    gatewaysApi.getManagerGateways({ page: 1, limit: 100 })
      .then(res => setGateways(res.gateways || []))
      .catch(() => setGateways([]))
  }, [visible])

  useEffect(() => {
    if (!visible) return
    if (instance) {
      setName(instance.name || '')
      setDescription(instance.description || '')
      setGatewayId(instance.gatewayId?.toString?.() || instance.gatewayId || '')
      const bindings = {}
      const tags = {}
      const preview = {}
      Object.entries(instance.tagBindings || {}).forEach(([key, tag]) => {
        if (tag?._id) {
          const id = tag._id.toString()
          bindings[key] = id
          tags[key] = {
            _id: id,
            displayName: tag.displayName,
            parameterName: tag.parameterName,
            topicName: tag.topicName,
            deviceName: tag.deviceName,
            unit: tag.unit,
            latestValue: tag.latestValue
          }
          preview[key] = tag.latestValue ?? null
        }
      })
      setTagBindings(bindings)
      setSelectedTags(tags)
      setPreviewBindings(preview)
    } else {
      setName('')
      setDescription('')
      setGatewayId('')
      setTagBindings({})
      setSelectedTags({})
      setPreviewBindings({})
    }
  }, [visible, instance])

  const handleTagSelect = (slotKey, tag) => {
    setTagBindings(prev => ({ ...prev, [slotKey]: tag._id }))
    setSelectedTags(prev => ({ ...prev, [slotKey]: tag }))
    setPreviewBindings(prev => ({ ...prev, [slotKey]: tag.latestValue ?? null }))
  }

  const handleTagClear = (slotKey) => {
    setTagBindings(prev => ({ ...prev, [slotKey]: null }))
    setSelectedTags(prev => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
    setPreviewBindings(prev => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ severity: 'warn', summary: 'Validation', detail: 'Name is required' })
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        description,
        templateId: TEMPLATE_ID,
        gatewayId: gatewayId || null,
        tagBindings
      }
      if (instance?._id) {
        await assetTwinsApi.updateInstance(instance._id, payload)
      } else {
        await assetTwinsApi.createInstance(payload)
      }
      showToast({ severity: 'success', summary: 'Saved', detail: 'Asset twin instance saved', life: 2000 })
      onSaved?.()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || err.message || 'Save failed' })
    } finally {
      setSubmitting(false)
    }
  }

  const thresholds = buildThresholdsFromBindings(
    Object.fromEntries(
      Object.entries(tagBindings).map(([key]) => [key, instance?.tagBindings?.[key] || selectedTags[key] || null])
    )
  )

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">{instance ? 'Edit Asset Twin' : 'Create Asset Twin'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Map telemetry tags to motor sensor slots</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer border-none">
            <i className="pi pi-times text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 xl:grid-cols-5 gap-5">
          <div className="xl:col-span-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Pump Motor A" />
              </div>
              <div>
                <label className={labelClass}>Filter tags by gateway</label>
                <select value={gatewayId} onChange={e => setGatewayId(e.target.value)} className={inputClass}>
                  <option value="">All gateways</option>
                  {gateways.map(gw => (
                    <option key={gw._id} value={gw._id}>{gw.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Only narrows the tag search list — not employee access</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className={inputClass} rows={2} placeholder="Optional notes" />
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">Tag mapping</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(template?.slots || []).map(slot => (
                  <div key={slot.key}>
                    <label className={labelClass}>
                      {slot.label}{slot.required ? ' *' : ''}
                    </label>
                    <TagSearchCombobox
                      value={tagBindings[slot.key] || ''}
                      selectedTag={selectedTags[slot.key] || null}
                      gatewayId={gatewayId}
                      placeholder={`Search ${slot.label.toLowerCase()}...`}
                      onSelect={tag => handleTagSelect(slot.key, tag)}
                      onClear={() => handleTagClear(slot.key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col min-h-[280px]">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Live preview</p>
            <div className="flex-1 border border-slate-200 rounded-xl bg-slate-50 p-2 overflow-hidden">
              <AssetTwinRenderer
                templateId={TEMPLATE_ID}
                title={name || template?.name}
                values={liveValues}
                thresholds={thresholds}
                bindingLabels={bindingLabels}
                bindingUnits={bindingUnits}
                compact
                miniPreview
                showHeader={false}
                showFooter={false}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/80">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200 bg-white">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSave}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 cursor-pointer border-none"
          >
            {submitting ? 'Saving...' : 'Save Instance'}
          </button>
        </div>
      </div>
    </div>
  )
}
