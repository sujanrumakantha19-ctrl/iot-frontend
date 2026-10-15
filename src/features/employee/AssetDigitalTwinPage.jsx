import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactPaginator from '../../components/shared/ReactPaginator'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import TableToolbar from '../../components/shared/TableToolbar'
import { assetTwinsApi } from '../../services/assetTwinsApi'
import useDebouncedSearch from '../../hooks/useDebouncedSearch'
import { showToast } from '../../utils/toast'

const PAGE_LIMIT = 10

export default function EmployeeAssetDigitalTwinPage() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const { search, debouncedSearch, setSearch } = useDebouncedSearch()

  const load = async (p = page, s = debouncedSearch) => {
    try {
      setLoading(true)
      const res = await assetTwinsApi.listAssigned({
        page: p + 1,
        limit: PAGE_LIMIT,
        search: s
      })
      setInstances(res.instances || [])
      setTotal(res.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load asset twins' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
    load(0, debouncedSearch)
  }, [debouncedSearch])

  if (loading && instances.length === 0) {
    return <LoadingSpinner text="Loading asset digital twins..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">Asset Digital Twin</h1>
        <p className="text-sm text-slate-500 mt-1">View assigned motor digital twins with live telemetry.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search twins..." />

        {instances.length === 0 ? (
          <EmptyState message="No asset twins assigned" description="Your manager has not assigned any digital twins to you yet." />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {instances.map(inst => (
                <button
                  key={inst._id}
                  type="button"
                  onClick={() => navigate(`/employee/asset-digital-twin/${inst._id}`)}
                  className="text-left border border-slate-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all bg-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold text-slate-800">{inst.name}</h3>
                    <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Motor 2D</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{inst.gateway?.name || 'No gateway linked'}</p>
                  <p className="text-xs text-slate-400 mt-2">Click to open live twin view</p>
                </button>
              ))}
            </div>
            <ReactPaginator
              first={page * PAGE_LIMIT}
              rows={PAGE_LIMIT}
              totalRecords={total}
              onPageChange={(e) => {
                setPage(e.page)
                load(e.page, debouncedSearch)
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
