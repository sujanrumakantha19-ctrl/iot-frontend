import { useState, useEffect, useMemo } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { getSession } from '../../services/auth'
import { telemetryApi } from '../../services/telemetryApi'
import StatCard from '../../components/shared/StatCard'
import StatusPill from '../../components/shared/StatusPill'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import ReactPaginator from '../../components/shared/ReactPaginator'

export default function DevicesPage() {
  const session = getSession()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [first, setFirst] = useState(0)
  const rows = 10

  const paginatedDevices = useMemo(() => {
    return devices.slice(first, first + rows)
  }, [devices, first, rows])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const list = await telemetryApi.getEmployeeDevices()
      setDevices(list || [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load assigned devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const tagsBody = (row) => (
    <div className="flex flex-wrap gap-1.5">
      {(row.tags || []).map(t => (
        <span key={t.id} className="inline-flex items-center text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 font-medium">
          {t.name}
          {t.unit && <span className="text-slate-400 ml-1 font-mono text-[9px]">({t.unit})</span>}
        </span>
      ))}
      {(!row.tags || row.tags.length === 0) && <span className="text-xs text-slate-400 font-light">No tags registered</span>}
    </div>
  )

  if (loading) return <LoadingSpinner text="Connecting your devices..." />

  if (error) {
    return (
      <div className="py-12 text-center max-w-md mx-auto space-y-4">
        <i className="pi pi-exclamation-circle text-rose-500 text-4xl" />
        <h3 className="text-lg font-bold text-slate-800">Connection Failed</h3>
        <p className="text-sm text-slate-500">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm cursor-pointer"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Assigned Gateways" value={devices.length} icon="pi pi-sitemap" color="blue" />
        <StatCard label="Total Device Tags" value={devices.reduce((acc, d) => acc + (d.tags || []).length, 0)} icon="pi pi-tag" color="green" />
        <StatCard
          label="Online Nodes"
          value={devices.filter(d => d.status === 'online').length}
          icon="pi pi-check-circle"
          color="green"
        />
      </div>

      <div className="bg-white border border-slate-200/80 overflow-x-auto">
        <DataTable value={paginatedDevices} emptyMessage="No devices assigned to you." scrollable>
          <Column field="name" header="Gateway Node" sortable style={{ minWidth: '130px' }} className="font-semibold text-slate-800" />
          <Column field="prefix" header="Prefix" style={{ minWidth: '80px' }} className="font-mono text-xs text-slate-500" sortable />
          <Column field="location" header="Installation Location" style={{ minWidth: '130px' }} />
          <Column field="status" header="Status" body={(r) => <StatusPill status={r.status} />} style={{ minWidth: '80px' }} sortable />
          <Column header="Registered Telemetry Tags" style={{ minWidth: '200px' }} body={tagsBody} />
        </DataTable>
      </div>
      <ReactPaginator
        totalRecords={devices.length}
        rows={rows}
        first={first}
        onPageChange={(e) => setFirst(e.first)}
      />
    </div>
  )
}
