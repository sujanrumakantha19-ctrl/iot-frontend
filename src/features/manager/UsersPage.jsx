import { useState, useEffect, useCallback } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { showToast } from '../../utils/toast'
import api from '../../services/axios'
import PageHeader from '../../components/shared/PageHeader'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { getSession } from '../../services/auth'
import { formatTagDisplayName } from '../../utils/tagUtils'

export default function UsersPage() {
  const session = getSession()
  const isRestricted = session?.role === 'manager' && session?.featurePermissions?.showUsers === false

  const [users, setUsers] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const [first, setFirst] = useState(0)
  const rows = 10

  // Interactive Assign Tag Modal state
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [selectedUserForAssign, setSelectedUserForAssign] = useState(null)
  const [assignGateways, setAssignGateways] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState(new Set())
  const [initialTagIds, setInitialTagIds] = useState(new Set())
  const [assignSearch, setAssignSearch] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [savingAssignments, setSavingAssignments] = useState(false)

  const loadUsers = useCallback(async (pageNum) => {
    try {
      setLoading(true)
      const res = await api.get('/manager/users', {
        params: { page: pageNum, limit: rows }
      })
      setUsers(res.data.users || res.data.employees || [])
      setTotalRecords(res.data.total || 0)
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Error',
        detail: err.response?.data?.message || err.message || 'Failed to load employee list'
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers(1)
  }, [loadUsers])

  const openAssignModal = async (user) => {
    setSelectedUserForAssign(user)
    setAssignSearch('')
    setAssignModalVisible(true)
    setAssignLoading(true)
    try {
      const res = await api.get(`/manager/users/${user._id}/gateway-tags`)
      const gws = res.data.gateways || []
      setAssignGateways(gws)

      const initialSet = new Set()
      gws.forEach(gw => {
        (gw.tags || []).forEach(t => {
          if (t.assigned) initialSet.add(t._id)
        })
      })
      setSelectedTagIds(new Set(initialSet))
      setInitialTagIds(new Set(initialSet))
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Error Loading Parameters',
        detail: err.response?.data?.message || err.message
      })
    } finally {
      setAssignLoading(false)
    }
  }

  const toggleTag = (tagId) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        next.add(tagId)
      }
      return next
    })
  }

  const toggleGateway = (gwTags) => {
    const gwTagIds = gwTags.map(t => t._id)
    const allSelected = gwTagIds.every(id => selectedTagIds.has(id))
    setSelectedTagIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        gwTagIds.forEach(id => next.delete(id))
      } else {
        gwTagIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const handleSaveAssignments = async () => {
    if (!selectedUserForAssign) return
    try {
      setSavingAssignments(true)
      await api.put(`/manager/users/${selectedUserForAssign._id}/assign-tags`, {
        assignedTagIds: Array.from(selectedTagIds)
      })
      showToast({
        severity: 'success',
        summary: 'Assignments Saved',
        detail: `Telemetry parameter assignments updated for ${selectedUserForAssign.name}`,
        life: 2500
      })
      setAssignModalVisible(false)
      setSelectedUserForAssign(null)
      loadUsers(Math.floor(first / rows) + 1)
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Save Failed',
        detail: err.response?.data?.message || err.message
      })
    } finally {
      setSavingAssignments(false)
    }
  }

  const gatewaysBody = (row) => {
    if (!row.assignedGatewayIds || !Array.isArray(row.assignedGatewayIds) || row.assignedGatewayIds.length === 0) {
      return <span className="text-slate-400 font-medium italic text-xs">No gateways assigned</span>
    }
    const validGateways = row.assignedGatewayIds.filter(Boolean)
    if (validGateways.length === 0) {
      return <span className="text-slate-400 font-medium italic text-xs">No gateways assigned</span>
    }
    return (
      <div className="flex flex-wrap gap-1">
        {validGateways.map((g, idx) => {
          const name = typeof g === 'object' ? (g.name || g.prefix || 'Gateway') : String(g)
          const key = typeof g === 'object' ? (g._id || idx) : `${g}-${idx}`
          return (
            <span key={key} className="px-2.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-650 font-bold text-[10px] rounded-none">
              {name}
            </span>
          )
        })}
      </div>
    )
  }

  const actionsBody = (row) => {
    const count = row.assignedTagCount || 0
    return (
      <button
        onClick={() => openAssignModal(row)}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
      >
        <i className="pi pi-sliders-h text-[10px]" />
        Assign Parameters ({count})
      </button>
    )
  }

  const handleUserPageChange = (e) => {
    setFirst(e.first)
    const nextPage = (e.first / rows) + 1
    loadUsers(nextPage)
  }

  if (isRestricted) {
    return (
      <div className="bg-white border border-slate-200/80 p-8 sm:p-12 text-center rounded-xl space-y-4 shadow-sm my-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
          <i className="pi pi-ban" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Users Directory Access Restricted</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
            Access to the Employees / Users Directory has been restricted for your manager account by your Administrator. Please contact your system administrator to adjust your permissions.
          </p>
        </div>
      </div>
    )
  }

  if (loading && users.length === 0) return <LoadingSpinner text="Connecting managed operations directory..." />

  // Compute dirty state
  const isDirty = (
    selectedTagIds.size !== initialTagIds.size ||
    Array.from(selectedTagIds).some(id => !initialTagIds.has(id))
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Employees Directory" subtitle="Assign & manage telemetry parameter access scopes for employees under your supervision" />

      <div className="bg-white border border-slate-200/80 overflow-x-auto shadow-none relative">
        {loading && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <i className="pi pi-spin pi-spinner text-slate-400 text-lg" />
          </div>
        )}
        <DataTable value={users} emptyMessage="No employees reporting under your account." scrollable>
          <Column field="name" header="Name" sortable style={{ minWidth: '140px' }} className="font-semibold text-slate-800" />
          <Column field="email" header="Email" style={{ minWidth: '160px' }} />
          <Column field="active" header="Status" style={{ minWidth: '80px' }} body={(r) => r.active ? <span className="text-emerald-600 font-medium">Active</span> : <span className="text-slate-400">Inactive</span>} sortable />
          <Column header="Assigned Gateways" style={{ minWidth: '160px' }} body={gatewaysBody} />
          <Column header="Actions" align="center" alignHeader="center" style={{ minWidth: '180px' }} body={actionsBody} />
        </DataTable>
      </div>

      <ReactPaginator
        totalRecords={totalRecords}
        rows={rows}
        first={first}
        onPageChange={handleUserPageChange}
      />

      {/* Gateway-Wise Tag Assignment Dialog */}
      <Dialog
        header={
          <div className="flex items-center justify-between w-full pr-6">
            <div className="flex items-center gap-2">
              <i className="pi pi-sliders-h text-blue-600" />
              <span className="text-sm font-bold text-slate-800">
                Assign Telemetry Parameters — {selectedUserForAssign?.name}
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 border border-slate-200">
              Selected: <strong className="text-blue-600 font-mono">{selectedTagIds.size}</strong> parameter(s)
            </span>
          </div>
        }
        visible={assignModalVisible}
        onHide={() => {
          if (!savingAssignments) {
            setAssignModalVisible(false)
            setSelectedUserForAssign(null)
          }
        }}
        draggable={false}
        resizable={false}
        style={{ width: '850px', maxWidth: '95vw' }}
        className="rounded-none border border-slate-200"
      >
        <div className="space-y-4 pt-2">
          {/* Search bar */}
          <div className="flex items-center bg-white border border-slate-200 hover:border-slate-300 px-3 h-9 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-all">
            <i className="pi pi-search text-xs text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Filter by parameter, display name, device, or topic..."
              className="w-full text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
            />
            {assignSearch && (
              <button
                onClick={() => setAssignSearch('')}
                className="text-slate-400 hover:text-slate-650 ml-1 cursor-pointer shrink-0"
              >
                <i className="pi pi-times text-[10px]" />
              </button>
            )}
          </div>

          {/* Gateway Sections */}
          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 relative min-h-[200px]">
            {assignLoading ? (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2.5 z-10">
                <i className="pi pi-spin pi-spinner text-blue-600 text-xl" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading gateway parameter configurations...</span>
              </div>
            ) : null}

            {!assignLoading && assignGateways.length === 0 && (
              <div className="p-8 text-center text-slate-400 italic text-xs font-semibold bg-slate-50 border border-dashed border-slate-200">
                No gateways or telemetry parameters configured for your company yet.
              </div>
            )}

            {!assignLoading && assignGateways.map((gw) => {
              const q = assignSearch.toLowerCase().trim()
              const filteredTags = gw.tags.filter(t => {
                if (!q) return true
                return (
                  (t.parameterName && t.parameterName.toLowerCase().includes(q)) ||
                  (t.displayName && t.displayName.toLowerCase().includes(q)) ||
                  (t.deviceName && t.deviceName.toLowerCase().includes(q)) ||
                  (t.topicName && t.topicName.toLowerCase().includes(q))
                )
              })

              if (q && filteredTags.length === 0 && !gw.gatewayName.toLowerCase().includes(q)) {
                return null
              }

              const gwTagIds = gw.tags.map(t => t._id)
              const selectedInGwCount = gwTagIds.filter(id => selectedTagIds.has(id)).length
              const allGwSelected = gwTagIds.length > 0 && selectedInGwCount === gwTagIds.length

              return (
                <div key={gw.gatewayId} className="border border-slate-200 bg-white shadow-xs">
                  {/* Gateway Section Header */}
                  <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <i className="pi pi-server text-slate-500 text-xs" />
                      <div>
                        <span className="text-xs font-bold text-slate-800">{gw.gatewayName}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">({gw.gatewayPrefix})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {selectedInGwCount} / {gw.tags.length} Selected
                      </span>
                      {gw.tags.length > 0 && (
                        <label className="flex items-center gap-1.5 text-xs font-bold text-blue-600 cursor-pointer select-none bg-blue-50 px-2 py-0.5 border border-blue-100 hover:bg-blue-100/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={allGwSelected}
                            onChange={() => toggleGateway(gw.tags)}
                            className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded-none focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Select All</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Gateway Tags Grid */}
                  <div className="p-3">
                    {gw.tags.length === 0 ? (
                      <div className="text-slate-400 italic text-[11px] py-1 text-center font-medium">
                        No parameters configured under this gateway.
                      </div>
                    ) : filteredTags.length === 0 ? (
                      <div className="text-slate-400 italic text-[11px] py-1 text-center font-medium">
                        No parameters match filter &quot;{assignSearch}&quot;
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredTags.map((tag) => {
                          const isChecked = selectedTagIds.has(tag._id)
                          return (
                            <label
                              key={tag._id}
                              className={`flex items-start gap-2.5 p-2.5 border cursor-pointer transition-all select-none ${
                                isChecked
                                  ? 'bg-blue-50/40 border-blue-300 shadow-xs'
                                  : 'bg-slate-50/20 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleTag(tag._id)}
                                className="mt-0.5 w-4 h-4 text-blue-600 border-slate-350 rounded-none focus:ring-blue-500 shrink-0 cursor-pointer accent-blue-600"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-slate-800 truncate" title={formatTagDisplayName(tag)}>
                                    {formatTagDisplayName(tag)}
                                  </span>
                                  {tag.unit && (
                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 shrink-0">
                                      {tag.unit}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                  Dev: <span className="text-slate-600 font-semibold">{tag.deviceName}</span> | Tag: <span className="text-slate-500 font-mono">{tag.parameterName}</span>
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold text-slate-500">
              {isDirty ? (
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <i className="pi pi-exclamation-circle text-xs" />
                  Unsaved parameter assignment changes
                </span>
              ) : (
                <span className="text-slate-400">No pending changes</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={savingAssignments}
                onClick={() => {
                  setAssignModalVisible(false)
                  setSelectedUserForAssign(null)
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-none transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAssignments || assignLoading}
                onClick={handleSaveAssignments}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 rounded-none transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {savingAssignments && <i className="pi pi-spin pi-spinner text-xs" />}
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
