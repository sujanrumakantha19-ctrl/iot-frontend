import { useState, useEffect } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import TableToolbar from '../../components/shared/TableToolbar'
import ReactPaginator from '../../components/shared/ReactPaginator'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import EmptyState from '../../components/shared/EmptyState'
import AssetTwinRenderer from '../../components/assetTwins/AssetTwinRenderer'
import { assetTwinsApi } from '../../services/assetTwinsApi'
import useDebouncedSearch from '../../hooks/useDebouncedSearch'
import { showToast } from '../../utils/toast'

const PAGE_LIMIT = 10
const TEMPLATE_ID = 'MOTOR_2D_SIEMENS'

export default function AssetDigitalTwinPage() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const { search, debouncedSearch, setSearch } = useDebouncedSearch()

  const load = async (p = page, s = debouncedSearch) => {
    try {
      setLoading(true)
      const res = await assetTwinsApi.getCompanyAccess({
        page: p + 1,
        limit: PAGE_LIMIT,
        search: s
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load company access' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
    load(0, debouncedSearch)
  }, [debouncedSearch])

  const handleToggle = async (row) => {
    try {
      setTogglingId(row.companyId)
      await assetTwinsApi.setCompanyAccess({
        companyId: row.companyId,
        templateId: TEMPLATE_ID,
        enabled: !row.enabled
      })
      showToast({
        severity: 'success',
        summary: 'Updated',
        detail: `${row.companyName} — Motor Twin ${!row.enabled ? 'enabled' : 'disabled'}`,
        life: 2000
      })
      load()
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to update access' })
    } finally {
      setTogglingId(null)
    }
  }

  const enabledBody = (row) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={row.enabled}
        disabled={togglingId === row.companyId}
        onChange={() => handleToggle(row)}
        className="sr-only peer"
      />
      <div className="relative w-11 h-6 bg-slate-200 rounded-full peer peer-focus:outline-none peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
    </label>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">Asset Digital Twin</h1>
        <p className="text-sm text-slate-500 mt-1">Enable the Motor 2D digital twin template per company.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Template Preview — Motor 2D</h3>
        <AssetTwinRenderer templateId={TEMPLATE_ID} previewMode showHeader showFooter />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search companies..." />

        {loading && items.length === 0 ? (
          <LoadingSpinner text="Loading companies..." />
        ) : items.length === 0 ? (
          <EmptyState message="No companies found" description="Try adjusting your search." />
        ) : (
          <>
            <DataTable value={items} loading={loading} className="text-sm">
              <Column field="companyName" header="Company" />
              <Column header="Motor Twin Enabled" body={enabledBody} style={{ width: '180px' }} />
              <Column
                field="updatedAt"
                header="Last Updated"
                body={(row) => row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
              />
            </DataTable>
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
