import { useState, useEffect, useCallback } from 'react'
import { Dialog } from 'primereact/dialog'
import { showToast } from '../../utils/toast'
import api from '../../services/axios'
import { companiesApi } from '../../services/companiesApi'
import { gatewaysApi } from '../../services/gatewaysApi'
import DynamicGraphRenderer from '../graphs/DynamicGraphRenderer'
import DynamicMeterRenderer from '../meters/DynamicMeterRenderer'
import HorizontalBarGauge from '../meters/HorizontalBarGauge'
import ReactPaginator from '../shared/ReactPaginator'
import { formatTagDisplayName } from '../../utils/tagUtils'

const PAGE_LIMIT = 8

export default function AdminVisualizationModal({
  visible,
  onHide,
  visualization, // { key, type: 'graph' | 'meter', metadata: { title, description, category/group, defaultProps } }
  onAssignmentChange
}) {
  const [companies, setCompanies] = useState([])
  const [gateways, setGateways] = useState([])

  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedGatewayId, setSelectedGatewayId] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Meter Range inputs
  const [meterMin, setMeterMin] = useState(0)
  const [meterMax, setMeterMax] = useState(100)
  const [meterIdle, setMeterIdle] = useState(0)
  const [meterColor, setMeterColor] = useState('#22c55e')

  // Tags Table state
  const [tags, setTags] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState(null)

  // Confirm Assign Pop-up Modal state
  const [confirmAssignDialog, setConfirmAssignDialog] = useState(false)
  const [targetTag, setTargetTag] = useState(null)
  const [submittingAssign, setSubmittingAssign] = useState(false)

  // Reset modal filter state whenever modal opens or visualization key changes
  useEffect(() => {
    if (visible) {
      setSelectedGatewayId('all')
      setSearchInput('')
      setSearch('')
      setPage(0)
      setMeterMin(0)
      setMeterMax(100)
      setMeterIdle(0)
      setMeterColor('#22c55e')
      setTags([])
      setTotalRecords(0)
      setActionLoadingId(null)
    }
  }, [visible, visualization?.key])

  // Load Companies list once modal opens
  useEffect(() => {
    if (!visible) return
    let isMounted = true
    const loadCompanies = async () => {
      try {
        const res = await companiesApi.getAll()
        if (isMounted) {
          const comps = res.companies || []
          setCompanies(comps)
          if (comps.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(comps[0]._id)
          }
        }
      } catch (err) {
        showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load companies' })
      }
    }
    loadCompanies()
    return () => { isMounted = false }
  }, [visible])

  // Load Gateways when selectedCompanyId changes
  useEffect(() => {
    if (!visible || !selectedCompanyId) {
      setGateways([])
      setTags([])
      setTotalRecords(0)
      return
    }
    let isMounted = true
    setGateways([])
    setTags([])
    setTotalRecords(0)
    setLoading(true)

    const loadGateways = async () => {
      try {
        const res = await gatewaysApi.getAll({ companyId: selectedCompanyId, limit: 500 })
        if (isMounted) {
          setGateways(res.gateways || [])
          setSelectedGatewayId('all')
        }
      } catch (err) {
        showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load gateways' })
      }
    }
    loadGateways()
    return () => { isMounted = false }
  }, [visible, selectedCompanyId])

  // Search input debouncer
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch telemetry tags for assignment table
  const fetchTags = useCallback(async (pNum = 1) => {
    if (!selectedCompanyId) {
      setTags([])
      setTotalRecords(0)
      return
    }
    try {
      setLoading(true)
      const params = {
        companyId: selectedCompanyId,
        page: pNum,
        limit: PAGE_LIMIT
      }
      if (selectedGatewayId && selectedGatewayId !== 'all') {
        params.gatewayId = selectedGatewayId
      }
      if (search) {
        params.search = search
      }

      const res = await api.get('/admin/visualizations/tags', { params })
      const fetchedTags = res.data.tags || []
      const fetchedTotal = res.data.total || 0

      setTags(fetchedTags)
      setTotalRecords(fetchedTotal)

      // Pagination stabilization fallback
      if (pNum > 1 && fetchedTags.length === 0 && fetchedTotal > 0) {
        const prevPage = Math.max(0, Math.ceil(fetchedTotal / PAGE_LIMIT) - 1)
        setPage(prevPage)
      }
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Error Loading Parameters',
        detail: err.response?.data?.message || err.message
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId, selectedGatewayId, search])

  useEffect(() => {
    if (visible && selectedCompanyId) {
      fetchTags(page + 1)
    }
  }, [visible, selectedCompanyId, selectedGatewayId, search, page, fetchTags])

  const handlePageChange = (e) => {
    setPage(e.page)
  }

  // Handle Assign / Replace / Remove Action Button Clicks
  const handleAssignAction = async (tag, actionType) => {
    if (!visualization) return
    const visKey = visualization.key
    const isMeter = visualization.type === 'meter'

    if (actionType === 'assign' || actionType === 'replace') {
      if (isMeter) {
        setTargetTag(tag)
        setMeterMin(tag.meterMin !== null && tag.meterMin !== undefined ? tag.meterMin : 0)
        setMeterMax(tag.meterMax !== null && tag.meterMax !== undefined ? tag.meterMax : 100)
        setMeterIdle(tag.meterIdle !== null && tag.meterIdle !== undefined ? tag.meterIdle : 0)
        setMeterColor(tag.meterColor || '#22c55e')
        setConfirmAssignDialog(true)
        return
      }
    }

    // Direct execution for graph assignment or clearing
    let payload = {
      companyId: selectedCompanyId,
      ...(selectedGatewayId && selectedGatewayId !== 'all' ? { gatewayId: selectedGatewayId } : {})
    }

    if (actionType === 'assign' || actionType === 'replace') {
      payload = {
        ...payload,
        type: 'graph',
        value: visKey
      }
    } else if (actionType === 'remove') {
      payload = {
        ...payload,
        type: isMeter ? 'clear_meter' : 'clear_graph'
      }
    }

    try {
      setActionLoadingId(tag._id)
      await api.put(`/admin/visualizations/tags/${tag._id}`, payload)
      showToast({
        severity: 'success',
        summary: 'Assignment Saved',
        detail: `Parameter "${tag.parameterName}" visualization assignment updated successfully`,
        life: 2500
      })
      fetchTags(page + 1)
      if (onAssignmentChange) onAssignmentChange()
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Save Failed',
        detail: err.response?.data?.message || err.message
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Execute meter assignment from pop-up dialog
  const executeAdminMeterAssignment = async () => {
    if (!targetTag || !visualization) return
    const visKey = visualization.key
    const minNum = meterMin === '' || isNaN(Number(meterMin)) ? 0 : Number(meterMin)
    const maxNum = meterMax === '' || isNaN(Number(meterMax)) ? 100 : Number(meterMax)
    const idleNum = meterIdle === '' || isNaN(Number(meterIdle)) ? 0 : Number(meterIdle)

    if (minNum >= maxNum) {
      showToast({ severity: 'warn', summary: 'Validation Warning', detail: 'Meter Minimum must be strictly less than Maximum' })
      return
    }

    const payload = {
      companyId: selectedCompanyId,
      ...(selectedGatewayId && selectedGatewayId !== 'all' ? { gatewayId: selectedGatewayId } : {}),
      type: 'meter',
      value: visKey,
      meterMin: minNum,
      meterMax: maxNum,
      meterIdle: idleNum,
      meterColor
    }

    try {
      setSubmittingAssign(true)
      setActionLoadingId(targetTag._id)
      await api.put(`/admin/visualizations/tags/${targetTag._id}`, payload)
      showToast({
        severity: 'success',
        summary: 'Assignment Saved',
        detail: `Digital Meter assigned to "${formatTagDisplayName(targetTag)}"`,
        life: 2500
      })
      setConfirmAssignDialog(false)
      fetchTags(page + 1)
      if (onAssignmentChange) onAssignmentChange()
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Save Failed',
        detail: err.response?.data?.message || err.message
      })
    } finally {
      setSubmittingAssign(false)
      setActionLoadingId(null)
    }
  }

  if (!visualization) return null

  const isMeter = visualization.type === 'meter'
  const selectedKey = visualization.key
  const meta = visualization.metadata || {}

  return (
    <>
      <Dialog
      header={
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-2.5">
            <i className={`pi ${isMeter ? 'pi-gauge' : 'pi-chart-line'} text-blue-600 text-lg`} />
            <div>
              <h3 className="text-sm font-bold text-slate-800">{meta.name || meta.title || selectedKey}</h3>
              <p className="text-[10px] text-slate-400 font-mono">Key: {selectedKey}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 border border-blue-100 uppercase tracking-wider">
            {isMeter ? 'Digital Meter' : 'Graph Analytics'} Assignment
          </span>
        </div>
      }
      visible={visible}
      onHide={onHide}
      draggable={false}
      resizable={false}
      style={{ width: '1050px', maxWidth: '96vw' }}
      className="rounded-none border border-slate-200"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Left Column: Preview & Metadata */}
        <div className="lg:col-span-4 space-y-4 border-r border-slate-200 pr-0 lg:pr-5">
          <div className="bg-slate-900 p-4 border border-slate-800 rounded-none shadow-inner flex flex-col gap-3 items-center justify-center min-h-[220px]">
            {isMeter ? (
              <>
                <DynamicMeterRenderer
                  type={selectedKey}
                  value={45}
                  customProps={{
                    label: meta.name || meta.title || selectedKey,
                    unit: meta.defaultProps?.unit || '°C',
                    min: Number(meterMin),
                    max: Number(meterMax)
                  }}
                />
                {selectedKey !== 'VERTICAL_BAR_IDLE' && selectedKey !== 'VERTICAL_BAR_NORMAL' && (
                  <HorizontalBarGauge
                    value={45}
                    min={Number(meterMin)}
                    max={Number(meterMax)}
                    unit={meta.defaultProps?.unit || '°C'}
                    color={meterColor}
                    label={meta.name || meta.title || selectedKey}
                  />
                )}
              </>
            ) : (
              <DynamicGraphRenderer
                type={selectedKey}
                masterVal={65}
              />
            )}
          </div>

          <div className="space-y-2 bg-slate-50/70 p-3 border border-slate-200 text-xs">
            <div className="font-bold text-slate-800">{meta.name || meta.title || selectedKey}</div>
            <p className="text-slate-600 leading-relaxed text-[11px] font-medium">
              {meta.description || 'Industrial IoT visualization component for real-time telemetry parameters.'}
            </p>
            {meta.category || meta.group ? (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-1">
                Category: <span className="text-slate-700">{meta.category || meta.group}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Column: Company/Gateway Filter & Assignment Table */}
        <div className="lg:col-span-8 space-y-4">
          {/* Step 1 & 2 Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3 border border-slate-200">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Select Company</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value)
                  setPage(0)
                }}
                className="w-full bg-white border border-slate-300 px-2.5 h-8.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="">-- Select Company --</option>
                {companies.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Filter Gateway</label>
              <select
                disabled={!selectedCompanyId}
                value={selectedGatewayId}
                onChange={(e) => {
                  setSelectedGatewayId(e.target.value)
                  setPage(0)
                }}
                className="w-full bg-white border border-slate-300 px-2.5 h-8.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-600 disabled:opacity-50"
              >
                <option value="all">All Gateways ({gateways.length})</option>
                {gateways.map(g => (
                  <option key={g._id} value={g._id}>{g.name} ({g.prefix})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Parameter Search Input */}
          <div className="flex items-center bg-white border border-slate-300 px-3 h-8.5 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-all">
            <i className="pi pi-search text-xs text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              disabled={!selectedCompanyId}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search parameter by name, display, device, or topic..."
              className="w-full text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-400 font-semibold disabled:opacity-50"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="text-slate-400 hover:text-slate-650 ml-1 cursor-pointer shrink-0"
              >
                <i className="pi pi-times text-[10px]" />
              </button>
            )}
          </div>

          {/* Parameters Assignment Table */}
          <div className="border border-slate-200 bg-white relative min-h-[260px] overflow-x-auto">
            {!selectedCompanyId ? (
              <div className="p-10 text-center space-y-2">
                <i className="pi pi-building text-slate-300 text-3xl" />
                <p className="text-xs font-semibold text-slate-500">Please select a Company to view parameters available for assignment.</p>
              </div>
            ) : loading ? (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2 z-10">
                <i className="pi pi-spin pi-spinner text-blue-600 text-lg" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Loading parameters...</span>
              </div>
            ) : tags.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <i className="pi pi-inbox text-slate-300 text-3xl" />
                <p className="text-xs font-semibold text-slate-500">No telemetry parameters found matching your filters.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-2.5">Parameter / Device</th>
                    <th className="p-2.5">Gateway</th>
                    <th className="p-2.5">Assigned Users</th>
                    <th className="p-2.5">Live Value</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tags.map((tag) => {
                    const currentAssigned = isMeter ? tag.assignedMeterType : tag.assignedGraphType
                    const isExactMatch = currentAssigned === selectedKey
                    const hasOtherView = Boolean(currentAssigned && !isExactMatch)

                    return (
                      <tr key={tag._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-800" title={formatTagDisplayName(tag)}>
                            {formatTagDisplayName(tag)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium truncate">
                            Dev: <span className="text-slate-600 font-semibold">{tag.deviceName}</span> | Tag: <span className="text-slate-500 font-mono">{tag.parameterName}</span>
                          </div>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700">
                          {tag.gateway?.name || 'N/A'}
                        </td>
                        <td className="p-2.5">
                          {tag.assignedUsers.length === 0 ? (
                            <span className="text-slate-400 italic text-[10px]">Unassigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {tag.assignedUsers.map(u => (
                                <span key={u._id} className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold" title={u.name}>
                                  {u.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-800 font-bold">
                          {tag.liveValue !== null ? `${tag.liveValue} ${tag.unit}` : 'N/A'}
                        </td>
                        <td className="p-2.5">
                          {isExactMatch ? (
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] uppercase tracking-wider">
                              Assigned
                            </span>
                          ) : hasOtherView ? (
                            <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] uppercase tracking-wider" title={`Current: ${currentAssigned}`}>
                              Other View
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                              Default
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {isExactMatch ? (
                            <button
                              type="button"
                              disabled={actionLoadingId === tag._id}
                              onClick={() => handleAssignAction(tag, 'remove')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
                            >
                              {actionLoadingId === tag._id ? <i className="pi pi-spin pi-spinner text-[10px]" /> : 'Remove'}
                            </button>
                          ) : hasOtherView ? (
                            <button
                              type="button"
                              disabled={actionLoadingId === tag._id}
                              onClick={() => handleAssignAction(tag, 'replace')}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
                            >
                              {actionLoadingId === tag._id ? <i className="pi pi-spin pi-spinner text-[10px]" /> : 'Replace'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={actionLoadingId === tag._id}
                              onClick={() => handleAssignAction(tag, 'assign')}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all shadow-xs disabled:opacity-50"
                            >
                              {actionLoadingId === tag._id ? <i className="pi pi-spin pi-spinner text-[10px]" /> : 'Assign'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {selectedCompanyId && totalRecords > PAGE_LIMIT && (
            <ReactPaginator
              totalRecords={totalRecords}
              rows={PAGE_LIMIT}
              first={page * PAGE_LIMIT}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </Dialog>

    {/* Admin Meter Range Config Pop-Up Modal */}
    <Dialog
      header={
        <div className="flex items-center gap-2">
          <i className="pi pi-sliders-h text-blue-600" />
          <span className="text-sm font-bold text-slate-800">
            Set Meter Min &amp; Max Range
          </span>
        </div>
      }
      visible={confirmAssignDialog}
      onHide={() => setConfirmAssignDialog(false)}
      draggable={false}
      style={{ width: '420px' }}
      className="rounded-none border border-slate-200"
    >
      <div className="space-y-4 pt-1.5">
        <div className="bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
          <div className="font-bold text-slate-800">{formatTagDisplayName(targetTag)}</div>
          <div className="text-slate-400 font-mono text-[10px]">Assigning: {meta.name || meta.title || selectedKey} ({selectedKey})</div>
        </div>

        <div className={`grid ${selectedKey === 'VERTICAL_BAR_IDLE' ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Minimum Value
            </label>
            <input
              type="number"
              value={meterMin === '' ? '' : meterMin}
              onChange={(e) => setMeterMin(e.target.value)}
              className="w-full border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 px-3 py-2 text-xs font-mono font-bold"
            />
          </div>
          {selectedKey === 'VERTICAL_BAR_IDLE' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Idle Value
              </label>
              <input
                type="number"
                value={meterIdle === '' ? '' : meterIdle}
                onChange={(e) => setMeterIdle(e.target.value)}
                className="w-full border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Maximum Value
            </label>
            <input
              type="number"
              value={meterMax === '' ? '' : meterMax}
              onChange={(e) => setMeterMax(e.target.value)}
              className="w-full border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 px-3 py-2 text-xs font-mono font-bold"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Bar / Meter Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={meterColor}
              onChange={(e) => setMeterColor(e.target.value)}
              className="w-9 h-9 border border-slate-200 rounded cursor-pointer p-0.5"
            />
            <div className="flex gap-1.5 flex-wrap">
              {['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#10b981', '#facc15'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMeterColor(c)}
                  className="w-5 h-5 rounded-full border cursor-pointer transition-transform hover:scale-110"
                  style={{ background: c, borderColor: meterColor === c ? '#1e293b' : 'transparent' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <button
            onClick={() => setConfirmAssignDialog(false)}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={executeAdminMeterAssignment}
            disabled={submittingAssign}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submittingAssign && <i className="pi pi-spin pi-spinner text-xs" />}
            Confirm Assignment
          </button>
        </div>
      </div>
    </Dialog>
    </>
  )
}
