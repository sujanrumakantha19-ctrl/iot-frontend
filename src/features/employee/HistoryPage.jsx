import { useState, useEffect } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { showToast } from '../../utils/toast'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { getSession } from '../../services/auth'
import { telemetryApi } from '../../services/telemetryApi'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

export default function HistoryPage() {
  const session = getSession()
  const [tags, setTags] = useState([])
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  // Filters state
  const [selectedTagId, setSelectedTagId] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15)
  const [totalRecords, setTotalRecords] = useState(0)

  const loadTags = async () => {
    try {
      setLoading(true)
      const data = await telemetryApi.getEmployeeTelemetry()
      setTags(data || [])
      setReadings([])
      setTotalRecords(0)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load telemetry tags' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTags()
  }, [])

  const loadReadings = async (pageNum, limitNum = 15) => {
    try {
      setSearching(true)
      const data = await telemetryApi.getEmployeeReport(
        selectedTagId,
        startDate,
        endDate,
        pageNum,
        limitNum
      )
      setReadings(data.readings || [])
      setTotalRecords(data.total || 0)
      setPage(pageNum)
      setLimit(limitNum)
    } catch (err) {
      showToast({ severity: 'error', summary: 'Search Failed', detail: err.message })
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = (e) => {
    if (e) e.preventDefault()
    loadReadings(1, limit)
  }

  const exportData = async (format) => {
    if (readings.length === 0) {
      showToast({ severity: 'warn', summary: 'Warning', detail: 'No data to export. Perform a search first.' })
      return
    }

    try {
      // Log export action to backend DB
      await telemetryApi.exportEmployeeReport({
        tagId: selectedTagId,
        startDate,
        endDate,
        format
      })

      // Generate local download file
      let content = ''
      let filename = `employee_report_${new Date().toISOString().split('T')[0]}`
      let mimeType = 'text/plain'

      if (format === 'json') {
        content = JSON.stringify(readings, null, 2)
        filename += '.json'
        mimeType = 'application/json'
      } else {
        const headers = ['Timestamp', 'Device Name', 'Parameter', 'Topic', 'Value', 'Unit']
        const rows = readings.map(r => [
          r.timestamp,
          r.deviceName,
          r.parameterName,
          r.topicName,
          r.value,
          r.unit
        ])
        content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
        filename += '.csv'
        mimeType = 'text/csv'
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      showToast({ severity: 'success', summary: 'Exported', detail: `Downloaded page report as ${format.toUpperCase()}` })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Export Failed', detail: err.message })
    }
  }

  if (loading) return <LoadingSpinner text="Connecting your historical telemetry database..." />

  return (
    <div className="space-y-6">
      {/* Query Filters */}
      <div className="bg-white border border-slate-200/80 p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Query Historical Readings</h3>
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Telemetry Tag</label>
            <select
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="w-full border border-slate-200 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white font-semibold text-slate-700"
            >
              <option value="all">All Assigned Tags</option>
              {tags.map(t => (
                <option key={t._id} value={t._id}>{t.topicName} ({t.deviceName})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Start Date</label>
            <input
              type="date"
              className="w-full border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white text-slate-700"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">End Date</label>
            <input
              type="date"
              className="w-full border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white text-slate-700"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={searching}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 cursor-pointer transition-all shadow-none"
          >
            {searching ? 'Querying...' : 'Generate History Report'}
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i className="pi pi-history text-blue-500" />
            Telemetry Readings History ({totalRecords})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportData('csv')}
              disabled={readings.length === 0}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <i className="pi pi-file-excel text-emerald-600" />
              Export CSV
            </button>
            <button
              onClick={() => exportData('json')}
              disabled={readings.length === 0}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <i className="pi pi-file text-blue-600" />
              Export JSON
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 overflow-x-auto">
          <DataTable
            value={readings}
            loading={searching}
            emptyMessage="No reading history records retrieved. Adjust your filter and click Generate History Report."
            scrollable
          >
            <Column
              header="Timestamp"
              style={{ minWidth: '150px' }}
              body={(r) => <span className="font-mono text-slate-500 text-xs">{new Date(r.timestamp).toLocaleString()}</span>}
              sortable
              field="timestamp"
            />
            <Column field="deviceName" header="Device Name" style={{ minWidth: '110px' }} />
            <Column field="topicName" header="Parameter" style={{ minWidth: '100px' }} />
            <Column field="parameterName" header="Modbus Reg" style={{ minWidth: '100px' }} className="font-mono font-semibold" />
            <Column
              header="Value"
              style={{ minWidth: '80px' }}
              body={(r) => (
                <span className="font-mono font-bold text-slate-800">
                  {r.value !== null && r.value !== undefined ? String(r.value) : 'N/A'} <span className="text-[10px] text-slate-450 font-normal ml-0.5">{r.unit}</span>
                </span>
              )}
              sortable
              field="value"
            />
          </DataTable>
        </div>
        {readings.length > 0 && (
          <ReactPaginator
            totalRecords={totalRecords}
            rows={limit}
            first={(page - 1) * limit}
            onPageChange={(e) => {
              const nextPage = (e.first / e.rows) + 1
              loadReadings(nextPage, e.rows)
            }}
          />
        )}
      </div>
    </div>
  )
}
