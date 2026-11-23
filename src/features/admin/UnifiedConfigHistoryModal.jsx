import { useState, useEffect } from 'react'
import { gatewaysApi } from '../../services/gatewaysApi'
import { tcpGatewaysApi } from '../../services/tcpGatewaysApi'
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

export default function UnifiedConfigHistoryModal({ visible, onHide, gatewayId, gateway, initialTab = 'RTU' }) {
  const [activeTab, setActiveTab] = useState(initialTab)

  // RTU State
  const [rtuLoading, setRtuLoading] = useState(false)
  const [rtuHistory, setRtuHistory] = useState([])
  const [selectedRtuId, setSelectedRtuId] = useState(null)
  const [rtuDetail, setRtuDetail] = useState(null)
  const [rtuDetailLoading, setRtuDetailLoading] = useState(false)

  // TCP State
  const [tcpLoading, setTcpLoading] = useState(false)
  const [tcpHistory, setTcpHistory] = useState([])
  const [selectedTcpConfig, setSelectedTcpConfig] = useState(null)

  useEffect(() => {
    if (!visible || !gatewayId) return

    setActiveTab(initialTab)

    // Load RTU History
    const loadRtu = async () => {
      setRtuLoading(true)
      try {
        const list = await gatewaysApi.getConfigHistory(gatewayId)
        setRtuHistory(list || [])
        if (list && list.length > 0) {
          handleSelectRtuVersion(list[0]._id)
        } else {
          setSelectedRtuId(null)
          setRtuDetail(null)
        }
      } catch (err) {
        showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load RTU history' })
      } finally {
        setRtuLoading(false)
      }
    }

    // Load TCP History
    const loadTcp = async () => {
      setTcpLoading(true)
      try {
        const res = await tcpGatewaysApi.history(gatewayId)
        const list = res.history || []
        setTcpHistory(list)
        if (list && list.length > 0) {
          setSelectedTcpConfig(list[0])
        } else {
          setSelectedTcpConfig(null)
        }
      } catch (err) {
        showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load TCP history' })
      } finally {
        setTcpLoading(false)
      }
    }

    loadRtu()
    loadTcp()
  }, [visible, gatewayId, initialTab])

  const handleSelectRtuVersion = async (configId) => {
    setRtuDetailLoading(true)
    setSelectedRtuId(configId)
    try {
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
      setRtuDetail(detail)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load RTU version details' })
    } finally {
      setRtuDetailLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5">
      <div className="bg-white w-[96vw] max-w-[1300px] h-[90vh] flex flex-col shadow-2xl border border-slate-200 rounded-xl overflow-hidden animate-fade-in">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <i className="pi pi-history text-base" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Configuration History
                {gateway?.prefix && (
                  <span className="text-xs font-mono font-normal bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded">
                    {gateway.prefix}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect published configuration versions and parameter groups for Modbus RTU and Modbus TCP.
              </p>
            </div>
          </div>
          <button
            onClick={onHide}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all shrink-0"
            title="Close"
          >
            <i className="pi pi-times text-xs" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-4 px-6 pt-2 border-b border-slate-200 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('RTU')}
            className={`pb-3 pt-2 font-bold text-xs flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
              activeTab === 'RTU'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className="pi pi-sliders-h text-xs" />
            <span>Modbus RTU</span>
            {rtuHistory.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === 'RTU' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {rtuHistory.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TCP')}
            className={`pb-3 pt-2 font-bold text-xs flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
              activeTab === 'TCP'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className="pi pi-globe text-xs" />
            <span>Modbus TCP</span>
            {tcpHistory.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === 'TCP' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {tcpHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content: Split View */}
        <div className="flex-1 min-h-0 overflow-hidden bg-slate-50/50">

          {/* ======================= RTU TAB ======================= */}
          {activeTab === 'RTU' && (
            rtuLoading ? (
              <div className="h-full flex items-center justify-center">
                <LoadingSpinner text="Loading Modbus RTU history..." />
              </div>
            ) : (
              <div className="h-full grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Left: Published Versions List */}
                <div className="lg:col-span-2 flex flex-col h-full bg-white overflow-hidden min-h-0">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      RTU Published Versions ({rtuHistory.length})
                    </span>
                  </div>

                  {rtuHistory.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center">
                      <div>
                        <i className="pi pi-history text-3xl text-slate-300 mb-2 block" />
                        <p className="text-xs font-semibold text-slate-400">No RTU configuration history</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {rtuHistory.map((item) => {
                        const isSelected = selectedRtuId === item._id
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
                            type="button"
                            onClick={() => handleSelectRtuVersion(item._id)}
                            className={`w-full text-left p-3.5 border rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-400 bg-blue-50/70 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">v{item.version || item._id.slice(-6)}</span>
                                  {item.groupCount > 1 && (
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {item.groupCount} groups
                                    </span>
                                  )}
                                </div>
                                {item.publishedAt && (
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    {new Date(item.publishedAt).toLocaleString()}
                                  </p>
                                )}
                                <p className="text-[11px] text-slate-500 mt-1">
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
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                                {item.publishStatus || 'pending'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right: RTU Version Detail */}
                <div className="lg:col-span-3 flex flex-col h-full bg-white overflow-hidden min-h-0">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      RTU Configuration Details
                    </span>
                  </div>

                  {!selectedRtuId ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center">
                      <div>
                        <i className="pi pi-file-search text-3xl text-slate-300 mb-2 block" />
                        <p className="text-xs font-semibold text-slate-400">Select a version from the left panel</p>
                      </div>
                    </div>
                  ) : rtuDetailLoading ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                      <i className="pi pi-spin pi-spinner mr-2" />Loading configuration details...
                    </div>
                  ) : rtuDetail ? (
                    <div className="flex-1 overflow-y-auto">
                      {/* Metadata */}
                      <div className="p-4 border-b border-slate-100 bg-slate-50/40">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Status</p>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                              rtuDetail.publishStatus === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rtuDetail.publishStatus === 'failed'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {rtuDetail.publishStatus || 'pending'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Groups</p>
                            <p className="text-xs font-bold text-slate-800">{rtuDetail.groupCount || rtuDetail.groups?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Parameters</p>
                            <p className="text-xs font-bold text-slate-800">{rtuDetail.rows?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Published</p>
                            <p className="text-xs font-bold text-slate-800">{rtuDetail.publishedAt ? new Date(rtuDetail.publishedAt).toLocaleString() : 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Groups & Tables */}
                      <div className="p-4 space-y-4">
                        {rtuDetail.groups && rtuDetail.groups.length > 0 ? (
                          rtuDetail.groups.map((group, gi) => (
                            <div key={gi} className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <i className="pi pi-folder text-blue-400 text-xs" />
                                  <span className="text-xs font-bold text-slate-700">Group {group.groupNum || gi + 1}</span>
                                  <span className="text-[10px] text-slate-400">({group.rows?.length || 0} parameters)</span>
                                </div>
                              </div>
                              {group.rows && group.rows.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-white border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        <th className="px-3 py-2 text-left">Param</th>
                                        <th className="px-3 py-2 text-left">Device</th>
                                        <th className="px-3 py-2 text-left">Slave</th>
                                        <th className="px-3 py-2 text-left">FC</th>
                                        <th className="px-3 py-2 text-left">Addr</th>
                                        <th className="px-3 py-2 text-left">Type</th>
                                        <th className="px-3 py-2 text-left">Len</th>
                                        <th className="px-3 py-2 text-left">Scale</th>
                                        <th className="px-3 py-2 text-left">Dec</th>
                                        <th className="px-3 py-2 text-left">Baud</th>
                                        <th className="px-3 py-2 text-left">Config</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                                      {group.rows.map((row, ri) => (
                                        <tr key={ri} className="hover:bg-slate-50/60">
                                          <td className="px-3 py-1.5 font-bold text-blue-600">{row.parameterName}</td>
                                          <td className="px-3 py-1.5 text-slate-700">{row.deviceName}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.slaveId}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.functionCode}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-600">{row.address}</td>
                                          <td className="px-3 py-1.5 text-slate-600">{row.dataType}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{row.length}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{row.scaleFactor ?? 1}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{row.decimal ?? 'None'}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{row.baudRate}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.serialConfig}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 p-4 text-center">No group parameter details recorded for this version.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          )}

          {/* ======================= TCP TAB ======================= */}
          {activeTab === 'TCP' && (
            tcpLoading ? (
              <div className="h-full flex items-center justify-center">
                <LoadingSpinner text="Loading Modbus TCP history..." />
              </div>
            ) : (
              <div className="h-full grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Left: Published TCP Versions */}
                <div className="lg:col-span-2 flex flex-col h-full bg-white overflow-hidden min-h-0">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      TCP Published Versions ({tcpHistory.length})
                    </span>
                  </div>

                  {tcpHistory.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center">
                      <div>
                        <i className="pi pi-history text-3xl text-slate-300 mb-2 block" />
                        <p className="text-xs font-semibold text-slate-400">No TCP configuration history</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {tcpHistory.map((item) => {
                        const isSelected = selectedTcpConfig?._id === item._id
                        const statusColor = item.publishStatus === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : item.publishStatus === 'failed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        const totalParams = item.groups?.reduce((sum, g) => sum + (g.rows?.length || 0), 0) || 0

                        return (
                          <button
                            key={item._id}
                            type="button"
                            onClick={() => setSelectedTcpConfig(item)}
                            className={`w-full text-left p-3.5 border rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-400 bg-blue-50/70 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">v{item.version || item._id.slice(-6)}</span>
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.groupCount || item.groups?.length || 0} groups
                                  </span>
                                </div>
                                {item.createdAt && (
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    {new Date(item.createdAt).toLocaleString()}
                                  </p>
                                )}
                                <p className="text-[11px] text-slate-500 mt-1">
                                  {totalParams} parameter{totalParams !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                                {item.publishStatus || 'pending'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right: TCP Version Detail */}
                <div className="lg:col-span-3 flex flex-col h-full bg-white overflow-hidden min-h-0">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      TCP Configuration Details
                    </span>
                  </div>

                  {!selectedTcpConfig ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center">
                      <div>
                        <i className="pi pi-file-search text-3xl text-slate-300 mb-2 block" />
                        <p className="text-xs font-semibold text-slate-400">Select a TCP version from the left panel</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {/* Metadata */}
                      <div className="p-4 border-b border-slate-100 bg-slate-50/40">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Status</p>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                              selectedTcpConfig.publishStatus === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : selectedTcpConfig.publishStatus === 'failed'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {selectedTcpConfig.publishStatus || 'pending'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Groups</p>
                            <p className="text-xs font-bold text-slate-800">{selectedTcpConfig.groupCount || selectedTcpConfig.groups?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Total Parameters</p>
                            <p className="text-xs font-bold text-slate-800">
                              {selectedTcpConfig.groups?.reduce((sum, g) => sum + (g.rows?.length || 0), 0) || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Saved At</p>
                            <p className="text-xs font-bold text-slate-800">{selectedTcpConfig.createdAt ? new Date(selectedTcpConfig.createdAt).toLocaleString() : 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Groups & Tables */}
                      <div className="p-4 space-y-4">
                        {selectedTcpConfig.groups && selectedTcpConfig.groups.length > 0 ? (
                          selectedTcpConfig.groups.map((group) => (
                            <div key={group.groupNum} className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <i className="pi pi-folder text-blue-400 text-xs" />
                                  <span className="text-xs font-bold text-slate-700">Group G{group.groupNum}</span>
                                  <span className="text-[10px] text-slate-400">({group.rows?.length || 0} parameters)</span>
                                </div>
                              </div>
                              {group.rows && group.rows.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-white border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        <th className="px-3 py-2 text-left">Param</th>
                                        <th className="px-3 py-2 text-left">Device</th>
                                        <th className="px-3 py-2 text-left">IP Address</th>
                                        <th className="px-3 py-2 text-left">Slave</th>
                                        <th className="px-3 py-2 text-left">FC</th>
                                        <th className="px-3 py-2 text-left">Addr</th>
                                        <th className="px-3 py-2 text-left">Type</th>
                                        <th className="px-3 py-2 text-left">Len</th>
                                        <th className="px-3 py-2 text-left">Scale</th>
                                        <th className="px-3 py-2 text-left">Dec</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                                      {group.rows.map((row, ri) => (
                                        <tr key={ri} className="hover:bg-slate-50/60">
                                          <td className="px-3 py-1.5 font-bold text-blue-600">{row.parameterName}</td>
                                          <td className="px-3 py-1.5 text-slate-700">{row.deviceName}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.ipAddress || '-'}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.slaveId}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.functionCode}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-600">{row.address}</td>
                                          <td className="px-3 py-1.5 text-slate-600">{row.dataType === 'f' || row.dataType === 'Float' ? 'Float' : 'Int'}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{row.length}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{row.scaleFactor ?? 1}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{row.decimal ?? 'None'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 p-4 text-center">No group parameter details recorded for this TCP version.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 px-6 py-3 shrink-0 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            Active Mode: {activeTab === 'RTU' ? 'Modbus RTU Configuration' : 'Modbus TCP Configuration'}
          </span>
          <button
            type="button"
            onClick={onHide}
            className="px-4 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg cursor-pointer transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
