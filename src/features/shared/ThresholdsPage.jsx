import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import api from '../../services/axios'
import { getSession } from '../../services/auth'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { formatTagDisplayName } from '../../utils/tagUtils'

/**
 * Self-contained threshold number input that manages its own local state.
 * This prevents the PrimeReact DataTable body re-render from destroying
 * the focused input DOM node on every keystroke.
 */
const ThresholdInput = memo(function ThresholdInput({ value, onChange, placeholder, colorClass, borderClass, unit }) {
  const [localVal, setLocalVal] = useState(value ?? '')
  const inputRef = useRef(null)

  // Sync from parent when parent value changes (e.g. after save or data reload)
  // but NOT while the user is actively typing in this input
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalVal(value ?? '')
    }
  }, [value])

  const handleChange = (e) => {
    const v = e.target.value
    setLocalVal(v)
    onChange(v)
  }

  return (
    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={localVal}
        onChange={handleChange}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        className={`w-24 h-8 px-2 border ${borderClass} text-xs font-bold font-mono text-center rounded`}
      />
      {unit && <span className="text-[10px] font-normal" style={{ color: 'var(--text-secondary)' }}>{unit}</span>}
    </div>
  )
})

function SearchableUserSelect({ value, employees, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userOptions = useMemo(() => {
    const list = [
      { label: 'All Users', value: 'all' },
      ...employees.map(emp => ({
        label: emp.addressLabel || emp.name,
        value: emp._id
      }))
    ]
    return list
  }, [employees])

  const filteredOptions = useMemo(() => {
    if (!search.trim()) {
      // Default: show "All Users" + top 10 user options (11 options total)
      return userOptions.slice(0, 11)
    }
    const q = search.toLowerCase().trim()
    return userOptions.filter((opt, idx) => idx === 0 || opt.label.toLowerCase().includes(q))
  }, [userOptions, search])

  const selectedOpt = userOptions.find(o => o.value === value) || userOptions[0]

  return (
    <div className="relative min-w-[190px]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-full px-3 border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded-none flex items-center justify-between gap-2 cursor-pointer shadow-none"
      >
        <span className="truncate">{selectedOpt?.label || 'All Users'}</span>
        <i className={`pi pi-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 shadow-xl z-50 p-2 space-y-1.5 rounded-none">
          {/* Search Input Box */}
          <div className="relative flex items-center border border-slate-200 bg-slate-50 px-2.5 h-8 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
            <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user..."
              className="w-full text-xs text-slate-750 bg-transparent focus:outline-none font-semibold"
              autoFocus
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 shrink-0 ml-1">
                <i className="pi pi-times text-[9px]" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-[11px] text-slate-400 font-medium text-center">No users found</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold truncate flex items-center justify-between cursor-pointer rounded-none ${
                    value === opt.value
                      ? 'bg-amber-50 text-amber-700 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <i className="pi pi-check text-[10px] text-amber-600 shrink-0 ml-2" />}
                </button>
              ))
            )}
            {!search.trim() && userOptions.length > 11 && (
              <div className="p-1 text-[10px] text-slate-400 font-medium text-center border-t border-slate-100 mt-1">
                Showing top 10 users. Type to search all {userOptions.length - 1}...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ThresholdsPage() {
  const session = getSession()
  const isAdmin = session?.role === 'admin'
  const isManager = session?.role === 'manager'

  const [tags, setTags] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Admin filter states
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [gateways, setGateways] = useState([])
  const [selectedGatewayId, setSelectedGatewayId] = useState('all')

  // Manager filter states
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all')

  // Local editing inputs state: tagId -> { warningThreshold, criticalThreshold, alertsEnabled }
  const [editMap, setEditMap] = useState({})

  // State for alert toggle confirmation modal
  const [confirmTagModal, setConfirmTagModal] = useState({ show: false, tag: null, nextVal: true })

  // 500ms search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Load companies & gateways for Admin
  const loadAdminFilters = async () => {
    if (!isAdmin) return
    try {
      const [compRes, gwRes] = await Promise.all([
        api.get('/admin/companies'),
        api.get('/admin/gateways')
      ])
      setCompanies(compRes.data?.companies || [])
      setGateways(gwRes.data?.gateways || [])
    } catch (_) {}
  }

  // Load employees & gateways list for Manager
  const loadManagerFilters = async () => {
    if (!isManager) return
    try {
      const [empRes, gwRes] = await Promise.all([
        api.get('/manager/employees'),
        api.get('/manager/gateways')
      ])
      setEmployees(empRes.data?.employees || [])
      setGateways(gwRes.data?.gateways || [])
    } catch (_) {}
  }

  useEffect(() => {
    if (isAdmin) loadAdminFilters()
    if (isManager) loadManagerFilters()
  }, [])

  // Dependent gateways list based on selected company (for Admin)
  const availableGateways = useMemo(() => {
    if (!isAdmin || !selectedCompanyId) return gateways
    return gateways.filter(gw => {
      const compId = gw.companyId?._id || gw.companyId
      return compId === selectedCompanyId
    })
  }, [isAdmin, selectedCompanyId, gateways])

  // Load telemetry tags with threshold fields
  const loadData = useCallback(async (p = 1, search = '', empId = 'all', compId = '', gwId = 'all') => {
    try {
      setLoading(true)
      let url = isAdmin ? '/admin/thresholds' : '/manager/thresholds'
      const params = { page: p, limit: PAGE_SIZE }

      if (search) params.search = search
      if (isAdmin) {
        if (compId) params.companyId = compId
        if (gwId !== 'all') params.gatewayId = gwId
      } else if (isManager) {
        if (empId !== 'all') params.employeeId = empId
        if (gwId !== 'all') params.gatewayId = gwId
      }

      const res = await api.get(url, { params })
      const tagList = res.data?.tags || []
      setTags(tagList)
      setTotal(res.data?.total || 0)

      // Initialize edit inputs map
      const initMap = {}
      tagList.forEach(t => {
        const idKey = t._id || t.id || t.tagId
        initMap[idKey] = {
          warningThreshold: t.warningThreshold !== null && t.warningThreshold !== undefined ? String(t.warningThreshold) : '',
          criticalThreshold: t.criticalThreshold !== null && t.criticalThreshold !== undefined ? String(t.criticalThreshold) : '',
          alertsEnabled: t.alertsEnabled !== false
        }
      })
      setEditMap(initMap)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load telemetry thresholds' })
      setTags([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, isManager])

  useEffect(() => {
    loadData(page, debouncedSearch, selectedEmployeeId, selectedCompanyId, selectedGatewayId)
  }, [page, debouncedSearch, selectedEmployeeId, selectedCompanyId, selectedGatewayId, loadData])

  const handleCompanyChange = (e) => {
    const newCompId = e.target.value
    setSelectedCompanyId(newCompId)
    setSelectedGatewayId('all') // Reset gateway to 'all' on company change
    setPage(1)
  }

  const handleEmployeeChange = (e) => {
    const newEmpId = e.target.value
    setSelectedEmployeeId(newEmpId)
    setSelectedGatewayId('all') // Reset gateway to 'all' on employee change
    setPage(1)
  }

  const handleAlertToggleClick = (tag, currentVal) => {
    const nextVal = !currentVal
    setConfirmTagModal({ show: true, tag, nextVal })
  }

  const confirmAlertToggle = () => {
    if (confirmTagModal.tag) {
      const idKey = confirmTagModal.tag._id || confirmTagModal.tag.id || confirmTagModal.tag.tagId
      handleEditChange(idKey, 'alertsEnabled', confirmTagModal.nextVal)
    }
    setConfirmTagModal({ show: false, tag: null, nextVal: true })
  }

  const handleEditChange = (tagId, field, value) => {
    setEditMap(prev => ({
      ...prev,
      [tagId]: {
        ...(prev[tagId] || {}),
        [field]: value
      }
    }))
  }

  // Check if a row has unpersisted changes (Dirty State)
  const isTagDirty = (t) => {
    const idKey = t._id || t.id || t.tagId
    const edit = editMap[idKey]
    if (!edit) return false

    const origW = t.warningThreshold !== null && t.warningThreshold !== undefined ? String(t.warningThreshold) : ''
    const origC = t.criticalThreshold !== null && t.criticalThreshold !== undefined ? String(t.criticalThreshold) : ''
    const origAlerts = t.alertsEnabled !== false

    const editW = String(edit.warningThreshold ?? '').trim()
    const editC = String(edit.criticalThreshold ?? '').trim()
    const editAlerts = edit.alertsEnabled !== false

    return editW !== origW || editC !== origC || editAlerts !== origAlerts
  }

  // Derive display rows that embed edit state so PrimeReact DataTable
  // row memoization sees new object references when editMap changes.
  const displayTags = useMemo(() => {
    return tags.map(t => {
      const idKey = t._id || t.id || t.tagId
      const edit = editMap[idKey] || {}
      return { ...t, _edit: edit, _dirty: isTagDirty(t), rowKey: idKey }
    })
  }, [tags, editMap])

  const handleSaveTag = async (tag) => {
    const idKey = tag._id || tag.id || tag.tagId
    const edit = editMap[idKey] || {}
    const wStr = String(edit.warningThreshold ?? '').trim()
    const cStr = String(edit.criticalThreshold ?? '').trim()
    const alertsEnabled = edit.alertsEnabled !== false

    const wVal = wStr !== '' ? Number(wStr) : null
    const cVal = cStr !== '' ? Number(cStr) : null

    if (wVal !== null && isNaN(wVal)) {
      showToast({ severity: 'warn', summary: 'Validation Error', detail: 'Warning threshold must be a valid number.' })
      return
    }
    if (cVal !== null && isNaN(cVal)) {
      showToast({ severity: 'warn', summary: 'Validation Error', detail: 'Critical threshold must be a valid number.' })
      return
    }

    // Strict Validation: Warning < Critical when both are provided
    if (wVal !== null && cVal !== null && wVal >= cVal) {
      showToast({
        severity: 'error',
        summary: 'Invalid Threshold Range',
        detail: `Warning threshold (${wVal}) must be strictly less than Critical threshold (${cVal}).`
      })
      return
    }

    try {
      setSavingId(idKey)
      const url = isAdmin ? `/admin/thresholds/${idKey}` : `/manager/thresholds/${idKey}`
      const res = await api.put(url, {
        warningThreshold: wVal,
        criticalThreshold: cVal,
        alertsEnabled
      })

      showToast({ severity: 'success', summary: 'Threshold Saved', detail: res.data?.message || 'Threshold settings updated successfully!' })

      const updatedTag = res.data?.tag || { ...tag, warningThreshold: wVal, criticalThreshold: cVal, alertsEnabled }
      const newW = updatedTag.warningThreshold !== null && updatedTag.warningThreshold !== undefined ? String(updatedTag.warningThreshold) : ''
      const newC = updatedTag.criticalThreshold !== null && updatedTag.criticalThreshold !== undefined ? String(updatedTag.criticalThreshold) : ''
      const newAlerts = updatedTag.alertsEnabled !== false

      setTags(prev => prev.map(t => (t._id === idKey || t.id === idKey || t.tagId === idKey) ? { ...t, ...updatedTag } : t))
      setEditMap(prev => ({
        ...prev,
        [idKey]: {
          warningThreshold: newW,
          criticalThreshold: newC,
          alertsEnabled: newAlerts
        }
      }))
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save Error', detail: err.response?.data?.message || err.message || 'Failed to save threshold settings' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar & Filter Bar */}

      {/* Toolbar & Filter Bar */}
      <div className="bg-white border border-slate-200/80 p-4 shadow-none flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search Input with 500ms Debounce */}
        <div className="flex items-center bg-white border border-slate-200/80 rounded-none px-2.5 h-9 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all w-full lg:max-w-xs">
          <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parameter, device, topic..."
            className="w-full text-xs text-slate-750 bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer shrink-0"
            >
              <i className="pi pi-times text-[9px]" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap justify-end">
          {/* Manager Scope Selector: Select User */}
          {isManager && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">User:</span>
              <SearchableUserSelect
                value={selectedEmployeeId}
                employees={employees}
                onChange={(val) => handleEmployeeChange({ target: { value: val } })}
              />
            </div>
          )}

          {/* Admin Scope Selector: Company */}
          {isAdmin && companies.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company:</span>
              <select
                value={selectedCompanyId}
                onChange={handleCompanyChange}
                className="h-9 px-3 border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded-none min-w-[160px] cursor-pointer"
              >
                <option value="">All Companies</option>
                {companies.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Gateway Filter (Filtered under selected company for Admin) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gateway:</span>
            <select
              value={selectedGatewayId}
              onChange={(e) => { setSelectedGatewayId(e.target.value); setPage(1) }}
              className="h-9 px-3 border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded-none min-w-[150px] cursor-pointer"
            >
              <option value="all">All Gateways</option>
              {availableGateways.map(gw => (
                <option key={gw._id} value={gw._id}>{gw.name} ({gw.prefix})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Telemetry Thresholds Table */}
      <div className="bg-white border border-slate-200/80 shadow-none relative overflow-x-auto">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <i className="pi pi-spin pi-spinner text-amber-600 text-lg" />
          </div>
        )}

        <DataTable
          value={displayTags}
          dataKey="rowKey"
          emptyMessage={
            <EmptyState
              message="No parameter tags found"
              description="Try adjusting your search query, user scope, or gateway selection."
              icon="pi-exclamation-triangle"
            />
          }
          className="border-none"
          rowClassName={() => 'border-b border-slate-100 hover:bg-slate-50/50 transition-colors'}
        >
          {/* Parameter */}
          <Column
            header="Parameter Name"
            style={{ minWidth: '220px' }}
            body={(r) => (
              <div className="py-1">
                <span className="font-bold text-slate-800 text-sm block truncate" title={formatTagDisplayName(r)}>
                  {formatTagDisplayName(r)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  {r.topicName}
                </span>
              </div>
            )}
          />

          {/* Device Node */}
          <Column
            header="Device Node"
            style={{ minWidth: '160px' }}
            body={(r) => (
              <div className="py-1">
                <span className="text-slate-750 font-medium text-xs">{r.deviceName}</span>
                {r.gatewayId && (
                  <span className="text-[10px] text-slate-400 block font-light">
                    ({r.gatewayId.name || r.gatewayId.prefix})
                  </span>
                )}
              </div>
            )}
          />

          {/* Live Reading */}
          <Column
            header="Live Reading"
            alignHeader="center"
            align="center"
            style={{ minWidth: '120px' }}
            body={(r) => (
              <span
                style={{ backgroundColor: 'var(--bg-hover, #f1f5f9)', color: 'var(--text-primary, #334155)', borderColor: 'var(--border-color, #e2e8f0)' }}
                className="inline-flex items-center justify-center border px-2.5 py-0.5 rounded-full text-xs font-bold font-mono"
              >
                {r.latestValue !== null && r.latestValue !== undefined ? r.latestValue : 'N/A'}{' '}
                {r.latestValue !== null && r.unit && <span className="text-[9px] font-normal ml-0.5" style={{ color: 'var(--text-secondary)' }}>{r.unit}</span>}
              </span>
            )}
          />

          {/* Warning Threshold Input */}
          <Column
            header={
              <span className="text-amber-600 font-bold flex items-center justify-center gap-1">
                <i className="pi pi-exclamation-triangle text-xs" /> Warning Limit
              </span>
            }
            alignHeader="center"
            align="center"
            style={{ minWidth: '140px' }}
            body={(r) => {
              const idKey = r._id || r.id || r.tagId
              return (
                <ThresholdInput
                  key={`warn-${idKey}`}
                  value={r._edit?.warningThreshold}
                  onChange={(v) => handleEditChange(idKey, 'warningThreshold', v)}
                  placeholder="e.g. 50"
                  borderClass="border-amber-500/30 hover:border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  unit={r.unit}
                />
              )
            }}
          />

          {/* Critical Threshold Input */}
          <Column
            header={
              <span className="text-rose-600 font-bold flex items-center justify-center gap-1">
                <i className="pi pi-exclamation-circle text-xs" /> Critical Limit
              </span>
            }
            alignHeader="center"
            align="center"
            style={{ minWidth: '140px' }}
            body={(r) => {
              const idKey = r._id || r.id || r.tagId
              return (
                <ThresholdInput
                  key={`crit-${idKey}`}
                  value={r._edit?.criticalThreshold}
                  onChange={(v) => handleEditChange(idKey, 'criticalThreshold', v)}
                  placeholder="e.g. 80"
                  borderClass="border-rose-500/30 hover:border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  unit={r.unit}
                />
              )
            }}
          />

          {/* Alerts Toggle */}
          <Column
            header="Email Alerts"
            alignHeader="center"
            align="center"
            style={{ minWidth: '110px' }}
            body={(r) => {
              const isEnabled = r._edit?.alertsEnabled !== false
              return (
                <div className="flex items-center justify-center">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAlertToggleClick(r, isEnabled)}
                    style={{ borderRadius: '9999px', WebkitBorderRadius: '9999px' }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer transition-colors duration-200 ease-in-out ${
                      isEnabled ? 'bg-emerald-500' : 'bg-slate-500/30'
                    }`}
                    title={isEnabled ? 'Email alerts enabled (click to disable)' : 'Email alerts disabled (click to enable)'}
                  >
                    <span
                      style={{ borderRadius: '9999px', WebkitBorderRadius: '9999px' }}
                      className={`pointer-events-none inline-block h-4 w-4 transform bg-white shadow-sm transition-transform duration-200 ease-in-out my-auto ${
                        isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              )
            }}
          />

          {/* Action Save Button (Disabled when dirty === false) */}
          <Column
            header="Actions"
            alignHeader="center"
            align="center"
            style={{ minWidth: '100px' }}
            body={(r) => {
              const idKey = r._id || r.id || r.tagId
              const dirty = r._dirty
              const isSaving = savingId === idKey
              return (
                <button
                  onClick={() => handleSaveTag(r)}
                  disabled={!dirty || isSaving}
                  style={!dirty ? { backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' } : {}}
                  className={`px-3 py-1.5 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all rounded shadow-xs mx-auto border ${
                    dirty
                      ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer border-amber-600'
                      : 'cursor-not-allowed opacity-50'
                  }`}
                  title={dirty ? 'Click to save changes for this tag' : 'No unsaved changes'}
                >
                  {isSaving ? (
                    <i className="pi pi-spin pi-spinner text-xs" />
                  ) : (
                    <i className="pi pi-save text-xs" />
                  )}
                  <span>Save</span>
                </button>
              )
            }}
          />
        </DataTable>
      </div>

      {/* Pagination */}
      <ReactPaginator
        totalRecords={total}
        rows={PAGE_SIZE}
        first={(page - 1) * PAGE_SIZE}
        onPageChange={(e) => {
          const newPage = e.page + 1
          setPage(newPage)
          loadData(newPage, debouncedSearch, selectedEmployeeId, selectedCompanyId, selectedGatewayId)
        }}
      />

      {/* Per-Tag Alert Toggle Confirmation Modal */}
      {confirmTagModal.show && confirmTagModal.tag && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md shadow-xl overflow-hidden">
            <div className={`p-4 border-b flex items-center gap-3 ${confirmTagModal.nextVal ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${confirmTagModal.nextVal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                <i className={confirmTagModal.nextVal ? 'pi pi-bell' : 'pi pi-bell-slash'} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold">
                  {confirmTagModal.nextVal ? 'Enable Parameter Email Alert?' : 'Disable Parameter Email Alert?'}
                </h3>
                <p className="text-[11px] opacity-80">
                  Confirmation required for parameter tag notification settings.
                </p>
              </div>
            </div>

            <div className="p-5 text-xs text-slate-600 leading-relaxed space-y-3">
              {confirmTagModal.nextVal ? (
                <p>
                  Are you sure you want to <strong className="text-emerald-700 font-bold">ENABLE</strong> email alerts for parameter <strong className="text-slate-800">{formatTagDisplayName(confirmTagModal.tag)}</strong> on device node <strong className="text-slate-800">{confirmTagModal.tag.deviceName}</strong>?
                </p>
              ) : (
                <p>
                  Are you sure you want to <strong className="text-amber-700 font-bold">DISABLE</strong> email alerts for parameter <strong className="text-slate-800">{formatTagDisplayName(confirmTagModal.tag)}</strong> on device node <strong className="text-slate-800">{confirmTagModal.tag.deviceName}</strong>? Breach emails for this specific tag will be suppressed.
                </p>
              )}
              <p className="text-[11px] text-slate-400 italic">
                Note: Remember to click "Save" in the row to persist changes to the server.
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setConfirmTagModal({ show: false, tag: null, nextVal: true })}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAlertToggle}
                className={`px-4 py-2 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm ${confirmTagModal.nextVal ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {confirmTagModal.nextVal ? 'Yes, Enable' : 'Yes, Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
