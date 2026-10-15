import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { showToast } from '../../utils/toast'
import { gatewaysApi } from '../../services/gatewaysApi'
import { getSession } from '../../services/auth'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import TableToolbar from '../../components/shared/TableToolbar'
import StatusPill from '../../components/shared/StatusPill'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import CountdownModal from '../../components/shared/CountdownModal'

const PAGE_LIMIT = 10

export default function ManagerGatewaysPage() {
  const navigate = useNavigate()
  const session = getSession()
  const [gateways, setGateways] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchDebounce = useRef(null)

  // Countdown progress modal
  const [testingGwIds, setTestingGwIds] = useState([])
  const [countdown, setCountdown] = useState({ visible: false, title: '', subtitle: '' })

  const load = async (p = 0, s = '') => {
    try {
      setLoading(true)
      const params = {
        page: p + 1,
        limit: PAGE_LIMIT,
        companyId: session?.companyId
      }
      if (s) params.search = s
      const res = await gatewaysApi.getManagerGateways(params)
      setGateways(res.gateways || [])
      setTotal(res.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    load(0, '')
  }, [])

  const handleSearch = (value) => {
    setSearch(value)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setPage(0)
      load(0, value)
    }, 500)
  }

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
      setTestingGwIds(prev => prev.filter(id => id !== gatewayId))
      setCountdown({ visible: false, title: '', subtitle: '' })
    }
  }

  const statusBody = (row) => <StatusPill status={row.status} />

  const prefixBody = (row) => (
    <span className="font-mono text-xs font-semibold text-slate-800">
      {row.prefix}
    </span>
  )

  const nameBody = (row) => (
    <span className="font-semibold text-slate-800">
      {row.name}
    </span>
  )

  const actionBody = (row) => {
    const isTesting = testingGwIds.includes(row._id)
    return (
      <div className="flex gap-2 justify-end">
        <button
          onClick={(e) => handleTestAll(row._id, e)}
          disabled={isTesting}
          className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          title="Test Connection & Check Version"
        >
          {isTesting ? <i className="pi pi-spin pi-spinner text-[10px]" /> : <i className="pi pi-bolt text-[10px]" />}
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>
      </div>
    )
  }

  const isRestricted = session?.role === 'manager' && !session?.featurePermissions?.showGateway

  if (isRestricted) {
    return (
      <div className="bg-white border border-slate-200/80 p-8 sm:p-12 text-center rounded-xl space-y-4 shadow-sm my-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
          <i className="pi pi-ban" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Gateway Management Restricted</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
            Access to Gateway Management has been restricted for your manager account by your Administrator. Please contact your system administrator to adjust your permissions.
          </p>
        </div>
      </div>
    )
  }

  const onlineCount = gateways.filter(g => g.status === 'online').length

  if (initialLoading) return <LoadingSpinner text="Connecting company gateway nodes..." />

  return (
    <div className="space-y-6">
      <CountdownModal
        visible={countdown.visible}
        title={countdown.title}
        subtitle={countdown.subtitle}
        duration={10}
        onCancel={() => {
          setTestingGwIds([])
          setCountdown({ visible: false, title: '', subtitle: '' })
        }}
      />

      <PageHeader title="Gateways" subtitle="View and manage telemetry gateways for your company" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <StatCard label="Company Gateways" value={total} icon="pi pi-sitemap" color="blue" />
        <StatCard label="Online" value={onlineCount} icon="pi pi-wifi" color="emerald" />
        <StatCard label="Offline" value={total - onlineCount} icon="pi pi-exclamation-triangle" color="amber" />
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
              onRowClick={(e) => {
                if (e.originalEvent.target.closest('button, a, input, select')) return
                navigate(`/manager/gateways/${e.data._id}`)
              }}
              rowClassName={() => 'cursor-pointer hover:bg-slate-50 transition-colors'}
              emptyMessage={<EmptyState message="No gateways assigned." description="No telemetry gateways are assigned to your company scope." />}
            >
              <Column field="name" header="Gateway Name" body={nameBody} sortable className="font-semibold text-slate-800" />
              <Column field="prefix" header="Gateway Prefix / ID" body={prefixBody} sortable />
              <Column field="status" header="Status" body={statusBody} sortable />
              <Column field="version" header="Version" body={(r) => r.version || 'Unknown'} />
              <Column field="location" header="Site Location" body={(r) => r.location || 'N/A'} />
              <Column body={actionBody} header="Actions" style={{ width: '160px' }} />
            </DataTable>
            <ReactPaginator
              first={page * PAGE_LIMIT}
              rows={PAGE_LIMIT}
              totalRecords={total}
              onPageChange={(e) => { setPage(e.page); load(e.page, search) }}
            />
          </>
        )}
      </div>
    </div>
  )
}
