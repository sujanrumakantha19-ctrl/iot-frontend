import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { Dialog } from 'primereact/dialog'
import CompanyFilterDropdown from '../../components/shared/CompanyFilterDropdown'
import { showToast } from '../../utils/toast'
import { usersApi } from '../../services/usersApi'
import { companiesApi } from '../../services/companiesApi'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import TableToolbar from '../../components/shared/TableToolbar'
import EmptyState from '../../components/shared/EmptyState'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import DynamicGraphRenderer, { GRAPH_REGISTRY } from '../../components/graphs/DynamicGraphRenderer'
import DynamicMeterRenderer, { METER_REGISTRY } from '../../components/meters/DynamicMeterRenderer'

const PAGE_LIMIT = 10

const RESTRICTED_MANAGER_PERMISSIONS = {
  showUsers: false,
  showGateway: false,
  gatewayFeatures: {
    showDeviceList: false,
    showPublish: false,
    showReadConfig: false,
    showWifi: false,
    showLocation: false,
    showPublishInterval: false
  }
}

export default function ManagersPage() {
  const navigate = useNavigate()
  const [managers, setManagers] = useState([])
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  
  // Dialog state
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [managerToDelete, setManagerToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  
  // Assign Permissions Config Modal State
  const [configModal, setConfigModal] = useState(false)
  const [configTab, setConfigTab] = useState('meters') // 'meters' | 'graphs'
  const [configSearch, setConfigSearch] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyId: '',
    assignPermissionMode: 'all',
    allowedGraphIds: [],
    allowedMeterTypes: [],
    featurePermissions: RESTRICTED_MANAGER_PERMISSIONS
  })

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState(null)
  const companyDebounce = useRef(null)
  const searchDebounce = useRef(null)

  const load = async (p, cf, s) => {
    try {
      setLoading(true)
      const params = { page: (p ?? page) + 1, limit: PAGE_LIMIT }
      if (cf ?? companyFilter) params.companyId = cf ?? companyFilter
      if (s ?? search) params.search = s ?? search
      const [mRes, cRes] = await Promise.all([usersApi.getManagers(params), companiesApi.getAll()])
      setManagers(mRes.managers || [])
      setTotal(mRes.total || 0)
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
    setForm({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyId: companies[0]?._id || '',
      assignPermissionMode: 'all',
      allowedGraphIds: [],
      allowedMeterTypes: [],
      featurePermissions: RESTRICTED_MANAGER_PERMISSIONS
    })
    setDialog(true)
  }

  const openEdit = (manager) => {
    setEditing(manager)
    setForm({
      name: manager.name,
      email: manager.email,
      password: '',
      confirmPassword: '',
      companyId: manager.companyId?._id || manager.companyId || '',
      assignPermissionMode: manager.assignPermissionMode || 'all',
      allowedGraphIds: manager.allowedGraphIds || [],
      allowedMeterTypes: manager.allowedMeterTypes || []
    })
    setDialog(true)
  }

  const save = async () => {
    try {
      const payload = { ...form }

      // Validate Passwords
      if (!editing) {
        if (!payload.password) {
          showToast({ severity: 'warn', summary: 'Warning', detail: 'Password is required' })
          return
        }
        if (payload.password !== payload.confirmPassword) {
          showToast({ severity: 'warn', summary: 'Warning', detail: 'Passwords do not match' })
          return
        }
        payload.featurePermissions = form.featurePermissions || RESTRICTED_MANAGER_PERMISSIONS
      } else {
        if (payload.password) {
          if (payload.password !== payload.confirmPassword) {
            showToast({ severity: 'warn', summary: 'Warning', detail: 'Passwords do not match' })
            return
          }
        } else {
          delete payload.password
        }
      }

      delete payload.confirmPassword

      if (editing) {
        await usersApi.updateManager(editing._id, payload)
        showToast({ severity: 'success', summary: 'Updated', detail: 'Manager updated', life: 2000 })
      } else {
        await usersApi.createManager(payload)
        showToast({ severity: 'success', summary: 'Created', detail: 'Manager created', life: 2000 })
      }
      setDialog(false)
      setPage(0)
      load(0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save failed', detail: err.message })
    }
  }

  const confirmDelete = (manager) => {
    setManagerToDelete(manager)
    setDeleteDialog(true)
  }

  const handleDelete = async () => {
    if (!managerToDelete) return
    try {
      setDeleting(true)
      await usersApi.deleteManager(managerToDelete._id)
      showToast({ severity: 'info', summary: 'Deleted', detail: 'Manager deleted', life: 2000 })
      setDeleteDialog(false)
      setManagerToDelete(null)
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Delete failed', detail: err.message })
    } finally {
      setDeleting(false)
    }
  }

  // Feature Permissions Modal State
  const [settingsModal, setSettingsModal] = useState(false)
  const [settingsManager, setSettingsManager] = useState(null)
  const [featurePerms, setFeaturePerms] = useState(RESTRICTED_MANAGER_PERMISSIONS)
  const [savingSettings, setSavingSettings] = useState(false)

  const openSettings = (manager) => {
    setSettingsManager(manager)
    const fp = manager.featurePermissions || {}
    const gf = fp.gatewayFeatures || {}
    setFeaturePerms({
      showUsers: fp.showUsers !== undefined ? fp.showUsers : false,
      showGateway: fp.showGateway !== undefined ? fp.showGateway : false,
      gatewayFeatures: {
        showDeviceList: gf.showDeviceList ?? false,
        showPublish: gf.showPublish ?? false,
        showReadConfig: gf.showReadConfig ?? false,
        showWifi: gf.showWifi ?? false,
        showLocation: gf.showLocation ?? false,
        showPublishInterval: gf.showPublishInterval ?? false,
      }
    })
    setSettingsModal(true)
  }

  const saveSettings = async () => {
    if (!settingsManager) return
    try {
      setSavingSettings(true)
      await usersApi.updateManager(settingsManager._id, { featurePermissions: featurePerms })
      showToast({ severity: 'success', summary: 'Saved', detail: 'Feature permissions updated successfully' })
      setSettingsModal(false)
      setSettingsManager(null)
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save failed', detail: err.message })
    } finally {
      setSavingSettings(false)
    }
  }

  const actionBody = (row) => (
    <div className="flex gap-1.5 justify-end">
      <button
        onClick={() => openSettings(row)}
        className="w-8 h-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center cursor-pointer transition-colors rounded"
        title="Configure Feature Permissions"
      >
        <i className="pi pi-cog text-sm" />
      </button>
      <button
        onClick={() => openEdit(row)}
        className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center cursor-pointer transition-colors rounded"
        title="Edit Manager"
      >
        <i className="pi pi-pencil text-sm" />
      </button>
      <button
        onClick={() => confirmDelete(row)}
        className="w-8 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors rounded"
        title="Delete Manager"
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

  const nameBody = (row) => (
    <span className="font-semibold text-slate-800">
      {row.name}
    </span>
  )

  const assignScopeBody = (row) => {
    const mode = row.assignPermissionMode || 'all'
    if (mode === 'restrict') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200/80">
          <i className="pi pi-ban text-[10px]" /> Restricted (Hidden)
        </span>
      )
    }
    if (mode === 'limit') {
      const meterCount = row.allowedMeterTypes?.length || 0
      const graphCount = row.allowedGraphIds?.length || 0
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200/80 cursor-help"
          title={`Allowed Items: ${meterCount} Digital Meters, ${graphCount} Graphs`}
        >
          <i className="pi pi-sliders-h text-[10px]" /> Limited ({meterCount + graphCount} items)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200/80">
        <i className="pi pi-check-circle text-[10px]" /> All Components
      </span>
    )
  }

  const featurePermsBody = (row) => {
    const fp = row.featurePermissions || {}
    const gf = fp.gatewayFeatures || {}
    const hasUsers = fp.showUsers !== false
    const hasGw = !!fp.showGateway
    const activeGwTabs = Object.values(gf).filter(Boolean).length

    return (
      <div className="flex flex-wrap items-center gap-1.5 min-w-[260px] py-1" title={`Users: ${hasUsers ? 'Allowed' : 'Disabled'} | Gateway: ${hasGw ? `${activeGwTabs} tabs active` : 'Disabled'}`}>
        {hasUsers ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <i className="pi pi-users text-[9px]" /> Users
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <i className="pi pi-users text-[9px]" /> No Users
          </span>
        )}

        {hasGw ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Gateway Tabs: ${activeGwTabs} active`}>
            <i className="pi pi-server text-[9px]" /> Gateway ({activeGwTabs})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <i className="pi pi-server text-[9px]" /> No Gateway
          </span>
        )}
      </div>
    )
  }

  // Registry lists for config modal
  const allMetersList = useMemo(() => Object.values(METER_REGISTRY), [])
  const allGraphsList = useMemo(() => Object.values(GRAPH_REGISTRY), [])

  const filteredConfigMeters = useMemo(() => {
    if (!configSearch) return allMetersList
    const q = configSearch.toLowerCase()
    return allMetersList.filter(m => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
  }, [allMetersList, configSearch])

  const filteredConfigGraphs = useMemo(() => {
    if (!configSearch) return allGraphsList
    const q = configSearch.toLowerCase()
    return allGraphsList.filter(g => (g.title || g.name || '').toLowerCase().includes(q) || (g.categoryLabel || g.category || '').toLowerCase().includes(q))
  }, [allGraphsList, configSearch])

  const toggleMeterSelection = (meterId) => {
    const prev = form.allowedMeterTypes || []
    const updated = prev.includes(meterId) ? prev.filter(id => id !== meterId) : [...prev, meterId]
    setForm({ ...form, allowedMeterTypes: updated })
  }

  const toggleGraphSelection = (graphId) => {
    const prev = form.allowedGraphIds || []
    const updated = prev.includes(graphId) ? prev.filter(id => id !== graphId) : [...prev, graphId]
    setForm({ ...form, allowedGraphIds: updated })
  }

  const selectAllMeters = () => setForm({ ...form, allowedMeterTypes: allMetersList.map(m => m.id) })
  const deselectAllMeters = () => setForm({ ...form, allowedMeterTypes: [] })
  const selectAllGraphs = () => setForm({ ...form, allowedGraphIds: allGraphsList.map(g => g.id) })
  const deselectAllGraphs = () => setForm({ ...form, allowedGraphIds: [] })

  if (initialLoading) return <LoadingSpinner text="Connecting operations managers database..." />

  return (
    <div className="space-y-6">
      <PageHeader title="Managers" subtitle="Manage managers across companies">
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
          New Manager
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <StatCard label="Total Managers" value={total} icon="pi pi-users" color="purple" />
        <StatCard label="Companies" value={companies.length} icon="pi pi-building" color="blue" />
        <StatCard label="Avg / Company" value={companies.length ? (total / companies.length).toFixed(1) : 0} icon="pi pi-chart-bar" color="indigo" />
      </div>

      <div className="bg-white border border-slate-200/80">
        <div className="p-4 pb-0">
          <TableToolbar search={search} onSearchChange={handleSearch} searchPlaceholder="Search managers..." />
        </div>
        {loading ? (
          <div className="py-12"><LoadingSpinner text="Searching managers..." /></div>
        ) : (
          <>
            <DataTable
              value={managers}
              onRowClick={(e) => {
                if (e.originalEvent.target.closest('button, a, input, select')) return
                navigate(`/admin/managers/${e.data._id}`)
              }}
              rowClassName={() => 'cursor-pointer hover:bg-slate-50 transition-colors'}
              emptyMessage={<EmptyState message="No managers found." description="Create new manager accounts or refine your search parameters." />}
            >
              <Column header="Name" body={nameBody} sortable className="font-semibold text-slate-800" />
              <Column field="email" header="Email" />
              <Column field="companyId" header="Company" body={companyBody} sortable />
              <Column header="Assign Access" body={assignScopeBody} />
              <Column header="Feature Scopes" body={featurePermsBody} style={{ minWidth: '280px' }} bodyStyle={{ whiteSpace: 'normal' }} headerStyle={{ whiteSpace: 'normal' }} />
              <Column body={actionBody} header="Actions" style={{ width: '120px' }} />
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

      {/* Main Create/Edit Manager Dialog */}
      <Dialog
        header={editing ? 'Edit Manager' : 'New Manager'}
        visible={dialog}
        onHide={() => setDialog(false)}
        draggable={false}
        className="w-full lg:w-[90vw] max-w-3xl"
        footer={
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
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
        <div className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto pr-1">
          {/* Grid Container for Side-by-Side Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Password {editing && <span className="text-[10px] text-slate-400 font-normal lowercase">(leave empty to keep current)</span>}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
                placeholder={editing ? '••••••••' : 'Enter account password'}
                required={!editing}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Confirm Password {editing && <span className="text-[10px] text-slate-400 font-normal lowercase">(leave empty to keep current)</span>}
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
                placeholder={editing ? '••••••••' : 'Confirm account password'}
                required={!editing}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Company Assignment</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                className="w-full border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white cursor-pointer font-semibold text-slate-700 h-[38px]"
                required
              >
                <option value="" disabled>Select company</option>
                {companies.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Assign Page Permission Selection */}
            <div className="space-y-2 sm:col-span-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <i className="pi pi-shield text-purple-600" />
                  Assign Page Permissions
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Controls component assignment scope in manager persona</span>
              </div>
              
              <select
                value={form.assignPermissionMode}
                onChange={(e) => setForm({ ...form, assignPermissionMode: e.target.value })}
                className="w-full border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer font-semibold text-slate-800 rounded shadow-sm"
              >
                <option value="all">All — Full access to all Digital Meters and Graphs on Assign Page</option>
                <option value="limit">Limit — Restrict to specific selected Digital Meters and Graphs</option>
                <option value="restrict">Restrict — Hide Assign Page entirely from Manager Sidebar</option>
              </select>

              {/* Configure Allowed Items trigger when 'limit' is selected */}
              {form.assignPermissionMode === 'limit' && (
                <div className="mt-3 p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <i className="pi pi-sliders-h text-purple-600 text-xs" />
                      Configured Allowed Components
                    </div>
                    <div className="text-[11px] text-purple-700 font-medium">
                      {(form.allowedMeterTypes || []).length} Digital Meters selected • {(form.allowedGraphIds || []).length} Graphs selected
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigModal(true)}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all shrink-0"
                  >
                    <i className="pi pi-cog text-xs" />
                    Configure Allowed Components
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </Dialog>

      {/* Configure Allowed Components Modal */}
      <Dialog
        header={
          <div className="flex items-center gap-2">
            <i className="pi pi-sliders-h text-purple-600 text-lg" />
            <div>
              <div className="text-base font-bold text-slate-800">Configure Allowed Components</div>
              <div className="text-xs text-slate-500 font-normal">Select which Digital Meters and Graphs this manager can view & assign</div>
            </div>
          </div>
        }
        visible={configModal}
        onHide={() => setConfigModal(false)}
        draggable={false}
        className="w-full lg:w-[90vw] max-w-4xl"
        footer={
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium">
              Total Selected: <span className="font-bold text-purple-700">{(form.allowedMeterTypes || []).length} Meters</span>, <span className="font-bold text-blue-700">{(form.allowedGraphIds || []).length} Graphs</span>
            </div>
            <button
              type="button"
              onClick={() => setConfigModal(false)}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-xs cursor-pointer shadow-sm"
            >
              Done / Save Selection
            </button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          {/* Header Controls: Search & Tabs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            {/* Tabs */}
            <div className="flex bg-slate-200/70 p-1 rounded-md text-xs font-bold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setConfigTab('meters')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md transition-all cursor-pointer ${
                  configTab === 'meters' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Digital Meters ({(form.allowedMeterTypes || []).length} / {allMetersList.length})
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('graphs')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md transition-all cursor-pointer ${
                  configTab === 'graphs' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Graphs ({(form.allowedGraphIds || []).length} / {allGraphsList.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={configSearch}
                onChange={(e) => setConfigSearch(e.target.value)}
                placeholder="Search component name..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
              />
            </div>
          </div>

          {/* Quick Action Helpers */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-500 font-medium">
              Click any card or checkbox to toggle permission access.
            </span>
            <div className="flex gap-2">
              {configTab === 'meters' ? (
                <>
                  <button type="button" onClick={selectAllMeters} className="text-purple-600 hover:underline font-semibold cursor-pointer">Select All Meters</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={deselectAllMeters} className="text-slate-500 hover:underline font-semibold cursor-pointer">Deselect All</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={selectAllGraphs} className="text-blue-600 hover:underline font-semibold cursor-pointer">Select All Graphs</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={deselectAllGraphs} className="text-slate-500 hover:underline font-semibold cursor-pointer">Deselect All</button>
                </>
              )}
            </div>
          </div>

          {/* Tab 1: Digital Meters Grid */}
          {configTab === 'meters' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[50vh] overflow-y-auto p-1">
              {filteredConfigMeters.map(meter => {
                const isChecked = (form.allowedMeterTypes || []).includes(meter.id)
                return (
                  <div
                    key={meter.id}
                    onClick={() => toggleMeterSelection(meter.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between select-none overflow-hidden ${
                      isChecked
                        ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2 shrink-0">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate" title={meter.name}>{meter.name}</div>
                        <span className="inline-block text-[9px] font-bold text-purple-700 uppercase tracking-wider bg-purple-100/70 px-1.5 py-0.5 rounded mt-0.5">
                          {meter.category}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div click
                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer shrink-0 mt-0.5"
                      />
                    </div>

                    <div className="h-36 w-full bg-slate-900 rounded-lg p-2 flex items-center justify-center border border-slate-800 overflow-hidden relative shrink-0">
                      <div className="w-full h-full flex items-center justify-center transform scale-75 origin-center">
                        <DynamicMeterRenderer type={meter.id} value={65} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tab 2: Graphs Grid */}
          {configTab === 'graphs' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[50vh] overflow-y-auto p-1">
              {filteredConfigGraphs.map(graph => {
                const isChecked = (form.allowedGraphIds || []).includes(graph.id)
                return (
                  <div
                    key={graph.id}
                    onClick={() => toggleGraphSelection(graph.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      isChecked
                        ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{graph.title || graph.name}</div>
                        <span className="inline-block text-[9px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded mt-0.5">
                          {graph.categoryLabel || graph.category}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div click
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0 mt-0.5"
                      />
                    </div>

                    <div className="h-36 w-full bg-slate-900 rounded-lg p-1.5 flex items-center justify-center border border-slate-800 overflow-hidden relative shrink-0">
                      <DynamicGraphRenderer type={graph.id} masterVal={65} height="100%" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <Dialog
        visible={deleteDialog}
        onHide={() => setDeleteDialog(false)}
        draggable={false}
        header={null}
        closable={false}
        className="w-full max-w-md"
      >
        <div className="pt-4 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <i className="pi pi-exclamation-triangle text-xl" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800">Delete Manager</h3>
            <p className="text-xs text-slate-500 font-medium max-w-[290px] leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800">"{managerToDelete?.name}"</span>? This action cannot be undone.
            </p>
          </div>
          
          <div className="flex gap-2.5 w-full pt-2">
            <button
              onClick={() => setDeleteDialog(false)}
              className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-none font-semibold text-xs cursor-pointer"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-none font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5"
              disabled={deleting}
            >
              {deleting && <i className="pi pi-spin pi-spinner text-[10px]" />}
              Delete Account
            </button>
          </div>
        </div>
      </Dialog>

      {/* Feature Permissions Settings Modal */}
      <Dialog
        header={
          <div className="flex items-center gap-2">
            <i className="pi pi-cog text-indigo-600 text-lg" />
            <div>
              <div className="text-base font-bold text-slate-800">
                Configure Feature Permissions ({settingsManager?.name})
              </div>
              <div className="text-xs text-slate-500 font-normal">
                Enable or disable sidebar modules and granular gateway capability tabs for this manager
              </div>
            </div>
          </div>
        }
        visible={settingsModal}
        onHide={() => setSettingsModal(false)}
        draggable={false}
        className="w-full lg:w-[90vw] max-w-2xl"
        footer={
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSettingsModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {savingSettings && <i className="pi pi-spin pi-spinner text-xs" />}
              Save Feature Permissions
            </button>
          </div>
        }
      >
        <div className="space-y-5 pt-2">
          {/* Section 1: Users Scope */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="pi pi-users text-blue-600 text-base" />
                <span className="text-sm font-bold text-slate-800">Users Sidebar Module</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={featurePerms.showUsers}
                  onChange={(e) => setFeaturePerms({ ...featurePerms, showUsers: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              When enabled, the manager can view the <strong className="text-slate-700">Users</strong> sidebar item to view managed employees and assign parameter tags. Managers cannot create or delete user accounts.
            </p>
          </div>

          {/* Section 2: Gateway Configuration Scope */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="pi pi-server text-indigo-600 text-base" />
                <span className="text-sm font-bold text-slate-800">Gateway Configuration Module</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={featurePerms.showGateway}
                  onChange={(e) => setFeaturePerms({ ...featurePerms, showGateway: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              When enabled, the manager sees the <strong className="text-slate-700">Gateways</strong> item in their sidebar (filtered strictly to their company). Select which gateway capability tabs this manager can access below:
            </p>

            {featurePerms.showGateway && (
              <div className="mt-3 p-3 bg-white border border-slate-200 rounded-md space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px] text-indigo-600">
                  Allowed Gateway Configuration Tabs:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'showDeviceList', label: 'Device List', icon: 'pi pi-list', desc: 'View/edit device list, edit device names, create devices' },
                    { key: 'showPublish', label: 'Publish MQTT', icon: 'pi pi-send', desc: 'Send MQTT instructions to gateway' },
                    { key: 'showReadConfig', label: 'Read Config', icon: 'pi pi-download', desc: 'Query active gateway config' },
                    { key: 'showWifi', label: 'Network', icon: 'pi pi-wifi', desc: 'Read selected network modes, priority & active interface' },
                    { key: 'showLocation', label: 'Set Location', icon: 'pi pi-map-marker', desc: 'Read and configure gateway site location' },
                    { key: 'showPublishInterval', label: 'Publish Interval', icon: 'pi pi-clock', desc: 'Adjust telemetry publish rate' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-start gap-2.5 p-2.5 rounded border border-slate-100 hover:border-slate-200 bg-slate-50/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!featurePerms.gatewayFeatures?.[item.key]}
                        onChange={(e) => {
                          setFeaturePerms({
                            ...featurePerms,
                            gatewayFeatures: {
                              ...featurePerms.gatewayFeatures,
                              [item.key]: e.target.checked
                            }
                          })
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <i className={`${item.icon} text-indigo-500 text-xs`} />
                          {item.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{item.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="text-[10px] text-rose-500 font-semibold italic flex items-center gap-1 mt-1 pt-2 border-t border-slate-100">
                  <i className="pi pi-shield text-[10px]" />
                  FOTA firmware update capabilities are restricted to system Administrators only.
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
