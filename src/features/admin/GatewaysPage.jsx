import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { Dialog } from 'primereact/dialog'
import CompanyFilterDropdown from '../../components/shared/CompanyFilterDropdown'
import { showToast } from '../../utils/toast'
import { gatewaysApi } from '../../services/gatewaysApi'
import { companiesApi } from '../../services/companiesApi'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import TableToolbar from '../../components/shared/TableToolbar'
import StatusPill from '../../components/shared/StatusPill'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import CountdownModal from '../../components/shared/CountdownModal'

const PAGE_LIMIT = 10

export default function GatewaysPage() {
  const navigate = useNavigate()
  const [gateways, setGateways] = useState([])
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', prefix: '', companyId: '', maxParameters: 1000 })
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState(null)
  const companyDebounce = useRef(null)
  const searchDebounce = useRef(null)

  // Countdown progress indicators
  const [testingGwIds, setTestingGwIds] = useState([])
  const [countdown, setCountdown] = useState({ visible: false, title: '', subtitle: '' })

  const handleTestAll = async (gatewayId, e) => {
    e.stopPropagation()
    if (testingGwIds.includes(gatewayId)) return
    setTestingGwIds(prev => [...prev, gatewayId])
    setCountdown({
      visible: true,
      title: 'Testing Gateway Connection',
      subtitle: 'Testing status & checking version via MQTT, waiting up to 10s...'
    })
    try {
      const res = await gatewaysApi.testAll(gatewayId)
      setGateways(prev => prev.map(g => g._id === gatewayId ? { ...g, status: res.status, version: res.version } : g))
      showToast({
        severity: res.status === 'online' ? 'success' : 'warn',
        summary: 'Test Connection Result',
        detail: `Status: ${res.status === 'online' ? 'Online' : 'Offline (No response)'}. Version: ${res.version || 'Unknown'}`
      })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Test Failed', detail: err.message })
    } finally {
      setTestingGwIds(prev => [...prev.filter(id => id !== gatewayId)])
      setCountdown(prev => ({ ...prev, visible: false }))
    }
  }

  const load = async (p, cf, s) => {
    try {
      setLoading(true)
      const params = { page: (p ?? page) + 1, limit: PAGE_LIMIT }
      if (cf ?? companyFilter) params.companyId = cf ?? companyFilter
      if (s ?? search) params.search = s ?? search
      const [gRes, cRes] = await Promise.all([gatewaysApi.getAll(params), companiesApi.getAll()])
      setGateways(gRes.gateways || [])
      setTotal(gRes.total || 0)
      setCompanies(cRes.companies || [])
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  useEffect(() => { load(0, null, '') }, [])

  const handleSearch = (value) => {
    setSearch(value)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setPage(0)
      load(0, null, value)
    }, 500)
  }

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', prefix: '', companyId: companies[0]?._id || '', maxParameters: 1000 })
    setDialog(true)
  }

  const openEdit = (gw) => {
    setEditing(gw)
    let pCount = 1000
    if (gw.maxParameters !== undefined && gw.maxParameters !== null && !isNaN(Number(gw.maxParameters)) && Number(gw.maxParameters) > 0) {
      pCount = Number(gw.maxParameters)
    } else if (gw.maxGroups !== undefined && gw.maxGroups !== null && !isNaN(Number(gw.maxGroups)) && Number(gw.maxGroups) > 0) {
      pCount = Number(gw.maxGroups) * 50
    }
    setForm({
      name: gw.name || '',
      prefix: gw.prefix || '',
      companyId: gw.companyId?._id || gw.companyId || '',
      maxParameters: pCount
    })
    setDialog(true)
  }

  const save = async () => {
    const maxP = parseInt(form.maxParameters, 10)
    if (isNaN(maxP) || maxP < 1) {
      showToast({ severity: 'warn', summary: 'Invalid Limit', detail: 'Maximum allowed parameters must be at least 1 (greater than 0).' })
      return
    }
    try {
      if (editing) {
        await gatewaysApi.update(editing._id, { ...form, maxParameters: maxP })
        showToast({ severity: 'success', summary: 'Updated', detail: 'Gateway updated', life: 2000 })
      } else {
        await gatewaysApi.create({ ...form, maxParameters: maxP })
        showToast({ severity: 'success', summary: 'Created', detail: 'Gateway created', life: 2000 })
      }
      setDialog(false)
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save failed', detail: err.message })
    }
  }

  // Delete confirmation state
  const [deleteModal, setDeleteModal] = useState({ visible: false, gateway: null })

  const handleDeleteClick = (gw) => {
    setDeleteModal({ visible: true, gateway: gw })
  }

  const executeDelete = async () => {
    if (!deleteModal.gateway) return
    try {
      await gatewaysApi.delete(deleteModal.gateway._id)
      showToast({ severity: 'info', summary: 'Deleted', detail: 'Gateway deleted', life: 2000 })
      setDeleteModal({ visible: false, gateway: null })
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Delete failed', detail: err.message })
    }
  }

  const actionBody = (row) => (
    <div className="flex gap-1.5 justify-end">
      <button
        onClick={(e) => handleTestAll(row._id, e)}
        className="w-8 h-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center cursor-pointer transition-colors"
        title="Test Status and Version"
      >
        <i className="pi pi-bolt text-sm" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          openEdit(row)
        }}
        className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center cursor-pointer transition-colors"
        title="Edit Gateway"
      >
        <i className="pi pi-pencil text-sm" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleDeleteClick(row)
        }}
        className="w-8 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
        title="Delete Gateway"
      >
        <i className="pi pi-trash text-sm" />
      </button>
    </div>
  )

  const companyBody = (row) => {
    if (row.companyId?.name) return row.companyId.name
    const match = companies.find(c => c._id === row.companyId)
    return match ? match.name : 'Unknown'
  }

  const versionBody = (row) => (
    <span className="font-semibold text-slate-700">{row.version || 'Unknown'}</span>
  )

  const statusColumnBody = (row) => {
    const isOnline = row.status === 'online'
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
        isOnline
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
          : 'bg-rose-50 text-rose-700 border border-rose-150'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        {row.status}
      </span>
    )
  }

  if (initialLoading) return <LoadingSpinner text="Connecting operations gateways database..." />

  return (
    <div className="space-y-6">
      <PageHeader title="Gateways" subtitle="Manage IoT gateways across companies">
        <CompanyFilterDropdown
          value={companyFilter}
          options={[{ label: 'All Companies', value: null }, ...companies.map(c => ({ label: c.name, value: c._id }))]}
          onChange={(val) => {
            clearTimeout(companyDebounce.current)
            companyDebounce.current = setTimeout(() => {
              setCompanyFilter(val)
              setPage(0)
              load(0, val, search)
            }, 500)
          }}
        />
        <button
          onClick={openNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-none font-semibold text-sm cursor-pointer"
        >
          <i className="pi pi-plus text-xs mr-1.5" />
          New Gateway
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <StatCard label="Total Gateways" value={total} icon="pi pi-sitemap" color="amber" />
        <StatCard label="Online Status" value={gateways.filter(g => g.status === 'online').length} icon="pi pi-check-circle" color="green" />
        <StatCard label="Offline Status" value={gateways.filter(g => g.status !== 'online').length} icon="pi pi-exclamation-circle" color="red" />
      </div>

      <div className="bg-white border border-slate-200/80">
        <div className="p-4 pb-0">
          <TableToolbar search={search} onSearchChange={handleSearch} searchPlaceholder="Search gateways..." />
        </div>
        {loading ? (
          <div className="py-12"><LoadingSpinner text="Searching gateways..." /></div>
        ) : (
          <>
            <DataTable
              value={gateways}
              emptyMessage={<EmptyState message="No gateways found." description="Register new gateway nodes or refine your search parameters." icon="pi-sitemap" />}
              rowClassName="cursor-pointer hover:bg-slate-50"
              onRowClick={(e) => {
                if (e.originalEvent.target.closest('button, a, input, select, svg, i')) return
                const companyId = e.data.companyId?._id || e.data.companyId
                if (!companyId) {
                  showToast({
                    severity: 'error',
                    summary: 'Navigation Error',
                    detail: 'Gateway has no assigned company. Cannot navigate.'
                  })
                  return
                }
                navigate(`/admin/companies/${companyId}/gateways/${e.data._id}`)
              }}
            >
              <Column field="name" header="Gateway ID" sortable className="font-semibold text-slate-800" />
              <Column field="version" header="Version" body={versionBody} sortable />
              <Column field="prefix" header="Prefix" className="font-mono text-slate-600" sortable />
              <Column field="location" header="Location" />
              <Column field="companyId" header="Company" body={companyBody} sortable />
              <Column field="status" header="Status" body={statusColumnBody} sortable />
              <Column body={actionBody} header="Actions" style={{ width: '110px' }} />
            </DataTable>
            <ReactPaginator
              first={page * PAGE_LIMIT}
              rows={PAGE_LIMIT}
              totalRecords={total}
              onPageChange={(e) => { setPage(e.page); load(e.page, null, search) }}
            />
          </>
        )}
      </div>

      <Dialog
        header={editing ? 'Edit Gateway' : 'New Gateway'}
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gateway Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
              required
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">Topic Prefix (Unique)</label>
            <input
              type="text"
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value })}
              className="w-full border border-slate-200 px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
              placeholder="e.g. gw-alpha"
              required
            />
            <p className="text-[10px] text-slate-400">Must contain only letters, numbers, hyphens, and underscores.</p>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Company Assignment</label>
            <select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              className="w-full border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white cursor-pointer font-semibold text-slate-700"
              required
            >
              <option value="" disabled>Select company</option>
              {companies.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Maximum Allowed Parameters</label>
              <span className="text-[10px] font-semibold text-slate-400">Default: 1000 (1–5000)</span>
            </div>
            <input
              type="number"
              min={1}
              max={5000}
              value={form.maxParameters !== undefined && form.maxParameters !== null ? form.maxParameters : ''}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setForm(prev => ({ ...prev, maxParameters: '' }))
                } else {
                  const parsed = parseInt(val, 10)
                  setForm(prev => ({ ...prev, maxParameters: isNaN(parsed) ? '' : Math.max(1, parsed) }))
                }
              }}
              className="w-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
              placeholder="1000"
            />
            <p className="text-[10px] text-slate-400">
              Allocates 50 parameters per group (e.g. 70 parameters allows 2 groups: G1 with 50 params and G2 with 20 params).
            </p>
          </div>
        </div>
      </Dialog>

      {/* Centered Delete Confirmation Dialog */}
      <Dialog
        header="Delete Gateway Confirmation"
        visible={deleteModal.visible}
        onHide={() => setDeleteModal({ visible: false, gateway: null })}
        draggable={false}
        className="w-full max-w-md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteModal({ visible: false, gateway: null })}
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
            Are you sure you want to delete gateway <span className="text-rose-600 font-bold">"{deleteModal.gateway?.name}"</span>?
          </p>
          <p className="text-slate-500">
            This will permanently remove the gateway node along with all associated parameter configurations and user tag assignments.
          </p>
        </div>
      </Dialog>

      <CountdownModal
        visible={countdown.visible}
        title={countdown.title}
        subtitle={countdown.subtitle}
        duration={10}
        onCancel={() => setCountdown(prev => ({ ...prev, visible: false }))}
      />
    </div>
  )
}
