import { useMemo } from 'react'
import AssetTwinRenderer, { buildThresholdsFromBindings, buildTagIdMap } from '../../components/assetTwins/AssetTwinRenderer'
import useAssetTwinLiveValues from '../../hooks/useAssetTwinLiveValues'

export default function AssetTwinViewModal({ visible, instance, onClose }) {
  const tagIdMap = useMemo(() => buildTagIdMap(instance?.tagBindings || {}), [instance?.tagBindings])
  const initialValues = useMemo(() => instance?.values || {}, [instance?.values])
  const { values, lastUpdated } = useAssetTwinLiveValues(tagIdMap, initialValues)
  const thresholds = useMemo(() => buildThresholdsFromBindings(instance?.tagBindings || {}), [instance?.tagBindings])

  if (!visible || !instance) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-800 truncate">{instance.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {instance.description || 'Live digital twin view'}
              {instance.gateway?.name ? ` · ${instance.gateway.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="text-[10px] font-semibold text-slate-400">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer border-none"
            >
              <i className="pi pi-times text-sm" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <AssetTwinRenderer
            templateId={instance.templateId}
            title={instance.name}
            values={values}
            thresholds={thresholds}
            tagBindings={instance.tagBindings}
            showHeader
            showFooter
          />
        </div>
      </div>
    </div>
  )
}
