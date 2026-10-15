import { useState, useEffect, useMemo } from 'react'
import { Dialog } from 'primereact/dialog'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import ReactPaginator from '../../components/shared/ReactPaginator'
import DynamicGraphRenderer, { GRAPH_REGISTRY } from '../../components/graphs/DynamicGraphRenderer'
import DynamicMeterRenderer, { METER_REGISTRY } from '../../components/meters/DynamicMeterRenderer'
import { assignApi } from '../../services/assignApi'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import { formatTagDisplayName } from '../../utils/tagUtils'

import { getSession } from '../../services/auth'

export default function AssignPage() {
  const session = getSession()
  const isRestricted = session?.assignPermissionMode === 'restrict'
  const isLimited = session?.assignPermissionMode === 'limit'
  const allowedGraphIds = session?.allowedGraphIds || []
  const allowedMeterTypes = session?.allowedMeterTypes || []

  const [activeTab, setActiveTab] = useState('graphs') // 'graphs' | 'meters'
  const [masterVal, setMasterVal] = useState(65)

  // Employees data
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // Selection & Modal States
  const [previewModal, setPreviewModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null) // { type: 'graph'|'meter', id, name, category, group }

  // Parameter Assignment Modal States (inside preview modal)
  const [selectedEmpId, setSelectedEmpId] = useState('all') // 'all' or empId
  const [tags, setTags] = useState([])
  const [tagsTotal, setTagsTotal] = useState(0)
  const [tagsPage, setTagsPage] = useState(1)
  const [tagsSearch, setTagsSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loadingTags, setLoadingTags] = useState(false)
  const TAGS_PAGE_SIZE = 10

  // Min/Max Input Dialog state when assigning meter
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [targetTag, setTargetTag] = useState(null)
  const [meterMin, setMeterMin] = useState(0)
  const [meterMax, setMeterMax] = useState(100)
  const [meterIdle, setMeterIdle] = useState(0)
  const [meterColor, setMeterColor] = useState('#22c55e')
  const [submittingAssign, setSubmittingAssign] = useState(false)

  // Live simulation ticker for showcase preview
  useEffect(() => {
    const timer = setInterval(() => {
      setMasterVal(prev => {
        const delta = (Math.random() - 0.5) * 6
        return Math.max(10, Math.min(120, Number((prev + delta).toFixed(1))))
      })
    }, 1500)
    return () => clearInterval(timer)
  }, [])

  // Load managed employees
  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true)
      const data = await assignApi.getAssignEmployees()
      setEmployees(data || [])
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load employees list' })
    } finally {
      setLoadingEmployees(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  // Debounce parameter search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(tagsSearch)
    }, 400)
    return () => clearTimeout(handler)
  }, [tagsSearch])

  // Load tags when selected employee, page, or search changes
  const loadTags = async (empId, page, searchStr) => {
    try {
      setLoadingTags(true)
      const res = await assignApi.getAssignTags(empId, page, TAGS_PAGE_SIZE, searchStr)
      setTags(res.tags || [])
      setTagsTotal(res.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load parameters' })
    } finally {
      setLoadingTags(false)
    }
  }

  useEffect(() => {
    if (previewModal) {
      loadTags(selectedEmpId, tagsPage, debouncedSearch)
    }
  }, [selectedEmpId, tagsPage, debouncedSearch, previewModal])

  // Open Preview & Assignment Modal for a selected graph or meter
  const handleCardClick = (item) => {
    setSelectedItem(item)
    setSelectedEmpId('all')
    setTagsPage(1)
    setTagsSearch('')
    setDebouncedSearch('')
    setPreviewModal(true)
  }

  const handleAssignClick = (tag) => {
    setTargetTag(tag)
    if (selectedItem?.type === 'meter') {
      const isIdleMeter = selectedItem.id === 'VERTICAL_BAR_IDLE'
      let defaultMin = tag.meterMin !== null && tag.meterMin !== undefined ? tag.meterMin : (isIdleMeter ? -100 : 0)
      let defaultIdle = tag.meterIdle !== null && tag.meterIdle !== undefined ? tag.meterIdle : 0
      let defaultMax = tag.meterMax !== null && tag.meterMax !== undefined ? tag.meterMax : 100

      if (isIdleMeter && defaultMin >= defaultIdle && defaultIdle === 0) {
        defaultMin = -Math.abs(defaultMax) || -100
      }

      setMeterMin(defaultMin)
      setMeterMax(defaultMax)
      setMeterIdle(defaultIdle)
      setMeterColor(tag.meterColor || '#22c55e')
      setConfirmDialog(true)
    } else {
      // Direct graph assignment confirmation
      executeAssignment(tag, selectedItem.type, selectedItem.id, null, null, null, null)
    }
  }

  // Execute actual API assignment call
  const executeAssignment = async (tag, type, value, min, max, color, idle) => {
    try {
      setSubmittingAssign(true)
      const res = await assignApi.assignVisualization(tag.tagId || tag._id, type, value, min, max, color, idle)
      showToast({
        severity: 'success',
        summary: 'Success',
        detail: `${type === 'graph' ? 'Graph' : 'Digital Meter'} assigned to "${formatTagDisplayName(tag)}"`
      })
      // Update tag in local state
      setTags(prev =>
        prev.map(t => (t.tagId === tag.tagId || t._id === tag._id ? { ...t, ...res.tag } : t))
      )
      setConfirmDialog(false)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || err.message || 'Assignment failed' })
    } finally {
      setSubmittingAssign(false)
    }
  }

  // Clear visualization assignment
  const handleClearAssignment = async (tag, clearType) => {
    try {
      const res = await assignApi.assignVisualization(tag.tagId || tag._id, clearType, null)
      showToast({ severity: 'info', summary: 'Cleared', detail: 'Visualization assignment removed' })
      setTags(prev =>
        prev.map(t => (t.tagId === tag.tagId || t._id === tag._id ? { ...t, ...res.tag } : t))
      )
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to clear assignment' })
    }
  }

  // Lists of graphs & meters from registries
  const graphsList = useMemo(() => {
    let list = Object.values(GRAPH_REGISTRY).map(g => ({
      type: 'graph',
      id: g.id,
      name: g.name,
      category: g.category
    }))
    if (isLimited) {
      list = list.filter(g => allowedGraphIds.includes(g.id))
    }
    return list
  }, [isLimited, allowedGraphIds])

  const metersList = useMemo(() => {
    let list = Object.values(METER_REGISTRY).map(m => ({
      type: 'meter',
      id: m.id,
      name: m.name,
      category: m.category,
      group: m.group
    }))
    if (isLimited) {
      list = list.filter(m => allowedMeterTypes.includes(m.id))
    }
    return list
  }, [isLimited, allowedMeterTypes])

  if (isRestricted) {
    return (
      <div className="bg-white border border-slate-200/80 p-8 sm:p-12 text-center rounded-xl space-y-4 shadow-sm my-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
          <i className="pi pi-ban" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Visualization Assignment Restricted</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
            Access to the Visualization Assignment Center has been restricted for your manager account by your Administrator. Please contact your system administrator to adjust your permissions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="bg-white border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <i className="pi pi-link text-purple-600" />
            Visualization Assignment Center
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Assign custom graphs and digital meters to telemetry parameters for your operational team
          </p>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="flex bg-slate-100 p-1 border border-slate-200 shrink-0">
          <button
            onClick={() => setActiveTab('graphs')}
            className={`px-4 py-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'graphs'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <i className="pi pi-chart-line" />
            Graphs ({graphsList.length})
          </button>
          <button
            onClick={() => setActiveTab('meters')}
            className={`px-4 py-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'meters'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <i className="pi pi-gauge" />
            Digital Meters ({metersList.length})
          </button>
        </div>
      </div>

      {/* Grid of Showcase Cards */}
      {activeTab === 'graphs' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {graphsList.map((g) => (
            <div
              key={g.id}
              onClick={() => handleCardClick(g)}
              className="bg-white border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 group-hover:bg-purple-50/30 transition-colors">
                <div>
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest block">
                    {g.category}
                  </span>
                  <h3 className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                    {g.name}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 uppercase tracking-wider group-hover:bg-purple-600 group-hover:text-white transition-all">
                  Assign &rarr;
                </span>
              </div>
              <div className="p-3 bg-slate-900/5 flex-1 min-h-[190px] flex items-center justify-center relative">
                <DynamicGraphRenderer type={g.id} masterVal={masterVal} height="180px" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {metersList.map((m) => (
            <div
              key={m.id}
              onClick={() => handleCardClick(m)}
              className="bg-white border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 group-hover:bg-purple-50/30 transition-colors">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">
                    {m.category}
                  </span>
                  <h3 className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors truncate max-w-[180px]">
                    {m.name}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 uppercase tracking-wider group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  Assign &rarr;
                </span>
              </div>
              <div className="p-4 bg-slate-900/90 flex-1 min-h-[190px] flex items-center justify-center relative">
                <DynamicMeterRenderer type={m.id} value={masterVal} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Preview & Parameter Assignment Modal */}
      <Dialog
        header={
          <div className="flex items-center gap-3">
            <i className={`text-lg ${selectedItem?.type === 'graph' ? 'pi pi-chart-line text-purple-600' : 'pi pi-gauge text-emerald-600'}`} />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Assign {selectedItem?.name}
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {selectedItem?.category} ({selectedItem?.type})
              </span>
            </div>
          </div>
        }
        visible={previewModal}
        onHide={() => setPreviewModal(false)}
        draggable={false}
        style={{ width: '92vw', height: '90vh' }}
        contentStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 0, overflow: 'hidden' }}
        contentClassName="scrollbar-none"
        className="max-w-none rounded-none border border-slate-200"
      >
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden h-full">
          {/* Left / Top: Interactive Live Preview Card */}
          <div className="w-full lg:w-5/12 bg-slate-900 p-6 flex flex-col justify-between overflow-y-auto scrollbar-none shrink-0 lg:h-full">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Live Component Preview
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Simulated Live Output
                </span>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center flex-1 min-h-[380px] rounded-xl overflow-hidden shadow-inner my-auto">
                {selectedItem?.type === 'graph' ? (
                  <DynamicGraphRenderer type={selectedItem.id} masterVal={masterVal} height="380px" />
                ) : (
                  <DynamicMeterRenderer type={selectedItem?.id} value={masterVal} />
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-slate-400 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span>Component ID:</span>
                <span className="text-purple-400 font-bold">{selectedItem?.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="text-slate-200">{selectedItem?.category}</span>
              </div>
            </div>
          </div>

          {/* Right / Bottom: Employee Selector & Parameters Assignment Table */}
          <div className="w-full lg:w-7/12 p-5 flex flex-col flex-1 min-h-0 bg-white overflow-y-auto scrollbar-none lg:h-full">
            {/* Employee Dropdown Filter Selector */}
            <div className="space-y-1.5 mb-4 shrink-0">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                <span>Filter by Employee / User Scope:</span>
                <span className="text-[11px] text-slate-400 font-normal normal-case">
                  {employees.length} Users under management
                </span>
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value)
                  setTagsPage(1)
                }}
                className="w-full border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-semibold text-slate-800 rounded cursor-pointer shadow-xs h-[40px]"
              >
                <option value="all">All Users (Show parameters across all managed employees)</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.addressLabel ? `${emp.addressLabel} (${emp.name})` : emp.name} — {emp.email} ({emp.assignedTagCount || 0} parameters)
                  </option>
                ))}
              </select>
            </div>

            {/* Parameter Search Bar */}
            <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
              <div className="flex items-center bg-white border border-slate-200 hover:border-slate-300 px-2.5 h-8.5 focus-within:border-purple-600 focus-within:ring-1 focus-within:ring-purple-600 transition-all flex-1">
                <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={tagsSearch}
                  onChange={(e) => {
                    setTagsSearch(e.target.value)
                    setTagsPage(1)
                  }}
                  placeholder="2. Search parameters to assign..."
                  className="w-full text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
                />
                {tagsSearch && (
                  <button onClick={() => setTagsSearch('')} className="text-slate-400 hover:text-slate-600">
                    <i className="pi pi-times text-[9px]" />
                  </button>
                )}
              </div>
            </div>

            {/* Parameters Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-none border border-slate-200 relative min-h-[220px]">
              {loadingTags && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <i className="pi pi-spin pi-spinner text-purple-600 text-lg" />
                </div>
              )}

              <DataTable
                value={tags}
                emptyMessage={
                  <EmptyState
                    message={selectedEmpId !== 'all' ? 'No parameters for this user' : 'No matching parameters found'}
                    description={
                      selectedEmpId !== 'all'
                        ? 'This employee has no assigned telemetry parameters. Assign parameters first, or switch to All Users.'
                        : 'Adjust your search term or employee scope.'
                    }
                    icon="pi-tags"
                  />
                }
                className="border-none text-xs"
                rowClassName={() => 'border-b border-slate-100 hover:bg-slate-50/60 transition-colors'}
                scrollable
                scrollHeight="flex"
              >
                <Column
                  header="Parameter"
                  style={{ minWidth: '180px' }}
                  body={(r) => (
                    <div>
                      <span className="font-bold text-slate-800 text-xs block truncate" title={formatTagDisplayName(r)}>
                        {formatTagDisplayName(r)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        {r.deviceName} ({r.gateway?.name || 'N/A'})
                      </span>
                    </div>
                  )}
                />
                <Column
                  header="Current Value"
                  align="center"
                  style={{ minWidth: '90px' }}
                  body={(r) => (
                    <span className="font-mono font-bold text-slate-700 text-xs">
                      {r.liveValue !== null ? r.liveValue : '—'}{' '}
                      <span className="text-[9px] text-slate-400 font-normal">{r.unit}</span>
                    </span>
                  )}
                />
                <Column
                  header="Status"
                  align="center"
                  style={{ minWidth: '120px' }}
                  body={(r) => {
                    const currentAssigned = selectedItem?.type === 'graph' ? r.assignedGraphType : r.assignedMeterType
                    if (currentAssigned === selectedItem?.id) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <i className="pi pi-check text-[9px]" /> Assigned
                        </span>
                      )
                    } else if (currentAssigned) {
                      return (
                        <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" title={`Assigned as ${currentAssigned}`}>
                          Other View ({currentAssigned})
                        </span>
                      )
                    }
                    return <span className="text-[10px] text-slate-400 font-light italic">Default</span>
                  }}
                />
                <Column
                  header="Action"
                  align="center"
                  style={{ minWidth: '130px' }}
                  body={(r) => {
                    const isAssignedToThis = (selectedItem?.type === 'graph' ? r.assignedGraphType : r.assignedMeterType) === selectedItem?.id
                    const hasOtherAssigned = selectedItem?.type === 'graph' ? !!r.assignedGraphType : !!r.assignedMeterType

                    return (
                      <div className="flex items-center justify-center gap-1.5">
                        {isAssignedToThis ? (
                          <button
                            onClick={() => handleClearAssignment(r, selectedItem?.type === 'graph' ? 'clear_graph' : 'clear_meter')}
                            className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAssignClick(r)}
                            className="px-3 py-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            {hasOtherAssigned ? 'Replace' : 'Assign'}
                          </button>
                        )}
                      </div>
                    )
                  }}
                />
              </DataTable>
            </div>

            {/* Paginator */}
            <div className="pt-2 shrink-0">
              <ReactPaginator
                totalRecords={tagsTotal}
                rows={TAGS_PAGE_SIZE}
                first={(tagsPage - 1) * TAGS_PAGE_SIZE}
                onPageChange={(e) => setTagsPage(e.page + 1)}
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Min/Max Input Dialog for Meter Assignment */}
      <Dialog
        header={
          <div className="flex items-center gap-2">
            <i className="pi pi-sliders-h text-purple-600" />
            <span className="text-sm font-bold text-slate-800">
              Set Meter Min &amp; Max Range
            </span>
          </div>
        }
        visible={confirmDialog}
        onHide={() => setConfirmDialog(false)}
        draggable={false}
        style={{ width: '400px' }}
        className="rounded-none border border-slate-200"
      >
        <div className="space-y-4 pt-1.5">
          <div className="bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
            <div className="font-bold text-slate-800">{formatTagDisplayName(targetTag)}</div>
            <div className="text-slate-400 font-mono text-[10px]">Assigning: {selectedItem?.name} ({selectedItem?.id})</div>
          </div>

          <div className={`grid ${selectedItem?.id === 'VERTICAL_BAR_IDLE' ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Minimum Value
              </label>
              <input
                type="number"
                value={meterMin === '' ? '' : meterMin}
                onChange={(e) => setMeterMin(e.target.value)}
                className="w-full border border-slate-200 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            {selectedItem?.id === 'VERTICAL_BAR_IDLE' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Idle Value
                </label>
                <input
                  type="number"
                  value={meterIdle === '' ? '' : meterIdle}
                  onChange={(e) => setMeterIdle(e.target.value)}
                  className="w-full border border-slate-200 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 px-3 py-2 text-xs font-mono font-bold"
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
                className="w-full border border-slate-200 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 px-3 py-2 text-xs font-mono font-bold"
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
              onClick={() => setConfirmDialog(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const finalMin = meterMin === '' || isNaN(Number(meterMin)) ? 0 : Number(meterMin)
                const finalMax = meterMax === '' || isNaN(Number(meterMax)) ? 100 : Number(meterMax)
                const finalIdle = meterIdle === '' || isNaN(Number(meterIdle)) ? 0 : Number(meterIdle)
                executeAssignment(targetTag, 'meter', selectedItem?.id, finalMin, finalMax, meterColor, finalIdle)
              }}
              disabled={submittingAssign}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submittingAssign && <i className="pi pi-spin pi-spinner text-xs" />}
              Confirm Assignment
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
