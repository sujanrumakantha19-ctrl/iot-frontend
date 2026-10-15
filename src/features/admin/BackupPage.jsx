import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../../services/axios'
import { showToast } from '../../utils/toast'
import { Chart } from 'primereact/chart'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { companiesApi } from '../../services/companiesApi'
import { backupApi } from '../../services/backupApi'
import { downloadManager } from '../../services/downloadManager'
import { getSession } from '../../services/auth'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useChartTheme } from '../../hooks/useChartTheme'
import { initSocket } from '../../services/socketClient'
import CompanySearchCombobox from '../../components/shared/CompanySearchCombobox'

// Palette of distinct chart colors
const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#6366f1',
]

function downloadAsJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadAsCsv(data, filename) {
  const flatten = (obj, prefix = '') =>
    Object.keys(obj).reduce((acc, k) => {
      const pre = prefix.length ? prefix + '.' : ''
      if (typeof obj[k] === 'object' && !Array.isArray(obj[k]) && obj[k] !== null)
        Object.assign(acc, flatten(obj[k], pre + k))
      else acc[pre + k] = obj[k]
      return acc
    }, {})

  const rows = Array.isArray(data) ? data : [data]
  if (!rows.length) return
  const headers = Object.keys(flatten(rows[0]))
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => {
    const val = h.split('.').reduce((o, k) => o?.[k], r)
    return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? ''
  }).join(','))].join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BackupPage() {
  const chartTheme = useChartTheme()
  const [storageStats, setStorageStats] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [globalFormat, setGlobalFormat] = useState('json')
  const [companyFormat, setCompanyFormat] = useState('json')
  const [downloadState, setDownloadState] = useState(downloadManager.getState())
  const [localMongoUri, setLocalMongoUri] = useState('')
  const [savingUri, setSavingUri] = useState(false)
  const [syncState, setSyncState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('unknown') // 'unknown' | 'reachable' | 'unreachable'

  useEffect(() => {
    return downloadManager.subscribe(setDownloadState)
  }, [])
  
  useEffect(() => {
    const cachedUri = localStorage.getItem('admin_local_mongo_uri')
    if (cachedUri) {
      setLocalMongoUri(cachedUri)
    }

    // Load initial storage stats, local connection string, and sync state
    Promise.all([
      backupApi.getStorageStats().then(stats => setStorageStats(stats || [])).catch(() => setStorageStats([])),
      backupApi.getLocalMongoUri().then(uri => {
        if (!cachedUri && uri) {
          setLocalMongoUri(uri)
          localStorage.setItem('admin_local_mongo_uri', uri)
        }
      }),
      backupApi.getSyncStatus().then(status => status && setSyncState(status))
    ])
      .catch(err => console.error('Failed to load backup details:', err))
      .finally(() => setLoading(false))

    // Set up WebSocket listener
    const socket = initSocket()
    if (socket) {
      const handleSyncProgress = (data) => {
        setSyncState(data)
      }
      socket.on('backup:sync-progress', handleSyncProgress)

      // Listen to changes triggered from TopBar or other sessions
      const handleLocalTrigger = () => {
        backupApi.getSyncStatus().then(status => status && setSyncState(status))
      }
      window.addEventListener('backup:local-trigger', handleLocalTrigger)

      return () => {
        socket.off('backup:sync-progress', handleSyncProgress)
        window.removeEventListener('backup:local-trigger', handleLocalTrigger)
      }
    }
  }, [])

  const doExport = (scope, e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    if (scope === 'company' && !selectedCompany) {
      showToast({ severity: 'warn', summary: 'Select Company', detail: 'Please select a company before exporting.' })
      return
    }
    if (scope === 'full') {
      downloadManager.startDownload('full', null, globalFormat)
    } else {
      downloadManager.startDownload('company', selectedCompany._id, companyFormat, selectedCompany.name)
    }
  }

  const handleSaveUri = async () => {
    if (!localMongoUri.trim() || !localMongoUri.startsWith('mongodb')) {
      showToast({ severity: 'error', summary: 'Invalid Connection URI', detail: 'Must be a valid mongodb connection string.' })
      return
    }
    try {
      setSavingUri(true)
      const saved = await backupApi.saveLocalMongoUri(localMongoUri.trim())
      setLocalMongoUri(saved)
      localStorage.setItem('admin_local_mongo_uri', saved)
      showToast({ severity: 'success', summary: 'Settings Saved', detail: 'Local target MongoDB URI configured successfully.' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save Failed', detail: err.message })
    } finally {
      setSavingUri(false)
    }
  }

  const handleTestConnection = async () => {
    if (!localMongoUri.trim() || !localMongoUri.startsWith('mongodb')) {
      showToast({ severity: 'error', summary: 'Invalid Connection URI', detail: 'Must be a valid mongodb connection string.' })
      return
    }
    try {
      setTestingConnection(true)
      setConnectionStatus('unknown')
      const res = await backupApi.testConnection(localMongoUri.trim())
      if (res.success) {
        setConnectionStatus('reachable')
        showToast({ severity: 'success', summary: 'Reachable', detail: 'Target MongoDB database is live and reachable!' })
      } else {
        setConnectionStatus('unreachable')
        showToast({ severity: 'error', summary: 'Unreachable', detail: res.message || 'Could not establish connection.' })
      }
    } catch (err) {
      setConnectionStatus('unreachable')
      showToast({ severity: 'error', summary: 'Connection Failed', detail: err.message })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleStartSync = async () => {
    if (!localMongoUri.trim()) {
      showToast({ severity: 'warn', summary: 'Target Required', detail: 'Please configure a target connection string first.' })
      return
    }
    try {
      const state = await backupApi.startSync(localMongoUri.trim())
      if (state) {
        setSyncState(state)
        window.dispatchEvent(new Event('backup:local-trigger'))
      }
      showToast({ severity: 'info', summary: 'Sync Started', detail: 'Local database sync process initialized.' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Sync Init Failed', detail: err.message })
    }
  }

  const handlePauseSync = async () => {
    try {
      const state = await backupApi.pauseSync()
      if (state) {
        setSyncState(state)
        window.dispatchEvent(new Event('backup:local-trigger'))
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Pause Failed', detail: err.message })
    }
  }

  const handleResumeSync = async () => {
    try {
      const state = await backupApi.resumeSync()
      if (state) {
        setSyncState(state)
        window.dispatchEvent(new Event('backup:local-trigger'))
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Resume Failed', detail: err.message })
    }
  }

  const handleStopSync = async () => {
    try {
      const state = await backupApi.stopSync()
      if (state) {
        setSyncState(state)
        window.dispatchEvent(new Event('backup:local-trigger'))
      }
      showToast({ severity: 'warn', summary: 'Sync Canceled', detail: 'Sync process stopped and reset.' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Stop Failed', detail: err.message })
    }
  }

  // ── Chart data (Memoized to prevent unnecessary chart re-renders) ───────
  const doughnutData = useMemo(() => ({
    labels: storageStats.map(s => s.name),
    datasets: [{
      data: storageStats.map(s => s.total),
      backgroundColor: storageStats.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 2,
      borderColor: chartTheme.isDark ? '#1e293b' : '#ffffff',
      hoverOffset: 6,
    }]
  }), [storageStats, chartTheme.isDark])

  const doughnutOptions = useMemo(() => ({
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          color: chartTheme.legendTextColor,
          font: { size: 11, weight: '600' }
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString()} records`
        }
      }
    }
  }), [chartTheme.legendTextColor])

  const barData = useMemo(() => ({
    labels: storageStats.map(s => s.name),
    datasets: [
      {
        label: 'Telemetry Readings',
        data: storageStats.map(s => s.readings),
        backgroundColor: '#3b82f6',
        borderRadius: 3,
        stack: 'stack',
      },
      {
        label: 'Tags',
        data: storageStats.map(s => s.tags),
        backgroundColor: '#8b5cf6',
        borderRadius: 3,
        stack: 'stack',
      },
      {
        label: 'Gateways',
        data: storageStats.map(s => s.gateways),
        backgroundColor: '#10b981',
        borderRadius: 3,
        stack: 'stack',
      },
      {
        label: 'Users',
        data: storageStats.map(s => s.users),
        backgroundColor: '#f59e0b',
        borderRadius: 3,
        stack: 'stack',
      },
    ]
  }), [storageStats])

  const barOptions = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          color: chartTheme.legendTextColor,
          font: { size: 11, weight: '600' }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: chartTheme.textColor, font: { size: 11 } }
      },
      y: {
        stacked: true,
        grid: { color: chartTheme.gridColor },
        ticks: { color: chartTheme.textColor, font: { size: 11 } }
      }
    }
  }), [chartTheme.legendTextColor, chartTheme.textColor, chartTheme.gridColor])

  if (loading) return <LoadingSpinner text="Connecting backup services..." />

  return (
    <div className="space-y-6">

      {/* ── Export Tools (TOP) ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Full Backup */}
        <div className="bg-white border border-slate-200/80 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <i className="pi pi-download text-blue-600 text-xl" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Full System Backup</h3>
                <p className="text-xs text-slate-400 font-light mt-0.5">Export all companies, managers, employees, gateways, and historical sensor readings.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
            <select
              value={globalFormat}
              onChange={(e) => setGlobalFormat(e.target.value)}
              className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-none text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button
              type="button"
              onClick={(e) => doExport('full', e)}
              disabled={downloadState.status === 'downloading'}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-none font-semibold text-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {downloadState.status === 'downloading' && downloadState.filename.includes('full-system') && <i className="pi pi-spin pi-spinner text-xs" />}
              <i className="pi pi-download text-xs" />
              Export Full Dataset
            </button>
          </div>
        </div>

        {/* Company Backup */}
        <div className="bg-white border border-slate-200/80 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                <i className="pi pi-building text-purple-600 text-xl" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Scoped Company Backup</h3>
                <p className="text-xs text-slate-400 font-light mt-0.5">Export user groups, gateways, and company profile data restricted to a single entity.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 mt-4 pt-4 border-t border-slate-100">
            <CompanySearchCombobox
              onSelect={(company) => setSelectedCompany(company)}
              onClear={() => setSelectedCompany(null)}
            />
            <div className="flex items-center gap-3">
              <select
                value={companyFormat}
                onChange={(e) => setCompanyFormat(e.target.value)}
                className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-none text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <button
                type="button"
                onClick={(e) => doExport('company', e)}
                disabled={!selectedCompany || downloadState.status === 'downloading'}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-none font-semibold text-sm cursor-pointer flex items-center justify-center gap-2"
              >
                {downloadState.status === 'downloading' && downloadState.filename.includes('company') && <i className="pi pi-spin pi-spinner text-xs" />}
                <i className="pi pi-download text-xs" />
                Export Company Data
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── Storage Charts (BELOW) ───────────────────────── */}
      {storageStats.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Doughnut — record share */}
            <div className="bg-white border border-slate-200/80 p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="pi pi-chart-pie text-blue-500" />
                  Storage Share by Company
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1">
                  {storageStats.reduce((a, s) => a + s.total, 0).toLocaleString()} total records
                </span>
              </div>
              <div className="h-[240px]">
                <Chart type="doughnut" data={doughnutData} options={doughnutOptions} className="h-full w-full" />
              </div>
            </div>

            {/* Stacked bar — category breakdown */}
            <div className="bg-white border border-slate-200/80 p-5 lg:col-span-3">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="pi pi-chart-bar text-purple-500" />
                  Record Breakdown by Category
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1">
                  stacked
                </span>
              </div>
              <div className="h-[240px]">
                <Chart type="bar" data={barData} options={barOptions} className="h-full w-full" />
              </div>
            </div>

          </div>

          {/* Company Storage Summary — PrimeReact DataTable */}
          <div className="bg-white border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <i className="pi pi-table text-slate-400 text-sm" />
              <h3 className="text-sm font-bold text-slate-800">Company Storage Summary</h3>
            </div>
            <DataTable
              value={storageStats.map((s, i) => ({
                ...s,
                colorIndex: i,
                pct: (s.total / storageStats.reduce((a, x) => a + x.total, 0) * 100).toFixed(1)
              }))}
              size="small"
              stripedRows
              className="text-sm"
            >
              <Column
                header="Company"
                body={(row) => (
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[row.colorIndex % COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-700">{row.name}</span>
                  </div>
                )}
              />
              <Column
                header={<span className="text-blue-500">Readings</span>}
                body={(row) => <span className="font-mono text-slate-600">{row.readings.toLocaleString()}</span>}
                align="right"
              />
              <Column
                header={<span className="text-purple-500">Tags</span>}
                body={(row) => <span className="font-mono text-slate-600">{row.tags.toLocaleString()}</span>}
                align="right"
              />
              <Column
                header={<span className="text-emerald-500">Gateways</span>}
                body={(row) => <span className="font-mono text-slate-600">{row.gateways.toLocaleString()}</span>}
                align="right"
              />
              <Column
                header={<span className="text-amber-500">Users</span>}
                body={(row) => <span className="font-mono text-slate-600">{row.users.toLocaleString()}</span>}
                align="right"
              />
              <Column
                header="Total"
                body={(row) => (
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-bold text-slate-800">{row.total.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 rounded-full px-1.5 py-0.5">{row.pct}%</span>
                  </div>
                )}
                align="right"
              />
            </DataTable>
          </div>
        </>
      )}

      <div className="bg-slate-50 border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
          <i className="pi pi-info-circle text-blue-500" /> Export Summary
        </h3>
        <p className="text-xs text-slate-500 font-light leading-relaxed">
          All exports are compiled and generated securely in-browser. No sensitive data is transferred to outer server endpoints during this process.
          Use <strong>JSON</strong> to retain relational schema links, or <strong>CSV</strong> for flattened spreadsheet analysis.
        </p>
      </div>

    </div>
  )
}

