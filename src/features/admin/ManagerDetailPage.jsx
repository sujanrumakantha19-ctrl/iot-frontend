import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { usersApi } from '../../services/usersApi'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'

export default function ManagerDetailPage() {
  const { managerId } = useParams()
  const navigate = useNavigate()
  const [manager, setManager] = useState(null)
  const [company, setCompany] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef(null)

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      showToast({ severity: 'error', summary: 'File Too Large', detail: 'Profile picture must be less than 1MB.' })
      return
    }

    try {
      setLoading(true)
      const reader = new FileReader()
      reader.onload = async () => {
        const base64Data = reader.result
        try {
          const updated = await usersApi.updateManager(managerId, { profilePhoto: base64Data })
          setManager(updated)
          showToast({ severity: 'success', summary: 'Upload Success', detail: 'Profile picture updated successfully.' })
        } catch (err) {
          showToast({ severity: 'error', summary: 'Upload Failed', detail: err.message })
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Upload Failed', detail: err.message })
      setLoading(false)
    }
  }

  // Employee assignment modal states
  const [assignDialogVisible, setAssignDialogVisible] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])
  const [assignSearchQuery, setAssignSearchQuery] = useState('')
  const [dialogTab, setDialogTab] = useState('all')

  // Debounced search filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const filteredEmployees = useMemo(() => {
    if (!debouncedSearchQuery) return employees
    const q = debouncedSearchQuery.toLowerCase().trim()
    return employees.filter(emp =>
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    )
  }, [employees, debouncedSearchQuery])

  const [empFirst, setEmpFirst] = useState(0)
  const empRows = 5

  useEffect(() => {
    setEmpFirst(0)
  }, [searchQuery])

  const paginatedEmployees = useMemo(() => {
    return filteredEmployees.slice(empFirst, empFirst + empRows)
  }, [filteredEmployees, empFirst, empRows])

  const openAssignDialog = () => {
    const initialSelection = employees.filter(emp => 
      Array.isArray(emp.managerId) ? emp.managerId.includes(managerId) : emp.managerId === managerId
    ).map(emp => emp._id)
    setSelectedEmployeeIds(initialSelection)
    setAssignSearchQuery('')
    setAssignDialogVisible(true)
  }

  const toggleSelectEmployee = (empId) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    )
  }

  const handleSaveAssignments = async () => {
    try {
      setLoading(true)
      await usersApi.assignManagerEmployees(managerId, selectedEmployeeIds)
      showToast({ severity: 'success', summary: 'Updated', detail: 'Employee team assignments updated successfully' })
      setAssignDialogVisible(false)
      await loadData()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save Failed', detail: err.message || 'Failed to assign employees' })
    } finally {
      setLoading(false)
    }
  }

  const filteredAssignEmployees = useMemo(() => {
    const query = assignSearchQuery.toLowerCase().trim()
    if (!query) return employees
    return employees.filter(emp =>
      emp.name?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query)
    )
  }, [employees, assignSearchQuery])

  const loadData = async () => {
    try {
      setLoading(true)
      const [mgmtRes, mgr] = await Promise.all([
        usersApi.getManagerDetail(managerId),
        usersApi.getUser(managerId)
      ])
      setManager(mgr)
      setCompany(mgmtRes.company)
      setEmployees(mgmtRes.employees || [])
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load manager details' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [managerId])

  const tagCountBody = (row) => (
    <span className="font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-0.5 text-[11px] font-mono">
      {row.assignedTagCount} tags
    </span>
  )

  const statusBody = (row) => (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${
      row.active
        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
        : 'bg-rose-50 text-rose-600 border-rose-100'
    }`}>
      <span className={`w-1 h-1 rounded-full ${row.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {row.active ? 'Active' : 'Inactive'}
    </span>
  )

  const createdBody = (row) => (
    <span className="font-mono text-xs text-slate-500">
      {new Date(row.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
    </span>
  )

  const nameBody = (row) => (
    <span className="font-semibold text-slate-800">
      {row.name}
    </span>
  )

  const managerBody = (row) => {
    const isThisManager = Array.isArray(row.managerId) ? row.managerId.includes(managerId) : row.managerId === managerId
    if (isThisManager) {
      return (
        <span className="font-bold text-purple-600 bg-purple-50 border border-purple-100 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide select-none">
          Reports to Him
        </span>
      )
    }
    if (row.managerName) {
      return (
        <span className="text-slate-500 font-semibold text-xs">
          {row.managerName}
        </span>
      )
    }
    return (
      <span className="text-slate-400 font-medium text-xs italic">
        Unassigned
      </span>
    )
  }

  if (loading) return <LoadingSpinner text="Retrieving manager profile..." />
  if (!manager) return <div className="p-6 text-center text-slate-500">Manager not found</div>

  // Get initials for avatar
  const initials = manager.name
    ? manager.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'MGR'

  return (
    <div className="space-y-6 lg:h-[calc(100vh-125px)] lg:flex lg:flex-col">
      <div className="flex flex-col lg:flex-row gap-6 lg:flex-1 lg:min-h-0">

        {/* Profile Card */}
        <div
          style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
          className="border rounded-xl overflow-hidden shadow-sm flex flex-col justify-between h-full lg:w-[28.75%] shrink-0"
        >
          <div
            className="flex-1 overflow-y-auto min-h-0 scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Header banner decoration */}
            <div
              style={{ backgroundColor: 'var(--bg-hover, rgba(147, 51, 234, 0.05))', borderColor: 'var(--border-color, #f1f5f9)' }}
              className="p-6 flex flex-col items-center border-b"
            >
              <div className="relative group/avatar w-16 h-16 mb-3">
                {manager.profilePhoto ? (
                  <img
                    src={manager.profilePhoto}
                    className="w-16 h-16 rounded-full object-cover shadow-lg shadow-purple-500/10 border border-slate-200 select-none"
                    alt="Profile"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-600 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-purple-500/20 select-none">
                    {initials}
                  </div>
                )}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white rounded-full cursor-pointer transition-opacity duration-200"
                  title="Change profile picture"
                >
                  <i className="pi pi-camera text-sm" />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{manager.name}</h3>
              <span
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--accent-primary, #9333ea)' }}
                className="text-[10px] font-bold border rounded-full px-2.5 py-0.5 mt-1.5 uppercase tracking-wide"
              >
                Operations Manager
              </span>
            </div>

            {/* Info details block */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <i className="pi pi-envelope text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }} />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Email Address</span>
                  <span className="text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{manager.email}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <i className="pi pi-shield text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }} />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Account Status</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide mt-0.5 ${
                    manager.active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${manager.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {manager.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <i className="pi pi-building text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }} />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Company Space</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{company?.name || manager.companyId?.name || 'Unassigned'}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <i className="pi pi-shield text-xs mt-0.5 text-purple-500" />
                <div className="space-y-1 w-full">
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Assign Access Scope</span>
                  {manager.assignPermissionMode === 'restrict' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      <i className="pi pi-ban text-[9px]" /> Restricted (Hidden)
                    </span>
                  ) : manager.assignPermissionMode === 'limit' ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        <i className="pi pi-sliders-h text-[9px]" /> Limited Access ({(manager.allowedMeterTypes || []).length} Meters, {(manager.allowedGraphIds || []).length} Graphs)
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <i className="pi pi-check-circle text-[9px]" /> All Components (Full Access)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <i className="pi pi-cog text-xs mt-0.5 text-indigo-500" />
                <div className="space-y-1 w-full">
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Feature Permissions</span>
                  <div className="flex flex-wrap gap-1">
                    {manager.featurePermissions?.showUsers !== false ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        <i className="pi pi-users text-[8px]" /> Users
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200">
                        <i className="pi pi-users text-[8px]" /> Users Off
                      </span>
                    )}

                    {manager.featurePermissions?.showGateway ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                        <i className="pi pi-server text-[8px]" /> Gateway ({Object.values(manager.featurePermissions?.gatewayFeatures || {}).filter(Boolean).length} Tabs)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200">
                        <i className="pi pi-server text-[8px]" /> Gateway Off
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Creation date footer */}
          <div
            style={{ backgroundColor: 'var(--bg-hover, rgba(0,0,0,0.02))', borderColor: 'var(--border-color, #f1f5f9)' }}
            className="p-5 border-t flex items-center justify-between text-[11px] shrink-0"
          >
            <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><i className="pi pi-calendar" /> Created:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {new Date(manager.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Employees Panel */}
        <div
          style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
          className="border rounded-xl p-5 flex flex-col h-full shadow-sm overflow-hidden lg:flex-1 min-w-0"
        >
          <div className="flex items-center justify-between border-b pb-3 mb-3 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <i className="pi pi-users text-purple-500" />
              Company Employees Directory
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold rounded-full px-2.5 py-1 uppercase tracking-wider" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {employees.length} employees
              </span>
              <button
                onClick={openAssignDialog}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-none font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-purple-500/10 cursor-pointer transition-all"
              >
                <i className="pi pi-user-plus text-[10px]" />
                Assign Employees
              </button>
            </div>
          </div>

          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <i className="pi pi-users text-slate-300 text-2xl" />
              </div>
              <p className="text-sm font-bold text-slate-700">No employees assigned</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                There are currently no employee profiles linked to {company?.name || 'this company'}.
              </p>
              <button
                onClick={openAssignDialog}
                className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-none font-bold text-xs uppercase tracking-wide cursor-pointer transition-all shadow-md shadow-purple-500/10"
              >
                Assign Employees
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              {/* Search Bar */}
              <div className="flex items-center bg-white border border-slate-200/60 rounded-none px-2.5 h-9 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shrink-0 max-w-xs">
                <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 ml-1.5 cursor-pointer shrink-0"
                  >
                    <i className="pi pi-times text-[9px]" />
                  </button>
                )}
              </div>

              {/* Paginated & Filtered DataTable */}
              <div className="overflow-hidden border border-slate-200 rounded-lg flex-1 min-h-0">
                <DataTable
                  value={paginatedEmployees}
                  onRowClick={(e) => {
                    if (e.originalEvent.target.closest('button, a, input, select')) return
                    navigate(`/admin/employees/${e.data._id}`)
                  }}
                  rowClassName={() => 'cursor-pointer hover:bg-slate-50 transition-colors'}
                  emptyMessage={<EmptyState message="No employees found" description="Try adjusting your search keywords to find matching employee accounts." icon="pi-users" />}
                  size="small"
                  stripedRows
                  scrollable
                  scrollHeight="100%"
                  className="text-xs font-semibold"
                >
                  <Column header="Name" body={nameBody} className="font-semibold text-slate-800" />
                  <Column field="email" header="Email" />
                  <Column header="Reporting Manager" body={managerBody} style={{ minWidth: '150px' }} />
                  <Column header="Tags" body={tagCountBody} style={{ width: '100px' }} />
                  <Column header="Status" body={statusBody} style={{ width: '100px' }} />
                  <Column header="Created" body={createdBody} style={{ width: '110px' }} />
                </DataTable>
              </div>
              <ReactPaginator
                totalRecords={filteredEmployees.length}
                rows={empRows}
                first={empFirst}
                onPageChange={(e) => setEmpFirst(e.first)}
              />
            </div>
          )}
        </div>

      </div>

      {/* Assignment Dialog Modal */}
      <Dialog
        header="Manage Employee Assignments"
        visible={assignDialogVisible}
        onHide={() => setAssignDialogVisible(false)}
        draggable={false}
        className="w-full lg:w-[90vw] max-w-4xl"
        footer={
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 mt-2">
            <button
              onClick={() => setAssignDialogVisible(false)}
              className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-none font-bold text-xs uppercase tracking-wide cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAssignments}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-none font-bold text-xs uppercase tracking-wide cursor-pointer transition-all shadow-md shadow-purple-500/10"
            >
              Save Assignments
            </button>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Assign employees under <span className="font-bold text-slate-700">{company?.name}</span> to report to <span className="font-bold text-purple-600">{manager?.name}</span>.
          </p>

          {/* Dialog Tabs for Quick Filtering */}
          <div className="flex border-b border-slate-150 text-xs shrink-0 bg-slate-50/50 p-1 rounded gap-1">
            <button
              type="button"
              onClick={() => setDialogTab('all')}
              className={`flex-1 py-1.5 font-bold uppercase tracking-wider rounded text-center transition-all ${
                dialogTab === 'all'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({employees.length})
            </button>
             <button
              type="button"
              onClick={() => setDialogTab('team')}
              className={`flex-1 py-1.5 font-bold uppercase tracking-wider rounded text-center transition-all ${
                dialogTab === 'team'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Current Team ({employees.filter(e => Array.isArray(e.managerId) ? e.managerId.includes(managerId) : e.managerId === managerId).length})
            </button>
            <button
              type="button"
              onClick={() => setDialogTab('others')}
              className={`flex-1 py-1.5 font-bold uppercase tracking-wider rounded text-center transition-all ${
                dialogTab === 'others'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Other Managers ({employees.filter(e => Array.isArray(e.managerId) ? (e.managerId.length > 0 && !e.managerId.includes(managerId)) : (e.managerId && e.managerId !== managerId)).length})
            </button>
            <button
              type="button"
              onClick={() => setDialogTab('unassigned')}
              className={`flex-1 py-1.5 font-bold uppercase tracking-wider rounded text-center transition-all ${
                dialogTab === 'unassigned'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Unassigned ({employees.filter(e => Array.isArray(e.managerId) ? e.managerId.length === 0 : !e.managerId).length})
            </button>
          </div>

          {/* Search bar & Selection Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center bg-white border border-slate-200/60 rounded-none px-2.5 h-9 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all flex-1 w-full">
              <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={assignSearchQuery}
                onChange={(e) => setAssignSearchQuery(e.target.value)}
                placeholder="Search company employees..."
                className="w-full text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
              />
              {assignSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAssignSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 ml-1.5 cursor-pointer shrink-0"
                >
                  <i className="pi pi-times text-[9px]" />
                </button>
              )}
            </div>

            {/* Quick Bulk visible actions */}
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const visibleIds = filteredAssignEmployees
                    .filter(e => {
                      if (dialogTab === 'team') return Array.isArray(e.managerId) ? e.managerId.includes(managerId) : e.managerId === managerId
                      if (dialogTab === 'others') return Array.isArray(e.managerId) ? (e.managerId.length > 0 && !e.managerId.includes(managerId)) : (e.managerId && e.managerId !== managerId)
                      if (dialogTab === 'unassigned') return Array.isArray(e.managerId) ? e.managerId.length === 0 : !e.managerId
                      return true
                    })
                    .map(e => e._id)
                  setSelectedEmployeeIds(prev => Array.from(new Set([...prev, ...visibleIds])))
                }}
                className="px-2 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800 text-[10px] font-bold uppercase tracking-wider transition-all select-none"
              >
                Select All Visible
              </button>
              <button
                type="button"
                onClick={() => {
                  const visibleIds = filteredAssignEmployees
                    .filter(e => {
                      if (dialogTab === 'team') return Array.isArray(e.managerId) ? e.managerId.includes(managerId) : e.managerId === managerId
                      if (dialogTab === 'others') return Array.isArray(e.managerId) ? (e.managerId.length > 0 && !e.managerId.includes(managerId)) : (e.managerId && e.managerId !== managerId)
                      if (dialogTab === 'unassigned') return Array.isArray(e.managerId) ? e.managerId.length === 0 : !e.managerId
                      return true
                    })
                    .map(e => e._id)
                  setSelectedEmployeeIds(prev => prev.filter(id => !visibleIds.includes(id)))
                }}
                className="px-2 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800 text-[10px] font-bold uppercase tracking-wider transition-all select-none"
              >
                Deselect All Visible
              </button>
            </div>
          </div>

          {/* High-density 2-column checklist container */}
          <div className="max-h-[450px] overflow-y-auto border border-slate-200/60 rounded-md p-2 bg-slate-50/50">
            {(() => {
              const currentFilteredList = filteredAssignEmployees.filter(emp => {
                if (dialogTab === 'team') return Array.isArray(emp.managerId) ? emp.managerId.includes(managerId) : emp.managerId === managerId
                if (dialogTab === 'others') return Array.isArray(emp.managerId) ? (emp.managerId.length > 0 && !emp.managerId.includes(managerId)) : (emp.managerId && emp.managerId !== managerId)
                if (dialogTab === 'unassigned') return Array.isArray(emp.managerId) ? emp.managerId.length === 0 : !emp.managerId
                return true
              })

              if (currentFilteredList.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-400 italic text-xs font-semibold">
                    No matching employees found in this view.
                  </div>
                )
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentFilteredList.map(emp => {
                    const isChecked = selectedEmployeeIds.includes(emp._id)
                    const reportsToOther = Array.isArray(emp.managerId) ? (emp.managerId.length > 0 && !emp.managerId.includes(managerId)) : (emp.managerId && emp.managerId !== managerId)
                    const reportsToThisTeam = Array.isArray(emp.managerId) ? emp.managerId.includes(managerId) : emp.managerId === managerId
                    return (
                      <div
                        key={emp._id}
                        onClick={() => toggleSelectEmployee(emp._id)}
                        className={`flex items-center justify-between p-2 border rounded cursor-pointer transition-all hover:bg-slate-50 select-none ${
                          isChecked ? 'border-purple-200 bg-purple-50/20 shadow-sm' : 'border-slate-200/50 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // toggled by parent click handler
                            className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 border-slate-350 rounded cursor-pointer shrink-0"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[11px] font-bold text-slate-800 block truncate">{emp.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono block truncate">{emp.email}</span>
                          </div>
                        </div>
                        <div className="shrink-0 pl-1.5">
                          {reportsToThisTeam ? (
                            <span className="font-bold text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wide">
                              Team
                            </span>
                          ) : reportsToOther ? (
                            <span
                              title={`Reports to: ${emp.managerName}`}
                              className="font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wide max-w-[80px] truncate block"
                            >
                              Other
                            </span>
                          ) : (
                            <span className="font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wide italic">
                              None
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
