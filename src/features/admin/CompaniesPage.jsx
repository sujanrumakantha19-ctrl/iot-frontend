import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { Dialog } from 'primereact/dialog'
import { showToast } from '../../utils/toast'
import { companiesApi } from '../../services/companiesApi'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import TableToolbar from '../../components/shared/TableToolbar'
import EmptyState from '../../components/shared/EmptyState'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

const PAGE_LIMIT = 10

export default function CompaniesPage() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [search, setSearch] = useState('')
  const searchDebounce = useRef(null)

  const load = async (p, s) => {
    try {
      setLoading(true)
      const params = { page: (p ?? page) + 1, limit: PAGE_LIMIT }
      if (s ?? search) params.search = s ?? search
      const { companies: data, total: t } = await companiesApi.getAll(params)
      setCompanies(data || [])
      setTotal(t || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  useEffect(() => { load(0, '') }, [])

  const handleSearch = (value) => {
    setSearch(value)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setPage(0)
      load(0, value)
    }, 500)
  }

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', description: '' })
    setDialog(true)
  }

  const openEdit = (company, e) => {
    e.stopPropagation()
    setEditing(company)
    setForm({ name: company.name, description: company.description })
    setDialog(true)
  }

  const save = async () => {
    try {
      if (editing) {
        await companiesApi.update(editing._id, form)
        showToast({ severity: 'success', summary: 'Updated', detail: 'Company updated', life: 2000 })
      } else {
        await companiesApi.create(form)
        showToast({ severity: 'success', summary: 'Created', detail: 'Company created', life: 2000 })
      }
      setDialog(false)
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save failed', detail: err.message })
    }
  }

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState({ visible: false, company: null })

  const handleDeleteClick = (company, e) => {
    e.stopPropagation()
    setDeleteModal({ visible: true, company })
  }

  const executeDelete = async () => {
    if (!deleteModal.company) return
    try {
      await companiesApi.delete(deleteModal.company._id)
      showToast({ severity: 'info', summary: 'Deleted', detail: 'Company deleted', life: 2000 })
      setDeleteModal({ visible: false, company: null })
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Delete failed', detail: err.message })
    }
  }

  const actionBody = (row) => (
    <div className="flex gap-1.5 justify-end">
      <button
        onClick={(e) => openEdit(row, e)}
        className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center cursor-pointer transition-colors"
        title="Edit Company"
      >
        <i className="pi pi-pencil text-sm" />
      </button>
      <button
        onClick={(e) => handleDeleteClick(row, e)}
        className="w-8 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
        title="Delete Company"
      >
        <i className="pi pi-trash text-sm" />
      </button>
    </div>
  )

  if (initialLoading) return <LoadingSpinner text="Connecting company databases..." />

  return (
    <div className="space-y-6">
      <PageHeader title="Companies" subtitle="Manage companies in your IoT platform">
        <button
          onClick={openNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-none font-semibold text-sm cursor-pointer"
        >
          <i className="pi pi-plus text-xs mr-1.5" />
          New Company
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <StatCard label="Total Companies" value={total} icon="pi pi-building" color="blue" />
        <StatCard label="Active Status" value={total} icon="pi pi-check-circle" color="green" />
        <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200/80 p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tip</p>
            <p className="text-xs text-slate-500 font-medium mt-1">Click a company row to view full details</p>
          </div>
          <i className="pi pi-info-circle text-slate-300 text-lg mr-2" />
        </div>
      </div>

      <div className="bg-white border border-slate-200/80">
        <div className="p-4 pb-0">
          <TableToolbar search={search} onSearchChange={handleSearch} searchPlaceholder="Search companies..." />
        </div>
        {loading ? (
          <div className="py-12"><LoadingSpinner text="Searching companies..." /></div>
        ) : (
          <>
            <DataTable
              value={companies}
              emptyMessage={<EmptyState message="No companies found." description="Create new company spaces or refine your search parameters." icon="pi-building" />}
              onRowClick={(e) => navigate(`/admin/companies/${e.data._id}`)}
              rowClassName="cursor-pointer hover:bg-slate-50/80 transition-colors"
            >
              <Column field="name" header="Name" sortable className="font-semibold text-slate-800" />
              <Column field="description" header="Description" body={(r) => <span className="truncate block max-w-md text-xs text-slate-600" title={r.description || ''}>{r.description || 'N/A'}</span>} />
              <Column field="createdAt" header="Created" sortable body={(r) => <span className="font-mono text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>} />
              <Column body={actionBody} header="Actions" style={{ width: '110px' }} />
            </DataTable>
            <ReactPaginator
              first={page * PAGE_LIMIT}
              rows={PAGE_LIMIT}
              totalRecords={total}
              onPageChange={(e) => { setPage(e.page); load(e.page) }}
            />
          </>
        )}
      </div>

      <Dialog
        header={editing ? 'Edit Company' : 'New Company'}
        visible={dialog}
        onHide={() => setDialog(false)}
        draggable={false}
        className="w-full max-w-lg"
        footer={
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setDialog(false)}
              className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-none font-semibold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-none font-semibold text-sm cursor-pointer"
            >
              Save
            </button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Company Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50 resize-y max-h-40 overflow-y-auto"
              rows={3}
            />
          </div>
        </div>
      </Dialog>

      {/* Centered Delete Confirmation Dialog */}
      <Dialog
        header="Delete Company Confirmation"
        visible={deleteModal.visible}
        onHide={() => setDeleteModal({ visible: false, company: null })}
        draggable={false}
        className="w-full max-w-md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteModal({ visible: false, company: null })}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={executeDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm"
            >
              Delete
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-3 text-xs text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800 text-sm">
            Are you sure you want to delete company <span className="text-rose-600 font-bold">"{deleteModal.company?.name}"</span>?
          </p>
          <p className="text-slate-500">
            This action is permanent and will remove all associated users, gateways, configurations, and telemetry tags under this company scope.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
