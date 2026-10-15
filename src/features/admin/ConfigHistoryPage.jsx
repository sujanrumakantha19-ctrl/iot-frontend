import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { gatewaysApi } from '../../services/gatewaysApi'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

const BAUD_RATES = [110, 300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

const getBaudRateFromIndex = (index) => {
  const idx = Number(index) - 1
  return BAUD_RATES[idx] || 9600
}

const getDataTypeForUi = (type) => {
  if (!type) return 'Int'
  const t = type.trim().toLowerCase()
  if (t === 'f' || t === 'float') return 'Float'
  return 'Int'
}

const mapDbToUiRow = (r) => {
  if (!r) return {}
  const parityChar = { 0: 'N', 1: 'E', 2: 'O' }[r.parity] || 'N'
  const serialConfig = r.serialConfig || `${r.dataBits || 8}${parityChar}${r.stopBits || 1}`
  return {
    ...r,
    dataType: getDataTypeForUi(r.dataType),
    baudRate: getBaudRateFromIndex(r.baudRate),
    decimal: r.decimal === 0 || r.decimal === undefined ? 'None' : String(r.decimal),
    serialConfig
  }
}

export default function ConfigHistoryPage() {
  const { companyId, gatewayId } = useParams()
  const [loading, setLoading] = useState(true)
  const [gateway, setGateway] = useState(null)
  const [history, setHistory] = useState([])
  const [selectedConfig, setSelectedConfig] = useState(null)
  const [configDetail, setConfigDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { gateways: gwList } = await gatewaysApi.getAll()
        const matchGw = gwList.find(g => g._id === gatewayId)
        if (!matchGw) throw new Error('Gateway not found')
        setGateway(matchGw)

        const list = await gatewaysApi.getConfigHistory(gatewayId)
        setHistory(list)
      } catch (err) {
        showToast({ severity: 'error', summary: 'Error', detail: err.message })
      } finally {
        setLoading(false)
      }
    }
    if (companyId && gatewayId) load()
  }, [companyId, gatewayId])

  const handleSelectVersion = async (configId) => {
    try {
      setLoadingDetail(true)
      setSelectedConfig(configId)
      const detail = await gatewaysApi.getConfigDetail(gatewayId, configId)
      
      if (detail) {
        if (detail.rows) {
          detail.rows = detail.rows.map(r => mapDbToUiRow(r))
        }
        if (detail.groups) {
          detail.groups = detail.groups.map(g => ({
            ...g,
            rows: g.rows ? g.rows.map(r => mapDbToUiRow(r)) : []
          }))
        }
      }

      setConfigDetail(detail)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    } finally {
      setLoadingDetail(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading config history..." />
  if (!gateway) return <div className="p-6 text-center text-slate-450">Gateway not found.</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-100px)]">
        {/* === Left panel: Published Versions list === */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 shadow-sm flex flex-col min-h-0">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 shrink-0">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Published Versions</h3>
          </div>
          {history.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <i className="pi pi-history text-3xl text-slate-300 mb-3 block" />
                <p className="text-sm font-semibold text-slate-400">No configuration history yet</p>
                <p className="text-xs text-slate-300 mt-1">Published configs will appear here</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {history.map((item) => {
                const isSelected = selectedConfig === item._id
                const statusColor = item.publishStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : item.publishStatus === 'failed'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                const paramCount = item.rows?.length || 0
                const deviceNames = [...new Set(item.rows?.map(r => r.deviceName).filter(Boolean) || [])]

                return (
                  <button
                    key={item._id}
                    onClick={() => handleSelectVersion(item._id)}
                    className={`w-full text-left p-4 border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">v{item.version || item._id.slice(-6)}</span>
                          {item.groupCount > 1 && (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5">{item.groupCount} groups</span>
                          )}
                        </div>
                        {item.publishedAt && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            {new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            <span className="mx-1">·</span>
                            {new Date(item.publishedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          {paramCount} parameter{paramCount !== 1 ? 's' : ''}
                          {deviceNames.length > 0 && (
                            <>
                              <span className="mx-1">·</span>
                              {deviceNames.slice(0, 2).join(', ')}
                              {deviceNames.length > 2 && '...'}
                            </>
                          )}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 border ${statusColor}`}>
                        {item.publishStatus || 'pending'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* === Right panel: Config Detail === */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 shadow-sm flex flex-col min-h-0">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 shrink-0">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Config Detail</h3>
          </div>

          {!selectedConfig ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <i className="pi pi-file-search text-3xl text-slate-300 mb-3 block" />
                <p className="text-sm font-semibold text-slate-400">Select a version to view details</p>
                <p className="text-xs text-slate-300 mt-1">Click on a published version from the left panel</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              <i className="pi pi-spin pi-spinner mr-2" />Loading...
            </div>
          ) : configDetail ? (
            <div className="flex-1 overflow-y-auto">
              {/* Metadata card */}
              <div className="p-5 border-b border-slate-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Status</p>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 border ${
                      configDetail.publishStatus === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : configDetail.publishStatus === 'failed'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {configDetail.publishStatus || 'pending'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Groups</p>
                    <p className="text-sm font-bold text-slate-800">{configDetail.groupCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Parameters</p>
                    <p className="text-sm font-bold text-slate-800">{configDetail.rows?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Published</p>
                    <p className="text-sm font-bold text-slate-800">{configDetail.publishedAt ? new Date(configDetail.publishedAt).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
                {configDetail.publishError && (
                  <div className="mt-4 bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                    <i className="pi pi-exclamation-circle text-red-500 mt-0.5 text-xs" />
                    <div>
                      <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Publish Error</p>
                      <p className="text-xs text-red-600 mt-0.5">{configDetail.publishError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Groups / Rows */}
              <div className="p-5 space-y-5">
                {configDetail.groups && configDetail.groups.length > 0 ? (
                  configDetail.groups.map((group, gi) => (
                    <div key={gi} className="border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="pi pi-folder text-blue-400 text-xs" />
                          <span className="text-xs font-bold text-slate-700">g{gi + 1}</span>
                          <span className="text-[10px] text-slate-400">({group.rows?.length || 0} parameters)</span>
                        </div>
                      </div>
                      {group.rows && group.rows.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-white border-b border-slate-100">
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Param</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Device</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Slave</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">FC</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Addr</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Type</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Len</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Scale</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Dec</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Baud</th>
                                <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Serial</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {group.rows.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="px-3 py-2 font-mono font-bold text-slate-500 text-[11px]">{r.parameterName}</td>
                                  <td className="px-3 py-2 text-slate-700 text-[11px]">{r.deviceName}</td>
                                  <td className="px-3 py-2 font-mono text-slate-700 text-[11px]">{r.slaveId}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.functionCode}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.address}</td>
                                  <td className="px-3 py-2 text-slate-600 text-[11px]">{r.dataType}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.length}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.scaleFactor}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.decimal || 'None'}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.baudRate}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.serialConfig || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                ) : configDetail.rows && configDetail.rows.length > 0 ? (
                  <div className="border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-500">Legacy single-group format</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-white border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Param</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Device</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Slave</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">FC</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Addr</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Type</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Len</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Scale</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Dec</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Baud</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px]">Serial</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {configDetail.rows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-mono font-bold text-slate-500 text-[11px]">{r.parameterName}</td>
                              <td className="px-3 py-2 text-slate-700 text-[11px]">{r.deviceName}</td>
                              <td className="px-3 py-2 font-mono text-slate-700 text-[11px]">{r.slaveId}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.functionCode}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.address}</td>
                              <td className="px-3 py-2 text-slate-600 text-[11px]">{r.dataType}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.length}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.scaleFactor}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.decimal || 'None'}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.baudRate}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{r.serialConfig || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <i className="pi pi-inbox text-2xl text-slate-300 mb-2 block" />
                    <p className="text-xs text-slate-400">No parameter data in this version</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Failed to load config detail</div>
          )}
        </div>
      </div>
    </div>
  )
}
