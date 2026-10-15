import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { companiesApi } from '../../services/companiesApi'
import { gatewaysApi } from '../../services/gatewaysApi'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { Dialog } from 'primereact/dialog'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

const PAGE_LIMIT = 6

const renderEmptyState = (message, icon = 'pi-inbox') => (
  <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
    <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
      <i className={`pi ${icon} text-sm`} />
    </div>
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-slate-700">{message}</p>
      <p className="text-[10px] text-slate-400 font-light">No records found in this category.</p>
    </div>
  </div>
)

export default function CompanyDetailPage() {
  const { companyId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  // Pagination state
  const [managersPage, setManagersPage] = useState(0)
  const [employeesPage, setEmployeesPage] = useState(0)
  const [gatewaysPage, setGatewaysPage] = useState(0)

  const loadData = async (mPage, ePage, gPage) => {
    try {
      setLoading(true)
      const params = {
        managersPage: (mPage ?? managersPage) + 1,
        managersLimit: PAGE_LIMIT,
        employeesPage: (ePage ?? employeesPage) + 1,
        employeesLimit: PAGE_LIMIT,
        gatewaysPage: (gPage ?? gatewaysPage) + 1,
        gatewaysLimit: PAGE_LIMIT
      }
      const res = await companiesApi.getDetail(companyId, params)
      setData(res)
      if (res?.company?.name) {
        window.companyNameCache = { ...window.companyNameCache, [companyId]: res.company.name }
        window.dispatchEvent(new Event('breadcrumbs:update'))
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load details' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyId) loadData(0, 0, 0)
  }, [companyId])

  if (loading) return <LoadingSpinner text="Loading Company details..." />
  if (!data) return <div className="p-6 text-center text-slate-450">Company not found.</div>

  const { company, managers, employees, gateways, counts } = data

  return (
    <div className="space-y-6">
      {/* Description Panel */}
      <div className="bg-white border border-slate-200/80 p-5 space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">About Company</h3>
        <p className="text-sm font-medium text-slate-700">{company.description || 'No description provided.'}</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200/80 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Managers</p>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{counts.managers}</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl border border-indigo-100">
            <i className="pi pi-users" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Employees</p>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{counts.employees}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl border border-emerald-100">
            <i className="pi pi-id-card" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gateways</p>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{counts.gateways}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-900 flex items-center justify-center text-xl border border-blue-100">
            <i className="pi pi-sitemap" />
          </div>
        </div>
      </div>

      {/* Lists Tabs / Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Company Managers Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="pi pi-users text-indigo-500" />
              Company Managers
            </h3>
            <button
              onClick={() => navigate('/admin/managers')}
              className="text-slate-400 hover:text-blue-600 cursor-pointer p-0.5 transition-colors"
              title="View all managers"
            >
              <i className="pi pi-arrow-up-right text-[10px]" />
            </button>
          </div>
          <div className="bg-white border border-slate-200/80">
            <DataTable value={managers} emptyMessage={renderEmptyState("No managers assigned to this company.", "pi-users")}>
              <Column field="name" header="Name" className="font-semibold text-slate-800" />
              <Column field="email" header="Email" />
              <Column field="active" header="Status" body={(r) => (
                <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${r.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {r.active ? 'Active' : 'Inactive'}
                </span>
              )} />
            </DataTable>
            <ReactPaginator
               first={managersPage * PAGE_LIMIT}
               rows={PAGE_LIMIT}
               totalRecords={counts.managers}
               onPageChange={(e) => { setManagersPage(e.page); loadData(e.page, null, null) }}
             />
          </div>
        </div>

        {/* Company Employees Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="pi pi-id-card text-emerald-500" />
              Company Employees
            </h3>
            <button
              onClick={() => navigate('/admin/employees')}
              className="text-slate-400 hover:text-blue-600 cursor-pointer p-0.5 transition-colors"
              title="View all employees"
            >
              <i className="pi pi-arrow-up-right text-[10px]" />
            </button>
          </div>
          <div className="bg-white border border-slate-200/80">
            <DataTable value={employees} emptyMessage={renderEmptyState("No employees assigned to this company.", "pi-id-card")}>
              <Column field="name" header="Name" className="font-semibold text-slate-800" />
              <Column field="email" header="Email" />
              <Column field="active" header="Status" body={(r) => (
                <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${r.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {r.active ? 'Active' : 'Inactive'}
                </span>
              )} />
            </DataTable>
            <ReactPaginator
               first={employeesPage * PAGE_LIMIT}
               rows={PAGE_LIMIT}
               totalRecords={counts.employees}
               onPageChange={(e) => { setEmployeesPage(e.page); loadData(null, e.page, null) }}
             />
          </div>
        </div>

      </div>

      {/* Gateways Management section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="pi pi-sitemap text-blue-500" />
              Company Gateways
            </h3>
            <button
              onClick={() => navigate('/admin/gateways')}
              className="text-slate-400 hover:text-blue-600 cursor-pointer p-0.5 transition-colors"
              title="View all gateways"
            >
              <i className="pi pi-arrow-up-right text-[10px]" />
            </button>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80">
          <DataTable
            value={gateways}
            emptyMessage={renderEmptyState("No gateways configured for this company.", "pi-sitemap")}
            onRowClick={(e) => navigate(`/admin/companies/${companyId}/gateways/${e.data._id}`)}
            rowClassName="cursor-pointer hover:bg-slate-50"
          >
            <Column field="name" header="Name" className="font-semibold text-slate-800" />
            <Column field="prefix" header="Prefix" className="font-mono text-slate-600" />
            <Column field="location" header="Location" />
            <Column field="status" header="Status" body={(r) => (
              <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${r.status === 'online' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                {r.status}
              </span>
            )} />
          </DataTable>
          <ReactPaginator
             first={gatewaysPage * PAGE_LIMIT}
             rows={PAGE_LIMIT}
             totalRecords={counts.gateways}
             onPageChange={(e) => { setGatewaysPage(e.page); loadData(null, null, e.page) }}
           />
        </div>
      </div>

      {/* Create Gateway Dialog */}
    </div>
  )
}
