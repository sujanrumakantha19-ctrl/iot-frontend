import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { Dialog } from 'primereact/dialog'
import CompanyFilterDropdown from '../../components/shared/CompanyFilterDropdown'
import { showToast } from '../../utils/toast'
import { usersApi } from '../../services/usersApi'
import { companiesApi } from '../../services/companiesApi'
import { gatewaysApi } from '../../services/gatewaysApi'
import { telemetryApi } from '../../services/telemetryApi'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import TableToolbar from '../../components/shared/TableToolbar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'

// Custom Tailwind MultiSelect Dropdown
function ManagerMultiSelect({ value, options, onChange, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOption = (optVal) => {
    const newVal = value.includes(optVal)
      ? value.filter(val => val !== optVal)
      : [...value, optVal]
    onChange(newVal)
  }

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  )

  const selectedOptions = options.filter(opt => value.includes(opt.value))

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected Box / Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full border border-slate-200 min-h-[38px] px-2.5 py-1.5 bg-white flex flex-wrap gap-1.5 items-center justify-between text-xs font-semibold text-slate-700 hover:border-slate-350 transition-colors focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 select-none ${
          disabled ? 'opacity-55 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
        }`}
      >
        <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          ) : (
            selectedOptions.map(opt => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200/50"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleOption(opt.value)
                  }}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold ml-0.5 text-xs"
                >
                  &times;
                </button>
              </span>
            ))
          )}
        </div>
        <i className={`pi pi-chevron-down text-[9px] text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Options Panel Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl z-[999] mt-1 space-y-1.5 p-2 rounded-none max-h-56 overflow-y-auto">
          {/* Search bar inside dropdown */}
          <div className="flex items-center border border-slate-200 px-2 h-7 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all w-full mb-1">
            <i className="pi pi-search text-[9px] text-slate-450 mr-1.5 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full text-[10px] text-slate-700 bg-transparent focus:outline-none placeholder-slate-400 font-semibold"
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                className="text-slate-400 hover:text-slate-650 ml-1 cursor-pointer shrink-0"
              >
                <i className="pi pi-times text-[8px]" />
              </button>
            )}
          </div>

          {/* Option rows list */}
          <div className="space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-4 text-slate-450 text-[10px] italic font-medium">
                No managers found.
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = value.includes(opt.value)
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleOption(opt.value)
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 transition-colors cursor-pointer select-none text-[11px] font-semibold text-slate-700 ${
                      isSelected ? 'bg-blue-50/10' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // toggled by parent div click
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500/20 border-slate-350 rounded cursor-pointer shrink-0"
                    />
                    <span className="truncate">{opt.label}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const PAGE_LIMIT = 10

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [companies, setCompanies] = useState([])
  const [managers, setManagers] = useState([])
  const [gateways, setGateways] = useState([])
  const [telemetryTags, setTelemetryTags] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState(null)
  const companyDebounce = useRef(null)
  const searchDebounce = useRef(null)

  // Dialog state
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyId: '',
    managerId: [],
    assignedGatewayIds: [],
    assignedTagIds: [],
    addressLabel: '',
    address: ''
  })
  const [search, setSearch] = useState('')

  const load = async (p, cf, s) => {
    try {
      setLoading(true)
      const params = { page: (p ?? page) + 1, limit: PAGE_LIMIT }
      if (cf ?? companyFilter) params.companyId = cf ?? companyFilter
      if (s ?? search) params.search = s ?? search

      const [eRes, cRes, m, g, t] = await Promise.all([
        usersApi.getEmployees(params).catch(() => ({ employees: [], total: 0 })),
        companiesApi.getAll().catch(() => ({ companies: [] })),
        usersApi.getManagers().catch(() => ({ managers: [] })),
        gatewaysApi.getAll().catch(() => ({ gateways: [] })),
        telemetryApi.getTelemetryTags().catch(() => [])
      ])
      setEmployees(eRes.employees || [])
      setTotal(eRes.total || 0)
      setCompanies(cRes.companies || [])
      setManagers(m.managers || [])
      setGateways(g.gateways || [])
      setTelemetryTags(t || [])
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
      managerId: [],
      assignedGatewayIds: [],
      assignedTagIds: [],
      addressLabel: '',
      address: ''
    })
    setDialog(true)
  }

  const openEdit = (emp) => {
    setEditing(emp)
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      confirmPassword: '',
      companyId: emp.companyId?._id || emp.companyId || '',
      managerId: emp.managerId ? (Array.isArray(emp.managerId) ? emp.managerId.map(m => m._id || m) : [emp.managerId._id || emp.managerId]) : [],
      assignedGatewayIds: emp.assignedGatewayIds ? emp.assignedGatewayIds.map(g => g._id || g) : [],
      assignedTagIds: emp.assignedTagIds ? emp.assignedTagIds.map(t => t._id || t) : [],
      addressLabel: emp.addressLabel || '',
      address: emp.address || ''
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

      if (!payload.addressLabel || !payload.addressLabel.trim()) {
        showToast({ severity: 'warn', summary: 'Warning', detail: 'Address Label is required' })
        return
      }
      if (!payload.address || !payload.address.trim()) {
        showToast({ severity: 'warn', summary: 'Warning', detail: 'Address is required' })
        return
      }

      if (editing) {
        await usersApi.updateEmployee(editing._id, payload)
        showToast({ severity: 'success', summary: 'Updated', detail: 'User updated', life: 2000 })
      } else {
        await usersApi.createEmployee(payload)
        showToast({ severity: 'success', summary: 'Created', detail: 'User created', life: 2000 })
      }
      setDialog(false)
      setPage(0)
      load(0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save failed', detail: err.message })
    }
  }

  const confirmDelete = (emp) => {
    setEmployeeToDelete(emp)
    setDeleteDialog(true)
  }

  const handleDelete = async () => {
    if (!employeeToDelete) return
    try {
      setDeleting(true)
      await usersApi.deleteEmployee(employeeToDelete._id)
      showToast({ severity: 'info', summary: 'Deleted', detail: 'User deleted', life: 2000 })
      setDeleteDialog(false)
      setEmployeeToDelete(null)
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Delete failed', detail: err.message })
    } finally {
      setDeleting(false)
    }
  }

  const actionBody = (row) => (
    <div className="flex gap-1.5 justify-end">
      <button
        onClick={() => openEdit(row)}
        className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center cursor-pointer transition-colors"
        title="Edit User"
      >
        <i className="pi pi-pencil text-sm" />
      </button>
      <button
        onClick={() => confirmDelete(row)}
        className="w-8 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
        title="Delete User"
      >
        <i className="pi pi-trash text-sm" />
      </button>
    </div>
  )

  const nameBody = (row) => (
    <span className="font-semibold text-slate-800">
      {row.name}
    </span>
  )

  const truncateText = (text, max = 10) => {
    if (!text) return ''
    if (text.length <= max) return text
    return text.substring(0, max) + '...'
  }

  const addressLabelBody = (row) => {
    const val = row.addressLabel || ''
    return (
      <span className="font-semibold text-slate-600" title={val}>
        {val ? truncateText(val, 10) : '-'}
      </span>
    )
  }

  const addressBody = (row) => {
    const val = row.address || ''
    return (
      <span className="text-slate-500 font-medium" title={val}>
        {val ? truncateText(val, 10) : '-'}
      </span>
    )
  }

  const managerColumnBody = (row, rowIndex) => {
    const managersList = Array.isArray(row.managerId)
      ? row.managerId
      : row.managerId
        ? [row.managerId]
        : []

    if (managersList.length === 0) {
      return <span className="text-slate-400 font-medium italic">-</span>
    }

    if (managersList.length === 1) {
      return <span className="font-semibold text-slate-700">{managersList[0].name}</span>
    }

    const showBelow = rowIndex < 2

    return (
      <div className="relative group inline-block cursor-help">
        <span className="font-semibold text-slate-700">{managersList[0].name} </span>
        <span className="text-blue-600 hover:text-blue-800 font-bold text-xs select-none">
          +{managersList.length - 1} more
        </span>
        
        {/* Custom CSS Hover Tooltip Card */}
        <div className={`absolute left-1/2 -translate-x-1/2 p-2.5 bg-slate-950 text-white text-[11px] font-semibold rounded shadow-xl opacity-0 pointer-events-none transition-all duration-200 z-50 w-48 text-left border border-slate-800 group-hover:opacity-100 group-hover:translate-y-0 ${
          showBelow 
            ? 'top-full mt-2 translate-y-[-4px]' 
            : 'bottom-full mb-2 translate-y-1'
        }`}>
          <div className="font-bold text-slate-400 border-b border-slate-800 pb-1 mb-1.5 uppercase tracking-wide text-[9px]">
            Reporting Managers ({managersList.length})
          </div>
          <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
            {managersList.map((m, idx) => (
              <div key={m._id || idx} className="flex items-center gap-1.5 py-0.5 truncate">
                <span className="w-1 h-1 bg-blue-500 rounded-full shrink-0" />
                <span className="truncate">{m.name}</span>
              </div>
            ))}
          </div>
          {/* Tooltip Arrow */}
          <div className={`absolute left-1/2 -translate-x-1/2 border-x-4 border-x-transparent ${
            showBelow
              ? 'bottom-full border-b-4 border-b-slate-950'
              : 'top-full border-t-4 border-t-slate-950'
          }`} />
        </div>
      </div>
    )
  }

  const companyId = form.companyId
  const filteredManagers = companyId ? managers.filter(m => (m.companyId?._id || m.companyId) === companyId) : managers
  const filteredGateways = companyId ? gateways.filter(g => (g.companyId?._id || g.companyId) === companyId) : gateways
  const filteredTelemetryTags = companyId ? telemetryTags.filter(t => (t.companyId?._id || t.companyId) === companyId) : telemetryTags

  if (initialLoading) return <LoadingSpinner text="Connecting operations users database..." />

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle="Manage users across companies and teams">
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
          New User
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <StatCard label="Total Users" value={total} icon="pi pi-user" color="green" />
        <StatCard label="Companies" value={companies.length} icon="pi pi-building" color="blue" />
        <StatCard label="Gateways Assigned" value={gateways.length} icon="pi pi-sitemap" color="amber" />
      </div>

      <div className="bg-white border border-slate-200/80">
        <div className="p-4 pb-0">
          <TableToolbar search={search} onSearchChange={handleSearch} searchPlaceholder="Search users..." />
        </div>
        {loading ? (
          <div className="py-12"><LoadingSpinner text="Searching users..." /></div>
        ) : (
          <>
            <DataTable
              value={employees}
              onRowClick={(e) => {
                if (e.originalEvent.target.closest('button, a, input, select')) return
                navigate(`/admin/employees/${e.data._id}`)
              }}
              rowClassName={() => 'cursor-pointer hover:bg-slate-50 transition-colors'}
              emptyMessage={<EmptyState message="No users found." description="Create new user accounts or refine your search parameters." icon="pi-user" />}
            >
              <Column header="Name" body={nameBody} sortable className="font-semibold text-slate-800" />
              <Column field="email" header="Email" />
              <Column field="companyId" header="Company" body={(r) => r.companyId?.name || 'Unknown'} sortable />
              <Column field="managerId" header="Manager" body={(r, options) => managerColumnBody(r, options.rowIndex)} />
              <Column field="addressLabel" header="Label" body={addressLabelBody} />
              <Column field="address" header="Address" body={addressBody} />
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
        header={editing ? 'Edit User' : 'New User'}
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
        <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
          
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

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Company</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value, managerId: [], assignedGatewayIds: [], assignedTagIds: [] })}
                className="w-full border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white cursor-pointer font-semibold text-slate-700 h-[38px]"
                required
              >
                <option value="" disabled>Select company</option>
                {companies.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Managers</label>
              <ManagerMultiSelect
                value={form.managerId}
                options={filteredManagers.map(m => ({ label: m.name, value: m._id }))}
                onChange={(val) => setForm({ ...form, managerId: val })}
                placeholder={filteredManagers.length === 0 ? "No managers in this company" : "Select reporting managers"}
                disabled={filteredManagers.length === 0}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Address Label <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.addressLabel}
                onChange={(e) => setForm({ ...form, addressLabel: e.target.value })}
                className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
                placeholder="e.g. Line 1 - Generator"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
                placeholder="Enter physical address or location"
                required
              />
            </div>

          </div>

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
            <h3 className="text-base font-bold text-slate-800">Delete User</h3>
            <p className="text-xs text-slate-500 font-medium max-w-[290px] leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800">"{employeeToDelete?.name}"</span>? This action cannot be undone.
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
    </div>
  )
}
