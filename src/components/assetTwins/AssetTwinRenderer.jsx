import MotorDigitalTwin2D from './MotorDigitalTwin2D'
import { getAssetTwinTemplate } from './AssetTwinRegistry'

/** Short label for twin UI: custom label → P1/P2 → topic */
export function tagDisplayLabel(tag) {
  if (!tag || typeof tag !== 'object') return ''
  return (tag.displayName || tag.parameterName || tag.topicName || '').trim()
}

export function buildBindingLabels(tagBindings = {}) {
  const labels = {}
  Object.entries(tagBindings || {}).forEach(([slotKey, tag]) => {
    const label = tagDisplayLabel(tag)
    if (label) labels[slotKey] = label
  })
  return labels
}

export function buildBindingUnits(tagBindings = {}) {
  const units = {}
  Object.entries(tagBindings || {}).forEach(([slotKey, tag]) => {
    if (tag?.unit) units[slotKey] = tag.unit
  })
  return units
}

export default function AssetTwinRenderer({
  templateId,
  title,
  values = {},
  thresholds = {},
  compact = false,
  miniPreview = false,
  showHeader = true,
  showFooter = true,
  previewMode = false,
  bindingLabels = {},
  bindingUnits = {},
  tagBindings = null
}) {
  const template = getAssetTwinTemplate(templateId)
  if (!template) {
    return (
      <div className="p-4 text-sm text-slate-500 border border-dashed rounded-xl">
        Unknown asset twin template: {templateId}
      </div>
    )
  }

  const resolvedLabels = {
    ...(tagBindings ? buildBindingLabels(tagBindings) : {}),
    ...bindingLabels
  }
  const resolvedUnits = {
    ...(tagBindings ? buildBindingUnits(tagBindings) : {}),
    ...bindingUnits
  }

  if (template.component === 'MotorDigitalTwin2D') {
    return (
      <MotorDigitalTwin2D
        title={title || template.name}
        values={values}
        thresholds={thresholds}
        compact={compact}
        miniPreview={miniPreview}
        showHeader={showHeader}
        showFooter={showFooter}
        previewMode={previewMode}
        bindingLabels={resolvedLabels}
        bindingUnits={resolvedUnits}
        slotLabels={template.slots}
      />
    )
  }

  return null
}

export function buildThresholdsFromBindings(tagBindings = {}) {
  const thresholds = {}
  Object.entries(tagBindings).forEach(([slotKey, tag]) => {
    if (!tag) return
    thresholds[slotKey] = {
      warningThreshold: tag.warningThreshold ?? null,
      criticalThreshold: tag.criticalThreshold ?? null
    }
  })
  return thresholds
}

export function buildTagIdMap(tagBindings = {}) {
  const map = {}
  Object.entries(tagBindings).forEach(([slotKey, tag]) => {
    if (!tag) return
    const id = tag._id?.toString?.() || tag
    if (id) map[slotKey] = id
  })
  return map
}
