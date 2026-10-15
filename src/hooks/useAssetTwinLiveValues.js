import { useState, useEffect, useMemo } from 'react'
import { getSocket } from '../services/socketClient'

const DEFAULT_VALUES = {
  deVib: null,
  deTemp: null,
  ndeVib: null,
  ndeTemp: null,
  rpm: null,
  current: null
}

export default function useAssetTwinLiveValues(tagBindings = {}, initialValues = {}) {
  const [values, setValues] = useState(() => ({
    ...DEFAULT_VALUES,
    ...(initialValues || {})
  }))
  const [lastUpdated, setLastUpdated] = useState(null)

  const tagBindingsKey = useMemo(() => JSON.stringify(tagBindings || {}), [tagBindings])
  const initialValuesKey = useMemo(() => JSON.stringify(initialValues || {}), [initialValues])

  const reverseMap = useMemo(() => {
    const map = {}
    const parsed = JSON.parse(tagBindingsKey)
    Object.entries(parsed).forEach(([slotKey, tagId]) => {
      if (tagId) map[tagId.toString()] = slotKey
    })
    return map
  }, [tagBindingsKey])

  useEffect(() => {
    const parsed = JSON.parse(initialValuesKey)
    if (Object.keys(parsed).length > 0) {
      setValues(prev => ({ ...DEFAULT_VALUES, ...parsed, ...prev }))
    }
  }, [initialValuesKey])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleTelemetryReading = (reading) => {
      const tagId = reading.tagId?.toString?.() || reading.tagId
      const slotKey = reverseMap[tagId]
      if (!slotKey) return

      const nextValue = reading.value ?? reading.val ?? reading.latestValue
      if (nextValue === undefined || nextValue === null) return

      setValues(prev => ({ ...prev, [slotKey]: Number(nextValue) }))
      setLastUpdated(reading.arrivedAt || new Date().toISOString())
    }

    socket.on('telemetry:reading', handleTelemetryReading)
    return () => socket.off('telemetry:reading', handleTelemetryReading)
  }, [reverseMap])

  return { values, lastUpdated }
}
