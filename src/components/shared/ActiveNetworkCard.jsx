import { useCallback, useEffect, useRef, useState } from 'react'
import { gatewaysApi } from '../../services/gatewaysApi'
import { getSocket } from '../../services/socketClient'
import { getActiveNetworkLabel, parsePhysicalStatus } from '../../utils/networkStatus'
import { showToast } from '../../utils/toast'
import CountdownModal from './CountdownModal'

export default function ActiveNetworkCard({ gateway, canQuery = true }) {
  const [checking, setChecking] = useState(false)
  const pending = useRef(false)
  const startedAt = useRef(0)
  const sequence = useRef(0)
  const mode = parsePhysicalStatus(gateway.activeNetwork).mode

  const stopWaiting = useCallback(() => {
    if (pending.current) {
      showToast({ severity: 'warn', summary: 'Active Network', detail: Date.now() - startedAt.current >= 9500
        ? 'No response received within 10 seconds. Please try again.'
        : 'Stopped waiting for the gateway response.' })
    }
    pending.current = false
    setChecking(false)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const sequenceRef = sequence
    const onResponse = (data) => {
      if (String(data.gatewayId) !== String(gateway._id) || !pending.current) return
      pending.current = false
      setChecking(false)
      showToast({ severity: 'success', summary: 'Active Network Updated',
        detail: `Saved active interface: ${getActiveNetworkLabel(data.activeNetwork ?? data.payload)}` })
    }
    socket?.on('gateway:network-physical-response', onResponse)
    return () => {
      socket?.off('gateway:network-physical-response', onResponse)
      pending.current = false
      sequenceRef.current++
    }
  }, [gateway._id])

  const checkStatus = async () => {
    if (pending.current || !canQuery) return
    if (!getSocket()?.connected) {
      showToast({ severity: 'warn', summary: 'Live Connection Unavailable', detail: 'Wait for reconnection, then try again.' })
      return
    }
    const requestSequence = ++sequence.current
    pending.current = true
    startedAt.current = Date.now()
    setChecking(true)
    try {
      await gatewaysApi.queryPhysicalStatus(gateway._id)
    } catch (error) {
      if (requestSequence !== sequence.current || !pending.current) return
      pending.current = false
      setChecking(false)
      showToast({ severity: 'error', summary: 'Network Query Failed', detail: error.message })
    }
  }

  return (
    <div className="bg-white border border-slate-200/80 p-4 space-y-1 flex flex-col justify-between rounded-[15px]">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Network</p>
        <div className="flex items-center gap-2 mt-1 text-slate-800" aria-live="polite">
          {mode === 'eth' ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M4 4h16v12h-4v4H8v-4H4z" strokeLinejoin="round" />
              <path d="M8 4v5m4-5v5m4-5v5M8 13h8" />
            </svg>
          ) : mode === 'lte' ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-blue-600" fill="currentColor" aria-hidden="true">
              <rect x="2" y="16" width="4" height="6" rx="1" /><rect x="8" y="11" width="4" height="11" rx="1" />
              <rect x="14" y="6" width="4" height="16" rx="1" /><rect x="20" y="2" width="3" height="20" rx="1" />
            </svg>
          ) : <i className={`${mode === 'wifi' ? 'pi pi-wifi text-blue-600' : 'pi pi-ban text-slate-400'} text-base shrink-0`} aria-hidden="true" />}
          <p className="text-sm font-bold truncate" title={getActiveNetworkLabel(gateway.activeNetwork)}>{getActiveNetworkLabel(gateway.activeNetwork)}</p>
        </div>
      </div>
      {gateway.activeNetworkUpdatedAt && <p className="text-[10px] text-slate-400 font-medium" title={new Date(gateway.activeNetworkUpdatedAt).toLocaleString()}>
        Last read: {new Date(gateway.activeNetworkUpdatedAt).toLocaleTimeString()}
      </p>}
      {canQuery && <button type="button" disabled={checking} onClick={checkStatus}
        className="mt-2 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer w-fit disabled:opacity-50"
        title="Read and save the active network interface from the gateway">
        <i className={checking ? 'pi pi-spin pi-spinner text-[9px]' : 'pi pi-refresh text-[9px]'} aria-hidden="true" />
        {checking ? 'Checking...' : 'Check Status'}
      </button>}
      <CountdownModal visible={checking} title="Checking Active Network" subtitle="Waiting for the gateway to report its active interface..." duration={10} onCancel={stopWaiting} />
    </div>
  )
}
