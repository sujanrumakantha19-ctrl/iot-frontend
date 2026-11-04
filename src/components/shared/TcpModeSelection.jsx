import { useCallback, useEffect, useRef, useState } from 'react'
import { gatewaysApi } from '../../services/gatewaysApi'
import { getSocket } from '../../services/socketClient'
import { parseTcpMode } from '../../utils/tcpMode'
import CountdownModal from './CountdownModal'

export default function TcpModeSelection({ gatewayId, canPublish = true, canRead = true }) {
  const [port, setPort] = useState('')
  const [connectivity, setConnectivity] = useState('0')
  const [pending, setPending] = useState(null)
  const [notice, setNotice] = useState(null)
  const [boardMode, setBoardMode] = useState(null)
  const pendingRef = useRef(null)
  const sequence = useRef(0)
  const startedAt = useRef(0)
  const submittedMode = useRef(null)

  const stopWaiting = useCallback(() => {
    if (pendingRef.current) {
      setNotice({ type: 'warning', text: Date.now() - startedAt.current >= 9500
        ? 'No response received within 10 seconds. Check the gateway connection and try again.'
        : 'Stopped waiting for a response. The request already sent to the gateway is not cancelled.' })
    }
    pendingRef.current = null
    setPending(null)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const sequenceRef = sequence
    const onAck = (data) => {
      if (String(data.gatewayId) !== String(gatewayId) || pendingRef.current !== 'publish') return
      // Receipt on this topic is success, including an empty or "0" body.
      pendingRef.current = null
      setPending(null)
      setNotice({ type: 'success', text: `Board acknowledged the mode request: port ${submittedMode.current.port}, ${submittedMode.current.connectivityType === 0 ? 'Ethernet' : 'WiFi'}.` })
    }
    const onRead = (data) => {
      if (String(data.gatewayId) !== String(gatewayId) || pendingRef.current !== 'read') return
      const result = parseTcpMode(data.payload)
      pendingRef.current = null
      setPending(null)
      setBoardMode({ ...result, readAt: new Date().toLocaleTimeString() })
      if (result.valid) {
        setPort(String(result.port))
        setConnectivity(String(result.connectivityType))
        setNotice({ type: 'success', text: 'Mode read from the gateway. The fields below now match the board response.' })
      } else {
        setNotice({ type: 'warning', text: 'Unable to read the mode values. Expected a port followed by 0 (Ethernet) or 1 (WiFi), separated by a comma. The board response is shown below.' })
      }
    }
    socket?.on('gateway:modbus-tcp-mode-ack', onAck)
    socket?.on('gateway:modbus-tcp-mode-read-response', onRead)
    return () => {
      socket?.off('gateway:modbus-tcp-mode-ack', onAck)
      socket?.off('gateway:modbus-tcp-mode-read-response', onRead)
      pendingRef.current = null
      sequenceRef.current++
    }
  }, [gatewayId])

  const request = async (action) => {
    if (pendingRef.current || (action === 'publish' ? !canPublish : !canRead)) return
    const parsed = parseTcpMode(`${port},${connectivity}`)
    if (action === 'publish' && !parsed.valid) {
      setNotice({ type: 'warning', text: 'Enter a valid whole-number port between 1 and 65535 and select a connectivity type.' })
      return
    }
    if (!getSocket()?.connected) {
      setNotice({ type: 'warning', text: 'Live connection is unavailable. Wait for reconnection, then try again.' })
      return
    }
    const requestSequence = ++sequence.current
    submittedMode.current = parsed
    pendingRef.current = action
    startedAt.current = Date.now()
    setPending(action)
    setNotice(null)
    try {
      if (action === 'publish') await gatewaysApi.publishTcpMode(gatewayId, parsed.port, parsed.connectivityType)
      else await gatewaysApi.readTcpMode(gatewayId)
      // HTTP success only means sent; keep waiting for the board event.
    } catch (error) {
      if (requestSequence !== sequence.current || pendingRef.current !== action) return
      pendingRef.current = null
      setPending(null)
      setNotice({ type: 'warning', text: error.message || 'Unable to send the mode request.' })
    }
  }

  return (
    <section className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"><i className="pi pi-sliders-h text-[var(--accent-primary)]" aria-hidden="true" />Mode Selection</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Set the Modbus TCP port and connection, or read the mode currently configured on the board.</p>
        </div>
        <button type="button" onClick={() => request('read')} disabled={!!pending || !canRead}
          className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <i className={pending === 'read' ? 'pi pi-spin pi-spinner' : 'pi pi-download'} aria-hidden="true" />
          {pending === 'read' ? 'Reading...' : 'Read Mode'}
        </button>
      </div>

      {notice && <p role="status" className={`p-3 rounded-lg border text-xs ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{notice.text}</p>}

      <form onSubmit={event => { event.preventDefault(); request('publish') }} noValidate className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
          <div className="space-y-2">
            <label htmlFor="tcp-mode-port" className="text-xs font-bold text-[var(--text-primary)]">Port number</label>
            <input id="tcp-mode-port" type="number" inputMode="numeric" min="1" max="65535" step="1" placeholder="e.g. 502"
              value={port} onChange={event => setPort(event.target.value)} disabled={!!pending || !canPublish}
              aria-describedby="tcp-mode-port-help"
              className="block w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-60" />
            <p id="tcp-mode-port-help" className="text-[11px] text-[var(--text-secondary)]">Enter a port from 1 to 65535.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="tcp-mode-connectivity" className="text-xs font-bold text-[var(--text-primary)]">Connectivity type</label>
            <select id="tcp-mode-connectivity" value={connectivity} onChange={event => setConnectivity(event.target.value)} disabled={!!pending || !canPublish}
              className="block w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-60">
              <option value="0">Ethernet</option><option value="1">WiFi</option>
            </select>
            <p className="text-[11px] text-[var(--text-secondary)]">Choose the connection for Modbus TCP.</p>
          </div>
        </div>
        <button type="submit" disabled={!!pending || !canPublish}
          className="px-5 py-2.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <i className={pending === 'publish' ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'} aria-hidden="true" />
          {pending === 'publish' ? 'Waiting for Board...' : 'Publish Mode'}
        </button>
        {(!canPublish || !canRead) && <p className="text-xs text-[var(--text-secondary)]">Your administrator controls access to publishing and reading gateway configuration.</p>}
      </form>

      {boardMode && <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wide font-bold text-[var(--text-secondary)]">Last mode read · {boardMode.readAt}</p>
        {boardMode.valid ? <p className="text-xs font-semibold text-[var(--text-primary)]">Port {boardMode.port} <span className="mx-2 text-[var(--text-secondary)]">·</span> {boardMode.connectivityType === 0 ? 'Ethernet' : 'WiFi'}</p>
          : <p className="text-xs text-[var(--text-secondary)] break-words">Board response: <span className="font-mono">{boardMode.raw || '(empty response)'}</span></p>}
      </div>}
      <CountdownModal visible={!!pending} title={pending === 'publish' ? 'Publishing Modbus TCP Mode' : 'Reading Modbus TCP Mode'}
        subtitle={pending === 'publish' ? 'Waiting for the board to acknowledge receipt...' : 'Waiting for the gateway to return its current mode...'} duration={10} onCancel={stopWaiting} />
    </section>
  )
}
