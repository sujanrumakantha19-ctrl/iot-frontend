import { useCallback, useEffect, useRef, useState } from 'react'
import { gatewaysApi } from '../../services/gatewaysApi'
import { getSocket } from '../../services/socketClient'
import { NETWORK_MODES, parseNetworkChoice, parsePhysicalStatus } from '../../utils/networkStatus'
import CountdownModal from './CountdownModal'

const QUERIES = {
  choice: { title: 'Reading Network Modes', event: 'gateway:network-choice-response', request: gatewaysApi.queryNetworkChoice },
  physical: { title: 'Reading Active Interface', event: 'gateway:network-physical-response', request: gatewaysApi.queryPhysicalStatus },
}
const labelFor = (id) => NETWORK_MODES.find(mode => mode.id === id)?.label || id

export default function GatewayNetworkPanel({ gatewayId }) {
  const [choice, setChoice] = useState(null)
  const [physical, setPhysical] = useState(null)
  const [pending, setPending] = useState(null)
  const [errors, setErrors] = useState({})
  const pendingRef = useRef(null)
  const requestSequence = useRef(0)
  const requestStartedAt = useRef(0)

  const stopWaiting = useCallback(() => {
    const query = pendingRef.current
    if (query) {
      const message = Date.now() - requestStartedAt.current >= 9500
        ? 'No response received within 10 seconds. Check the gateway connection and try again.'
        : 'Stopped waiting for a response. You can request an updated reading again.'
      setErrors(prev => ({ ...prev, [query]: message }))
    }
    pendingRef.current = null
    setPending(null)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const sequenceRef = requestSequence
    const handlers = Object.entries(QUERIES).map(([query, { event }]) => {
      const handler = (data) => {
        if (String(data.gatewayId) !== String(gatewayId)) return
        // Only consume responses to an outstanding query in this panel.
        if (pendingRef.current !== query) return
        const result = query === 'choice' ? parseNetworkChoice(data.payload) : parsePhysicalStatus(data.payload)
        const received = { ...result, receivedAt: new Date().toLocaleTimeString() }
        if (query === 'choice') setChoice(received)
        else setPhysical(received)
        setErrors(prev => ({ ...prev, [query]: result.valid ? '' : 'The gateway returned an unrecognized response. The original response is shown below.' }))
        pendingRef.current = null
        setPending(null)
      }
      socket.on(event, handler)
      return { event, handler }
    })
    return () => {
      handlers.forEach(({ event, handler }) => socket.off(event, handler))
      pendingRef.current = null
      sequenceRef.current++
    }
  }, [gatewayId])

  const request = async (query) => {
    if (pendingRef.current) return
    const socket = getSocket()
    if (!socket?.connected) {
      setErrors(prev => ({ ...prev, [query]: 'Live connection is unavailable. Wait for reconnection, then try again.' }))
      return
    }
    const sequence = ++requestSequence.current
    requestStartedAt.current = Date.now()
    pendingRef.current = query
    setPending(query)
    setErrors(prev => ({ ...prev, [query]: '' }))
    try {
      await QUERIES[query].request(gatewayId)
    } catch (err) {
      if (requestSequence.current !== sequence || pendingRef.current !== query) return
      pendingRef.current = null
      setPending(null)
      setErrors(prev => ({ ...prev, [query]: err.message || 'Unable to send the request. Please try again.' }))
    }
  }

  const button = (query, label) => (
    <button type="button" onClick={() => request(query)} disabled={!!pending}
      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0">
      <i className={pending === query ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'} aria-hidden="true" />
      {pending === query ? 'Reading...' : label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Network</h3>
        <p className="text-xs text-slate-500 mt-1">Read the gateway’s selected connection modes and the interface currently carrying data.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h4 className="text-sm font-bold text-slate-800">Configured network modes</h4>
              <p className="text-xs text-slate-500 mt-1">Modes selected on the gateway and their preferred order.</p></div>
            {button('choice', 'Read Network Modes')}
          </div>
          {choice?.valid ? <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
              {choice.priority.length ? 'Connection priority' : 'Selected connections'}
            </p>
            <ol className="flex flex-wrap items-center gap-y-3" aria-label={choice.priority.length ? 'Connection priority, preferred first' : 'Selected network modes'}>
              {(choice.priority.length ? choice.priority : choice.modes).map((mode, index) => (
                <li key={mode} className="flex items-center">
                  {index > 0 && choice.priority.length > 0 && <i className="pi pi-arrow-right text-slate-300 text-xs mx-3" aria-hidden="true" />}
                  <div className={`rounded-lg border px-4 py-3 ${index === 0 && choice.priority.length ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'} ${!choice.priority.length ? 'mr-3' : ''}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${index === 0 && choice.priority.length ? 'text-blue-500' : 'text-slate-400'}`}>
                      {choice.priority.length ? ['First choice', 'Fallback', 'Last resort'][index] : 'Selected'}
                    </p>
                    <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <i className={`${NETWORK_MODES.find(item => item.id === mode)?.icon} text-blue-600`} aria-hidden="true" />
                      {labelFor(mode)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {!choice.priority.length && <p className="text-xs text-slate-500 mt-3">Priority was not provided by the gateway.</p>}
          </div> : <p className="text-xs text-slate-500 py-4">{choice ? 'Unable to identify the selected modes.' : 'Read network modes to see which connections are enabled.'}</p>}
          {errors.choice && <p role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{errors.choice}</p>}
          {choice && <ResponseInfo result={choice} />}
        </section>
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h4 className="text-sm font-bold text-slate-800">Active network interface</h4>
              <p className="text-xs text-slate-500 mt-1">The physical connection currently used by the gateway.</p></div>
            {button('physical', 'Read Active Interface')}
          </div>
          {physical?.valid ? <div className={`rounded-lg border p-4 ${physical.mode === 'none' ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className={`text-lg font-bold ${physical.mode === 'none' ? 'text-slate-600' : 'text-emerald-700'}`}>
              <i className={`${NETWORK_MODES.find(mode => mode.id === physical.mode)?.icon || 'pi pi-ban'} mr-2`} aria-hidden="true" />
              {physical.mode === 'none' ? 'No active interface' : labelFor(physical.mode)}
            </p>
            <p className="text-xs text-slate-600 mt-2">{physical.mode === 'none' ? 'The gateway reports no active physical link.' : 'Reported by the gateway as the active data connection.'}</p>
          </div> : <p className="text-xs text-slate-500 py-4">{physical ? 'Unable to identify the active interface.' : 'Read the active interface to check the current data connection.'}</p>}
          {errors.physical && <p role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{errors.physical}</p>}
          {physical && <ResponseInfo result={physical} />}
        </section>
      </div>
      <CountdownModal visible={!!pending} title={QUERIES[pending]?.title || ''}
        subtitle="Waiting for the gateway to respond..." duration={10} onCancel={stopWaiting} />
    </div>
  )
}

function ResponseInfo({ result }) {
  return <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-1">
    <p>Last response: {result.receivedAt}</p>
    <p className="break-words">Gateway response: <span className="font-mono text-slate-600">{result.raw || '(empty response)'}</span></p>
  </div>
}
