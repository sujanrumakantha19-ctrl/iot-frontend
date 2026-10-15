import { useState, useEffect } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { showToast } from '../../utils/toast'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { getSession } from '../../services/auth'
import { telemetryApi } from '../../services/telemetryApi'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatTagDisplayName } from '../../utils/tagUtils'

export default function ReportPage() {
  const session = getSession()
  const isEmployee = session?.role === 'employee'
  const [tags, setTags] = useState([])
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  // Filters state
  const [selectedEmpId, setSelectedEmpId] = useState(
    localStorage.getItem('manager_selected_employee') || 'all'
  )
  const [selectedTagId, setSelectedTagId] = useState('all')
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagSearchText, setTagSearchText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(12)
  const [totalRecords, setTotalRecords] = useState(0)

  // Backend-driven telemetry tag search & loader (debounced 500ms)
  useEffect(() => {
    let active = true
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = isEmployee
          ? await telemetryApi.getEmployeeTelemetry(tagSearchText)
          : await telemetryApi.getManagerTelemetry(selectedEmpId, tagSearchText)
        const list = (res && res.tags) || []
        if (active) {
          setTags(list)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load telemetry tags:', err)
        if (active) setLoading(false)
      }
    }, 500)

    return () => {
      active = false
      clearTimeout(delayDebounceFn)
    }
  }, [selectedEmpId, tagSearchText, isEmployee])

  // Listener for manager scope change (resets queries and filters)
  useEffect(() => {
    const handleScopeChange = () => {
      const empId = localStorage.getItem('manager_selected_employee') || 'all'
      setSelectedEmpId(empId)
      setSelectedTagId('all')
      setTagSearchText('')
      setReadings([])
      setTotalRecords(0)
    }
    window.addEventListener('manager_employee_changed', handleScopeChange)

    return () => {
      window.removeEventListener('manager_employee_changed', handleScopeChange)
    }
  }, [])

  const [emptyReason, setEmptyReason] = useState('')
  const [exportingFormat, setExportingFormat] = useState(null) // 'csv' | 'json' | null

  const setDatePreset = (preset) => {
    const today = new Date()
    const formatDate = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    if (preset === 'today') {
      const todayStr = formatDate(today)
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (preset === '7days') {
      const past7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      setStartDate(formatDate(past7))
      setEndDate(formatDate(today))
    } else if (preset === '30days') {
      const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      setStartDate(formatDate(past30))
      setEndDate(formatDate(today))
    } else if (preset === 'clear') {
      setStartDate('')
      setEndDate('')
    }
  }

  const loadReadings = async (pageNum, limitNum = 12) => {
    try {
      setSearching(true)
      const formattedStart = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined
      const formattedEnd = endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : undefined

      const data = isEmployee
        ? await telemetryApi.getEmployeeReport(selectedTagId, formattedStart, formattedEnd, pageNum, limitNum)
        : await telemetryApi.getManagerReport(
            selectedEmpId,
            selectedTagId,
            formattedStart,
            formattedEnd,
            pageNum,
            limitNum
          )
      setReadings(data.readings || [])
      setTotalRecords(data.total || 0)
      setEmptyReason(data.reason || '')
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
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      showToast({ severity: 'warn', summary: 'Invalid Date Range', detail: 'Start Date must be before or equal to End Date.' })
      return
    }
    loadReadings(1, limit)
  }

  // Backend-Driven Report Download (CSV / JSON) with instant fallback
  const exportData = async (format) => {
    if (readings.length === 0 && totalRecords === 0) {
      showToast({ severity: 'warn', summary: 'Warning', detail: 'No data to export. Perform a search first.' })
      return
    }

    try {
      setExportingFormat(format)
      const formattedStart = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined
      const formattedEnd = endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : undefined

      const response = isEmployee
        ? await telemetryApi.downloadEmployeeReport(selectedTagId, formattedStart, formattedEnd, format)
        : await telemetryApi.downloadManagerReport(selectedEmpId, selectedTagId, formattedStart, formattedEnd, format)

      const mimeType = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;'
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: mimeType })

      const contentDisposition = response.headers?.['content-disposition'] ||
        (response.headers?.get && response.headers.get('content-disposition')) || ''
      let filename = `report_${new Date().toISOString().split('T')[0]}.${format}`
      const match = String(contentDisposition).match(/filename="?([^";]+)"?/)
      if (match && match[1]) {
        filename = match[1]
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        try {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } catch {}
      }, 60000)

      showToast({
        severity: 'success',
        summary: 'Download Complete',
        detail: `Report downloaded successfully as ${format.toUpperCase()}`
      })
    } catch (err) {
      // If backend download encountered an issue, fallback to exporting loaded page readings
      if (readings && readings.length > 0) {
        try {
          const dateStr = new Date().toISOString().split('T')[0]
          let content = ''
          let filename = `report_${dateStr}.${format}`
          let mimeType = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;'
          if (format === 'json') {
            content = JSON.stringify(readings, null, 2)
          } else {
            const headers = ['Timestamp', 'Device Name', 'Parameter Label', 'Value', 'Unit']
            const rows = readings.map(r => [
              r.timestamp,
              `"${(r.deviceName || '').replace(/"/g, '""')}"`,
              `"${(formatTagDisplayName(r) || '').replace(/"/g, '""')}"`,
              r.value !== null && r.value !== undefined ? r.value : '',
              `"${(r.unit || '').replace(/"/g, '""')}"`
            ])
            content = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n')
          }
          const fallbackBlob = new Blob([content], { type: mimeType })
          const fallbackUrl = URL.createObjectURL(fallbackBlob)
          const a = document.createElement('a')
          a.href = fallbackUrl
          a.download = filename
          a.style.display = 'none'
          document.body.appendChild(a)
          a.click()
          setTimeout(() => {
            try {
              document.body.removeChild(a)
              URL.revokeObjectURL(fallbackUrl)
            } catch {}
          }, 60000)
          showToast({
            severity: 'success',
            summary: 'Download Complete',
            detail: `Report downloaded successfully as ${format.toUpperCase()}`
          })
          return
        } catch (fallbackErr) {
          console.error('Fallback export error:', fallbackErr)
        }
      }

      let errorDetail = err.message || 'Download failed'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          const json = JSON.parse(text)
          if (json.message) errorDetail = json.message
        } catch {}
      } else if (err.response?.data?.message) {
        errorDetail = err.response.data.message
      }

      showToast({
        severity: 'error',
        summary: 'Export Failed',
        detail: errorDetail
      })
    } finally {
      setExportingFormat(null)
    }
  }

  if (loading) return <LoadingSpinner text="Connecting report databases..." />

  return (
    <div className="space-y-6">
      
      {/* Query Filter Grid panel */}
      <div className="bg-white border border-slate-200/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Query Report Parameters</h3>
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer rounded-none transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('7days')}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer rounded-none transition-colors"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('30days')}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer rounded-none transition-colors"
            >
              Last 30 Days
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => setDatePreset('clear')}
                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer rounded-none transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 relative">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Telemetry Tag</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                className="w-full border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white cursor-pointer font-semibold text-slate-700 h-[38px] flex items-center justify-between text-left select-none rounded-none"
              >
                <span className="truncate">
                  {selectedTagId === 'all' 
                    ? 'All Tags' 
                    : (() => {
                        const matched = tags.find(t => t._id === selectedTagId)
                        return matched ? `${formatTagDisplayName(matched)} (${matched.deviceName})` : 'All Tags'
                      })()
                  }
                </span>
                <i className={`pi pi-chevron-down text-slate-400 text-[10px] transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {tagDropdownOpen && (
                <>
                  {/* Backdrop click to close dropdown */}
                  <div className="fixed inset-0 z-30" onClick={() => setTagDropdownOpen(false)} />
                  
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 shadow-lg z-40 max-h-60 flex flex-col min-w-[200px] rounded-none">
                    {/* Search Input Box */}
                    <div className="p-2 border-b border-slate-100 shrink-0 flex items-center bg-slate-50/50">
                      <i className="pi pi-search text-[10px] text-slate-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={tagSearchText}
                        onChange={(e) => setTagSearchText(e.target.value)}
                        placeholder="Search tags (type to query)..."
                        className="w-full text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-400 font-semibold h-7"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {tagSearchText && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTagSearchText('') }}
                          className="text-slate-400 hover:text-slate-650 ml-1 cursor-pointer shrink-0"
                        >
                          <i className="pi pi-times text-[9px]" />
                        </button>
                      )}
                    </div>

                    {/* Options list */}
                    <div className="overflow-y-auto flex-1 py-1">
                      {/* Always show All Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTagId('all')
                          setTagDropdownOpen(false)
                        }}
                        className={`w-full px-3 py-2 text-xs text-left cursor-pointer transition-colors block truncate font-bold ${
                          selectedTagId === 'all'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-750 hover:bg-slate-50'
                        }`}
                      >
                        All Tags
                      </button>

                      {/* Displayed tags (shows 4 by default, reveals all on search) */}
                      {(tagSearchText.trim() === '' ? tags.slice(0, 4) : tags).map((t) => (
                        <button
                          key={t._id}
                          type="button"
                          onClick={() => {
                            setSelectedTagId(t._id)
                            setTagDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-xs text-left cursor-pointer transition-colors block truncate font-semibold ${
                            selectedTagId === t._id
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {formatTagDisplayName(t)} ({t.deviceName})
                        </button>
                      ))}

                      {(tagSearchText.trim() === '' ? tags.slice(0, 5) : tags).length === 0 && (
                        <div className="px-3 py-3 text-xs text-slate-400 text-center font-medium italic select-none">
                          No matching tags found
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Start Date</label>
              {startDate && (
                <button
                  type="button"
                  onClick={() => setStartDate('')}
                  className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type="date"
                className="w-full border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white h-[38px] text-slate-700 font-semibold cursor-pointer rounded-none"
                value={startDate}
                max={endDate || new Date().toISOString().split('T')[0]}
                onClick={(e) => {
                  try { e.target.showPicker?.() } catch {}
                }}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">End Date</label>
              {endDate && (
                <button
                  type="button"
                  onClick={() => setEndDate('')}
                  className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type="date"
                className="w-full border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white h-[38px] text-slate-700 font-semibold cursor-pointer rounded-none"
                value={endDate}
                min={startDate || undefined}
                max={new Date().toISOString().split('T')[0]}
                onClick={(e) => {
                  try { e.target.showPicker?.() } catch {}
                }}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={searching}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 cursor-pointer transition-all shadow-none h-[38px] flex items-center justify-center gap-1.5"
          >
            {searching && <i className="pi pi-spin pi-spinner text-[10px]" />}
            {searching ? 'Querying...' : 'Generate Report'}
          </button>
        </form>
      </div>

      {/* Results Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i className="pi pi-file text-blue-500" />
            Report Data Readings ({totalRecords})
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => exportData('csv')}
              disabled={readings.length === 0 || exportingFormat !== null}
              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-none"
            >
              {exportingFormat === 'csv' ? (
                <i className="pi pi-spin pi-spinner text-emerald-600 text-sm" />
              ) : (
                <i className="pi pi-file-excel text-emerald-600 text-sm" />
              )}
              {exportingFormat === 'csv' ? 'Downloading...' : 'Export CSV'}
            </button>
            <button
              onClick={() => exportData('json')}
              disabled={readings.length === 0 || exportingFormat !== null}
              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-none"
            >
              {exportingFormat === 'json' ? (
                <i className="pi pi-spin pi-spinner text-blue-600 text-sm" />
              ) : (
                <i className="pi pi-file text-blue-600 text-sm" />
              )}
              {exportingFormat === 'json' ? 'Downloading...' : 'Export JSON'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 overflow-x-auto shadow-none relative min-h-[200px]">
          {searching && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center transition-all duration-300">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-none shadow-lg border border-slate-800">
                <i className="pi pi-spin pi-spinner text-xs" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Generating Report...</span>
              </div>
            </div>
          )}
          <DataTable
            value={readings}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center select-none bg-slate-50/20">
                <div className="w-12 h-12 bg-slate-100 border border-slate-200/50 rounded-full flex items-center justify-center mb-3">
                  <i className="pi pi-inbox text-slate-400 text-lg" />
                </div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {emptyReason === 'no_tags'
                    ? 'No Tags Assigned'
                    : (startDate || endDate)
                    ? 'No Readings in this Date Range'
                    : 'No Records Retrieved'}
                </h4>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed font-medium">
                  {emptyReason === 'no_tags'
                    ? 'There are no active telemetry tags assigned under this company or user scope.'
                    : (startDate || endDate)
                    ? 'No telemetry readings match the selected date window and parameter filters.'
                    : 'Adjust your parameter filters above and click "Generate Report" to view reading trends.'}
                </p>
              </div>
            }
            rowClassName={() => 'border-b border-slate-100 hover:bg-slate-50/20 transition-colors'}
            className="border-none text-xs"
            scrollable
          >
            <Column
              header="Timestamp"
              body={(r) => <span className="font-mono text-slate-500 text-[11px]">{new Date(r.timestamp).toLocaleString()}</span>}
              field="timestamp"
              style={{ minWidth: '160px' }}
            />
            <Column field="deviceName" header="Device Name" style={{ minWidth: '120px' }} className="text-slate-700 font-semibold" />
            <Column
              header="Parameter Label"
              style={{ minWidth: '160px' }}
              className="text-slate-750 font-bold"
              body={(r) => formatTagDisplayName(r)}
            />
            <Column
              header="Value"
              body={(r) => (
                <span className="font-mono font-extrabold text-slate-800 bg-slate-50 border border-slate-200/80 px-2 py-0.5 text-xs">
                  {r.value !== null && r.value !== undefined ? String(r.value) : 'N/A'} <span className="text-[9px] text-slate-450 font-normal ml-0.5">{r.unit}</span>
                </span>
              )}
              field="value"
              style={{ minWidth: '90px' }}
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
