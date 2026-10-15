import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import AssetTwinRenderer, { buildThresholdsFromBindings, buildTagIdMap } from '../../components/assetTwins/AssetTwinRenderer'
import useAssetTwinLiveValues from '../../hooks/useAssetTwinLiveValues'
import { assetTwinsApi } from '../../services/assetTwinsApi'
import { showToast } from '../../utils/toast'

export default function AssetTwinDetailPage() {
  const { instanceId } = useParams()
  const navigate = useNavigate()
  const [instance, setInstance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await assetTwinsApi.getAssignedDetail(instanceId)
        setInstance(res.instance)
      } catch (err) {
        showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load asset twin' })
        navigate('/employee/asset-digital-twin')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [instanceId, navigate])

  const tagIdMap = buildTagIdMap(instance?.tagBindings || {})
  const initialValues = instance?.values || {}
  const { values, lastUpdated } = useAssetTwinLiveValues(tagIdMap, initialValues)
  const thresholds = buildThresholdsFromBindings(instance?.tagBindings || {})

  if (loading) {
    return <LoadingSpinner text="Loading digital twin..." />
  }

  if (!instance) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate('/employee/asset-digital-twin')} className="text-xs font-bold text-blue-600 mb-2">
            ← Back to list
          </button>
          <h1 className="text-xl font-extrabold text-slate-800">{instance.name}</h1>
          {instance.description && <p className="text-sm text-slate-500 mt-1">{instance.description}</p>}
        </div>
        {lastUpdated && (
          <span className="text-[10px] font-semibold text-slate-400">
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

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
  )
}
