import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersApi } from '../../services/usersApi'
import { gatewaysApi } from '../../services/gatewaysApi'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { Dialog } from 'primereact/dialog'

const UNIT_SYMBOLS = ['°', '°C', '°F', '%', 'V', 'A', 'W', 'kW', 'kWh', 'bar', 'PSI', 'RPM', 'Hz', 'µ', 'Ω', '±', '×', '÷', '/', '≈', '∆', '∞', 'm³', 'L/h', 'm/s', 'Pa']


export default function EmployeeDetailPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [gatewayTags, setGatewayTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Selection & search state
  const [selectedGatewayId, setSelectedGatewayId] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [gatewaySearch, setGatewaySearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  // Labels editing state (for inline label/unit edits)
  const [labelsMap, setLabelsMap] = useState({})  // tagId -> displayName
  const [unitsMap, setUnitsMap] = useState({})     // tagId -> unit
  const fileInputRef = useRef(null)

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      showToast({ severity: 'error', summary: 'File Too Large', detail: 'Profile picture must be less than 1MB.' })
      return
    }

    try {
      setSaving(true)
      const reader = new FileReader()
      reader.onload = async () => {
        const base64Data = reader.result
        try {
          const updated = await usersApi.updateEmployee(employeeId, { profilePhoto: base64Data })
          setEmployee(updated)
          showToast({ severity: 'success', summary: 'Upload Success', detail: 'Profile picture updated successfully.' })
        } catch (err) {
          showToast({ severity: 'error', summary: 'Upload Failed', detail: err.message })
        } finally {
          setSaving(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Upload Failed', detail: err.message })
      setSaving(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [emp, gateways] = await Promise.all([
        usersApi.getUser(employeeId),
        usersApi.getEmployeeGatewayTags(employeeId)
      ])
      setEmployee(emp)
      setGatewayTags(gateways || [])

      // Load existing labels/units into edit maps
      const initLabels = {}
      const initUnits = {}
      for (const gw of (gateways || [])) {
        for (const tag of gw.tags) {
          initLabels[tag._id] = tag.displayName || ''
          initUnits[tag._id] = tag.unit || ''
        }
      }
      setLabelsMap(initLabels)
      setUnitsMap(initUnits)
      setHasUnsavedChanges(false)

      // Auto-select first gateway if available
      if (gateways && gateways.length > 0) {
        setSelectedGatewayId(gateways[0]._id)
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load user details' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [employeeId])

  // Memoized current active gateway
  const activeGateway = useMemo(() => {
    return gatewayTags.find(g => g._id === selectedGatewayId) || null
  }, [gatewayTags, selectedGatewayId])

  // Toggle single tag assigned state
  const handleToggleTag = useCallback((tagId) => {
    setHasUnsavedChanges(true)
    setGatewayTags(prev =>
      prev.map(gw => {
        const hasTag = gw.tags.some(t => t._id === tagId)
        if (!hasTag) return gw
        return {
          ...gw,
          tags: gw.tags.map(t =>
            t._id === tagId ? { ...t, assigned: !t.assigned } : t
          )
        }
      })
    )
  }, [])

  // Bulk assign/clear for current filtered tags in active gateway
  const handleBulkAction = useCallback((action, filteredTagIds) => {
    if (!selectedGatewayId) return
    setHasUnsavedChanges(true)
    setGatewayTags(prev =>
      prev.map(gw => {
        if (gw._id !== selectedGatewayId) return gw
        return {
          ...gw,
          tags: gw.tags.map(t => {
            if (filteredTagIds.includes(t._id)) {
              return { ...t, assigned: action === 'select' }
            }
            return t
          })
        }
      })
    )
  }, [selectedGatewayId])

  // Label/Unit change handlers
  const handleLabelChange = (tagId, value) => {
    setHasUnsavedChanges(true)
    setLabelsMap(prev => ({ ...prev, [tagId]: value }))
  }

  const handleUnitInputChange = (tagId, value) => {
    setHasUnsavedChanges(true)
    setUnitsMap(prev => ({ ...prev, [tagId]: value }))
  }

  const handleInsertUnitSymbol = (tagId, symbol) => {
    if (!symbol) return
    setHasUnsavedChanges(true)
    setUnitsMap(prev => {
      const current = prev[tagId] || ''
      const updated = current ? `${current}${symbol}` : symbol
      return { ...prev, [tagId]: updated }
    })
  }

  // Warning when leaving the page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Calculate totals
  const totalTagsCount = useMemo(() => {
    return gatewayTags.reduce((acc, gw) => acc + gw.tags.length, 0)
  }, [gatewayTags])

  const totalAssigned = useMemo(() => {
    return gatewayTags.reduce((acc, gw) => acc + gw.tags.filter(t => t.assigned).length, 0)
  }, [gatewayTags])

  // Modal Snapshot for Cancel support
  const [modalSnapshot, setModalSnapshot] = useState(null)

  const handleOpenGatewayModal = (gw) => {
    setSelectedGatewayId(gw._id)
    setFilterQuery('')
    const snapTags = gw.tags.map(t => ({ ...t }))
    const snapLabels = {}
    const snapUnits = {}
    gw.tags.forEach(t => {
      snapLabels[t._id] = labelsMap[t._id] || ''
      snapUnits[t._id] = unitsMap[t._id] || ''
    })
    setModalSnapshot({ gwId: gw._id, tags: snapTags, labels: snapLabels, units: snapUnits })
    setModalOpen(true)
  }

  const handleCancelModal = () => {
    if (modalSnapshot && activeGateway) {
      setGatewayTags(prev => prev.map(g => {
        if (g._id === modalSnapshot.gwId) {
          return {
            ...g,
            tags: g.tags.map(t => {
              const snapTag = modalSnapshot.tags.find(st => st._id === t._id)
              return snapTag ? { ...t, assigned: snapTag.assigned } : t
            })
          }
        }
        return g
      }))
      setLabelsMap(prev => ({ ...prev, ...modalSnapshot.labels }))
      setUnitsMap(prev => ({ ...prev, ...modalSnapshot.units }))
    }
    setModalOpen(false)
    setModalSnapshot(null)
  }

  const handleSaveModal = async () => {
    if (!activeGateway) return
    try {
      setSaving(true)

      const gwLabels = {}
      const gwUnits = {}
      for (const tag of activeGateway.tags) {
        gwLabels[tag._id] = labelsMap[tag._id] || ''
        gwUnits[tag._id] = unitsMap[tag._id] || ''
      }

      const selectedTagIds = gatewayTags.flatMap(gw =>
        gw.tags.filter(t => t.assigned).map(t => t._id)
      )

      await Promise.all([
        gatewaysApi.updateGatewayLabels(activeGateway._id, gwLabels, gwUnits),
        usersApi.updateEmployee(employeeId, { assignedTagIds: selectedTagIds })
      ])

      showToast({
        severity: 'success',
        summary: 'Saved',
        detail: `Parameter mappings for ${activeGateway.name} updated successfully`,
        life: 2500
      })

      setModalOpen(false)
      setModalSnapshot(null)
      loadData()
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Save Failed',
        detail: err.message || 'Failed to save configuration'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner text="Retrieving user profile..." />
  if (!employee) return <div className="p-6 text-center text-slate-500">User not found</div>

  const initials = employee?.name
    ? employee.name.split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase()
    : 'USR'

  // Filtered gateways based on gatewaySearch input
  const filteredGateways = gatewayTags.filter(gw => {
    const q = gatewaySearch.toLowerCase().trim()
    if (!q) return true
    return (
      gw.name?.toLowerCase().includes(q) ||
      gw.prefix?.toLowerCase().includes(q)
    )
  })

  // Filtered tags for active gateway
  const filteredTags = activeGateway
    ? activeGateway.tags.filter(t => {
        const query = filterQuery.toLowerCase().trim()
        if (!query) return true
        return (
          t.parameterName?.toLowerCase().includes(query) ||
          t.deviceName?.toLowerCase().includes(query) ||
          t.displayName?.toLowerCase().includes(query)
        )
      })
    : []

  return (
    <div className="space-y-5 h-[calc(100vh-125px)] flex flex-col">
      {/* ===== TOP BAR: User Profile Header (compact, full width) ===== */}
      <div className="bg-white border border-slate-200/80 overflow-hidden shrink-0">
        <div className="flex items-stretch gap-0">
          {/* Avatar + Name Section */}
          <div className="flex items-center gap-3 px-5 py-3 min-w-0 border-r border-slate-100">
            <div className="relative group/avatar w-10 h-10 shrink-0">
              {employee.profilePhoto ? (
                <img
                  src={employee.profilePhoto}
                  className="w-10 h-10 rounded-lg object-cover shadow-sm select-none border border-slate-200"
                  alt="Profile"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm select-none">
                  {initials}
                </div>
              )}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white rounded-lg cursor-pointer transition-opacity duration-200"
                title="Change profile picture"
              >
                <i className="pi pi-camera text-xs" />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-slate-800 truncate leading-tight">{employee.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 uppercase tracking-wide leading-none">User</span>
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide leading-none ${
                  employee.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${employee.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {employee.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Info Columns */}
          <div className="flex items-stretch divide-x divide-slate-100 flex-1 overflow-x-auto">
            {/* Email */}
            <div className="flex items-center gap-2 px-4 py-2 min-w-0">
              <i className="pi pi-envelope text-slate-300 text-[11px] shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Email</p>
                <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[160px]">{employee.email}</p>
              </div>
            </div>

            {/* Company */}
            <div className="flex items-center gap-2 px-4 py-2 min-w-0">
              <i className="pi pi-building text-slate-300 text-[11px] shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Company</p>
                <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[140px]">{employee.companyId?.name || 'Unassigned'}</p>
              </div>
            </div>

            {/* Manager */}
            <div className="flex items-center gap-2 px-4 py-2 min-w-0">
              <i className="pi pi-users text-slate-300 text-[11px] shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Manager</p>
                <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[150px]">
                  {Array.isArray(employee.managerId)
                    ? (employee.managerId.map(m => m.name).filter(Boolean).join(', ') || '—')
                    : (employee.managerId?.name || '—')}
                </p>
              </div>
            </div>
          </div>

          {/* Created Date — right side */}
          <div className="flex items-center gap-2 px-4 py-2 border-l border-slate-100 bg-slate-50/50 shrink-0">
            <i className="pi pi-calendar text-slate-300 text-[11px]" />
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Created</p>
              <p className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                {new Date(employee.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Address row if present */}
        {employee.address && (
          <div className="border-t border-slate-100 px-5 py-1.5 flex items-center gap-2 text-[10px] text-slate-400 bg-slate-50/30">
            <i className="pi pi-map-marker text-slate-400 text-[9px]" />
            <span className="font-bold text-slate-500">{employee.addressLabel || 'Address'}:</span>
            <span className="text-slate-650 truncate">{employee.address}</span>
          </div>
        )}
      </div>

      {/* ===== MAIN PANEL: Configure Parameter Labels & Access (full width) ===== */}
      <div className="bg-white border border-slate-200/80 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i className="pi pi-key text-blue-500" />
            Configure Parameter Labels & Access
          </h3>
          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 uppercase tracking-wider">
            {totalAssigned} of {totalTagsCount} assigned
          </span>
        </div>

        {gatewayTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <i className="pi pi-sitemap text-slate-300 text-2xl" />
            </div>
            <p className="text-sm font-bold text-slate-700">No gateways configured</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              This user's company does not have any active gateways with telemetry parameters yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Gateways Search Bar */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
              <div className="relative w-full max-w-sm">
                <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search assigned gateways..."
                  value={gatewaySearch}
                  onChange={(e) => setGatewaySearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white placeholder-slate-400 font-semibold text-slate-700 transition-all rounded-none"
                />
                {gatewaySearch && (
                  <button
                    onClick={() => setGatewaySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <i className="pi pi-times text-[10px]" />
                  </button>
                )}
              </div>
            </div>

            {/* Gateway Cards Grid (scrollable) */}
            <div className="flex-1 p-5 overflow-y-auto min-h-0">
              {filteredGateways.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs italic">
                  No matching gateways assigned.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fadeIn">
                  {filteredGateways.map((gw) => {
                    const assignedCount = gw.tags.filter(t => t.assigned).length
                    return (
                      <div
                        key={gw._id}
                        onClick={() => handleOpenGatewayModal(gw)}
                        className="h-[100px] rounded-lg flex flex-col cursor-pointer shadow-sm hover:shadow-md border border-[var(--border-color)] overflow-hidden transition-all duration-300 bg-[var(--bg-card)] hover:bg-[var(--accent-primary)] group"
                      >
                        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                          <span className="text-[var(--text-primary)] group-hover:text-[var(--accent-contrast)] font-bold text-xs truncate w-full transition-colors">
                            {gw.name}
                          </span>
                          <span className="text-slate-400 group-hover:text-[var(--accent-contrast)]/70 text-[9px] font-mono mt-0.5 uppercase tracking-wider transition-colors">
                            {gw.prefix}
                          </span>
                          <span className="text-[var(--text-secondary)] group-hover:text-[var(--accent-contrast)]/85 text-[10px] mt-1.5 font-bold transition-colors">
                            {assignedCount} of {gw.tags.length} assigned
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Parameter Configuration Dialog Modal */}
            <Dialog
              visible={modalOpen}
              onHide={handleCancelModal}
              draggable={false}
              header={
                <div className="flex items-center gap-2">
                  <i className="pi pi-sliders-h text-blue-600" />
                  <span className="font-extrabold text-slate-800 text-sm">
                    Configure Parameters — {activeGateway?.name} ({activeGateway?.prefix})
                  </span>
                </div>
              }
              className="w-full max-w-4xl mx-4"
              contentClassName="p-0 bg-white flex flex-col overflow-hidden"
              closable={true}
            >
              <div className="flex flex-col max-h-[80vh]">
                {/* Modal Toolbar */}
                <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-slate-50">
                  <div className="relative w-full sm:w-72">
                    <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                      type="text"
                      placeholder={`Search ${activeGateway?.tags?.length || 0} parameters...`}
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 text-xs focus:outline-none focus:border-blue-500 bg-white rounded font-semibold"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleBulkAction('select', filteredTags.map(t => t._id))}
                      className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer rounded"
                    >
                      Assign All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction('clear', filteredTags.map(t => t._id))}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer rounded"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Parameters Table (scrollable body) - Edge to edge */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {filteredTags.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs italic">
                      No parameters match your search.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                        <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-5 py-3">Device Node</th>
                          <th className="px-3 py-3 text-center">Register</th>
                          <th className="px-3 py-3 text-center">Address</th>
                          <th className="px-4 py-3">Custom Display Label</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3 text-center">Access</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-600 bg-white">
                        {filteredTags.map((tag) => (
                          <tr key={tag._id} className={`transition-colors duration-150 ${tag.assigned ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : 'hover:bg-slate-50'}`}>
                            <td className="px-5 py-2.5">
                              <span className="font-bold text-slate-800">{tag.deviceName}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-500">
                              {tag.parameterName}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                              {tag.address != null ? tag.address : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="text"
                                placeholder={tag.displayName || tag.topicName || tag.parameterName}
                                value={labelsMap[tag._id] || ''}
                                onChange={(e) => handleLabelChange(tag._id, e.target.value)}
                                className="w-full border border-slate-200 focus:border-blue-500 px-3 py-1.5 text-xs rounded bg-white text-slate-800 placeholder-slate-400 font-semibold"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5 min-w-[200px]">
                                <input
                                  type="text"
                                  value={unitsMap[tag._id] || ''}
                                  onChange={(e) => handleUnitInputChange(tag._id, e.target.value)}
                                  placeholder="°C, bar, V..."
                                  className="w-32 border border-slate-200 focus:border-blue-500 px-2.5 py-1.5 font-semibold text-slate-700 bg-white text-xs rounded placeholder-slate-400"
                                />
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleInsertUnitSymbol(tag._id, e.target.value)
                                    }
                                  }}
                                  className="border border-slate-200 focus:border-blue-500 px-2 py-1.5 font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs rounded cursor-pointer font-mono shrink-0"
                                >
                                  <option value="">+ Symbol</option>
                                  {UNIT_SYMBOLS.map(sym => (
                                    <option key={sym} value={sym}>{sym}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleTag(tag._id)}
                                className={`text-[10px] font-bold px-3 py-1.5 cursor-pointer transition-all rounded w-full max-w-[90px] ${
                                  tag.assigned
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {tag.assigned ? 'Unassign' : 'Assign'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                
                {/* Modal Footer */}
                <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50">
                  <button
                    type="button"
                    onClick={handleCancelModal}
                    disabled={saving}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 bg-white font-bold text-xs cursor-pointer transition-all rounded disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModal}
                    disabled={saving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all rounded shadow-xs disabled:opacity-50"
                  >
                    {saving ? <i className="pi pi-spin pi-spinner text-xs" /> : <i className="pi pi-check text-xs" />}
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  )
}