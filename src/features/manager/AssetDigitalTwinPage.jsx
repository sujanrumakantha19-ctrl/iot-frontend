import { useState, useEffect } from 'react'
import { Dialog } from 'primereact/dialog'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import TableToolbar from '../../components/shared/TableToolbar'
import ReactPaginator from '../../components/shared/ReactPaginator'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import AssetTwinFormModal from './AssetTwinFormModal'
import AssetTwinViewModal from './AssetTwinViewModal'
import { assetTwinsApi } from '../../services/assetTwinsApi'
import { assignApi } from '../../services/assignApi'
import useDebouncedSearch from '../../hooks/useDebouncedSearch'
import { showToast } from '../../utils/toast'

const PAGE_LIMIT = 10

export default function ManagerAssetDigitalTwinPage() {
  const [enabled, setEnabled] = useState(null)
  const [instances, setInstances] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [employees, setEmployees] = useState([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])
  const { search, debouncedSearch, setSearch } = useDebouncedSearch()

  const loadAccess = async () => {
    try {
      const res = await assetTwinsApi.getManagerAccessStatus()
      setEnabled(res.enabled === true)
    } catch {
      setEnabled(false)
    }
  }

  const loadInstances = async (p = page, s = debouncedSearch) => {
    try {
      setLoading(true)
      const res = await assetTwinsApi.listInstances({
        page: p + 1,
        limit: PAGE_LIMIT,
        search: s
      })
      setInstances(res.instances || [])
      setTotal(res.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load instances' })
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const data = await assignApi.getAssignEmployees()
      setEmployees(data || [])
    } catch {
      setEmployees([])
    }
  }

  useEffect(() => {
    loadAccess()
    loadEmployees()
  }, [])

  useEffect(() => {
    if (enabled) {
      setPage(0)
      loadInstances(0, debouncedSearch)
    }
  }, [debouncedSearch, enabled])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = async (row) => {
    try {
      const res = await assetTwinsApi.getInstance(row._id)
      setEditing(res.instance)
      setFormOpen(true)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load instance' })
    }
  }

  const openView = async (row) => {
    try {
      const res = await assetTwinsApi.getInstance(row._id)
      setViewing(res.instance)
      setViewOpen(true)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load twin view' })
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete asset twin "${row.name}"?`)) return
    try {
      await assetTwinsApi.deleteInstance(row._id)
      showToast({ severity: 'success', summary: 'Deleted', detail: 'Asset twin removed', life: 2000 })
      loadInstances()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Delete failed' })
    }
  }

  const openAssign = (row) => {
    setAssignTarget(row)
    setSelectedEmployeeIds((row.assignedEmployeeIds || []).map(id => id.toString()))
    setAssignOpen(true)
  }

  const saveAssign = async () => {
    try {
      await assetTwinsApi.assignEmployees(assignTarget._id, selectedEmployeeIds)
      showToast({ severity: 'success', summary: 'Saved', detail: 'Employee assignments updated', life: 2000 })
      setAssignOpen(false)
      loadInstances()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Assignment failed' })
    }
  }

  const actionsBody = (row) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer bg-transparent border-none p-0" onClick={() => openView(row)}>
        View
      </button>
      <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none p-0" onClick={() => openEdit(row)}>
        Edit
      </button>
      <button type="button" className="text-xs font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer bg-transparent border-none p-0" onClick={() => openAssign(row)}>
        Assign
      </button>
      <button type="button" className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer bg-transparent border-none p-0" onClick={() => handleDelete(row)}>
        Delete
      </button>
    </div>
  )

  if (enabled === null) {
    return <LoadingSpinner text="Checking template access..." />
  }

  if (!enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Asset Digital Twin</h1>
        </div>
        <EmptyState message="Asset Digital Twin not enabled" description="Contact your administrator to enable the Motor 2D template for your company." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Asset Digital Twin</h1>
          <p className="text-sm text-slate-500 mt-1">Configure motor instances, map telemetry tags, and assign employees.</p>
        </div>
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-bold cursor-pointer border-none">
          Create Instance
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search instances..." />

        {loading && instances.length === 0 ? (
          <LoadingSpinner text="Loading instances..." />
        ) : instances.length === 0 ? (
          <EmptyState message="No asset twins yet" description="Create your first motor digital twin instance." />
        ) : (
          <>
            <DataTable value={instances} loading={loading} className="text-sm">
              <Column field="name" header="Name" />
              <Column field="templateId" header="Template" />
              <Column header="Gateway" body={(row) => row.gateway?.name || '—'} />
              <Column header="Assigned" body={(row) => (row.assignedEmployeeIds?.length || 0)} />
              <Column header="Actions" body={actionsBody} style={{ width: '240px' }} />
            </DataTable>
            <ReactPaginator
              first={page * PAGE_LIMIT}
              rows={PAGE_LIMIT}
              totalRecords={total}
              onPageChange={(e) => {
                setPage(e.page)
                loadInstances(e.page, debouncedSearch)
              }}
            />
          </>
        )}
      </div>

      {formOpen && (
        <AssetTwinFormModal
          visible={formOpen}
          instance={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            loadInstances()
          }}
        />
      )}

      {viewOpen && (
        <AssetTwinViewModal
          visible={viewOpen}
          instance={viewing}
          onClose={() => {
            setViewOpen(false)
            setViewing(null)
          }}
        />
      )}

      <Dialog
        visible={assignOpen}
        onHide={() => setAssignOpen(false)}
        header={`Assign Employees — ${assignTarget?.name || ''}`}
        className="w-full max-w-md"
      >
        <div className="space-y-3 p-2">
          <p className="text-xs text-slate-500">
            Choose which employees can open this twin. Tag mapping is configured separately in Edit.
          </p>
          {employees.length === 0 ? (
            <p className="text-xs text-slate-400">No employees available</p>
          ) : (
            employees.map(emp => {
              const id = (emp._id || emp.id).toString()
              const checked = selectedEmployeeIds.includes(id)
              return (
                <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedEmployeeIds(prev =>
                        checked ? prev.filter(x => x !== id) : [...prev, id]
                      )
                    }}
                  />
                  <span>{emp.name}</span>
                </label>
              )
            })
          )}
          <button type="button" onClick={saveAssign} className="w-full py-2 bg-blue-800 text-white rounded-lg font-bold text-sm cursor-pointer border-none">
            Save Assignments
          </button>
        </div>
      </Dialog>
    </div>
  )
}
