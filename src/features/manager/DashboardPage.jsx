import { useState, useEffect, useMemo, useCallback } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { getSession } from '../../services/auth'
import api from '../../services/axios'
import { getSocket } from '../../services/socketClient'
import StatCard from '../../components/shared/StatCard'
import GreetingBanner from '../../components/shared/GreetingBanner'
import EChart from '../../components/shared/EChart'
import ReactPaginator from '../../components/shared/ReactPaginator'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../../components/shared/Skeleton'

const timeAgo = (tag) => {
  const ts = tag.lastReceivedAt || tag.arrivedAt || tag.latestArrivedAt || tag.updatedAt
  if (!ts) return 'Never'
  const timeMs = new Date(ts).getTime()
  if (isNaN(timeMs)) return 'Never'
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

export default function ManagerDashboard() {
  const session = getSession()

  const [selectedEmpId, setSelectedEmpId] = useState(() => localStorage.getItem('manager_selected_employee') || 'all')
  const [summary, setSummary] = useState(null)
  const [allTelemetryTags, setAllTelemetryTags] = useState([])
  const [allEmployees, setAllEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [switchingScope, setSwitchingScope] = useState(false)
  const [error, setError] = useState('')

  // Pagination states for employees table
  const [employees, setEmployees] = useState([])
  const [employeesTotal, setEmployeesTotal] = useState(0)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [empFirst, setEmpFirst] = useState(0)

  // Pagination states for telemetry tags table
  const [telemetryTags, setTelemetryTags] = useState([])
  const [tagsTotal, setTagsTotal] = useState(0)
  const [tagsLoading, setTagsLoading] = useState(false)
  const [tagFirst, setTagFirst] = useState(0)

  const rows = 10
  const tagRows = 5

  const loadEmployeesTable = useCallback(async (pageNum) => {
    try {
      setEmployeesLoading(true)
      const res = await api.get('/manager/users', {
        params: { page: pageNum, limit: rows }
      })
      setEmployees(res.data.users || [])
      setEmployeesTotal(res.data.total || 0)
    } catch (err) {
      if (err.response?.status === 403) {
        setEmployees([])
        setEmployeesTotal(0)
      } else {
        console.error('Failed to load paginated employees:', err)
      }
    } finally {
      setEmployeesLoading(false)
    }
  }, [])

  const loadTelemetryTable = useCallback(async (pageNum, empId) => {
    try {
      setTagsLoading(true)
      const res = await api.get('/manager/telemetry', {
        params: {
          page: pageNum,
          limit: tagRows,
          employeeId: empId === 'all' ? '' : empId
        }
      })
      setTelemetryTags(res.data.tags || [])
      setTagsTotal(res.data.total || 0)
    } catch (err) {
      console.error('Failed to load paginated telemetry tags:', err)
    } finally {
      setTagsLoading(false)
    }
  }, [])

  const loadData = useCallback(async (empId, { retrying = false } = {}) => {
    try {
      setError('')
      setEmpFirst(0)
      setTagFirst(0)

      // Fetch all employees for charts/distribution
      const empRes = await api.get('/manager/employees').catch(() => ({ data: { employees: [] } }))
      const emps = empRes.data?.employees || []
      setAllEmployees(emps)

      let scopeId = empId
      if (scopeId && scopeId !== 'all' && !emps.some(e => e._id?.toString() === scopeId?.toString())) {
        scopeId = 'all'
        localStorage.setItem('manager_selected_employee', 'all')
        setSelectedEmpId('all')
      }

      const query = scopeId && scopeId !== 'all' ? `?employeeId=${scopeId}` : ''
      const [sumRes, telemetryRes] = await Promise.all([
        api.get(`/manager/dashboard-summary${query}`),
        api.get(`/manager/dashboard${query}`)
      ])

      setSummary(sumRes.data.summary)
      setAllTelemetryTags(telemetryRes.data.tags || [])

      // Trigger paginated requests safely
      await Promise.allSettled([
        loadEmployeesTable(1),
        loadTelemetryTable(1, scopeId)
      ])
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load dashboard data'
      const isMissingEmployee = err.response?.status === 404 && /employee not found/i.test(msg)

      if (isMissingEmployee && !retrying) {
        localStorage.setItem('manager_selected_employee', 'all')
        setSelectedEmpId('all')
        return loadData('all', { retrying: true })
      }

      if (isMissingEmployee) {
        setSummary({ totalEmployees: 0, totalGateways: 0, onlineGateways: 0, activeTags: 0 })
        setAllTelemetryTags([])
        setAllEmployees([])
        setError('')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
      setSwitchingScope(false)
    }
  }, [loadEmployeesTable, loadTelemetryTable])

  useEffect(() => {
    loadData(selectedEmpId)

    const handleScopeChange = () => {
      const nextEmpId = localStorage.getItem('manager_selected_employee') || 'all'
      setSelectedEmpId(nextEmpId)
      setSwitchingScope(true)
      loadData(nextEmpId)
    }

    window.addEventListener('manager_employee_changed', handleScopeChange)
    return () => {
      window.removeEventListener('manager_employee_changed', handleScopeChange)
    }
  }, [selectedEmpId, loadData])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleTelemetryReading = (reading) => {
      const now = Date.now()
      const updateTag = (tag) => {
        const idMatches = (tag.tagId && tag.tagId === reading.tagId) || (tag._id && tag._id.toString() === reading.tagId) || (tag.id && tag.id === reading.tagId)
        if (idMatches) {
          const dec = reading.decimal !== undefined ? reading.decimal : tag.decimal
          const isNone = dec === null || dec === undefined || String(dec).toLowerCase() === 'none' || Number(dec) === 0
          const rawVal = reading.valueStr ?? reading.valStr ?? reading.value
          const val = isNone
            ? (!isNaN(Number(rawVal)) ? String(Math.trunc(Number(rawVal))) : String(rawVal).replace(/\.\d+$/, ''))
            : rawVal
          return {
            ...tag,
            decimal: dec,
            liveValue: val,
            arrivedAt: reading.arrivedAt,
            lastReceivedAt: now
          }
        }
        return tag
      }
      setTelemetryTags((prev) => prev.map(updateTag))
      setAllTelemetryTags((prev) => prev.map(updateTag))
    }

    socket.on('telemetry:reading', handleTelemetryReading)
    return () => {
      socket.off('telemetry:reading', handleTelemetryReading)
    }
  }, [])

  const selectedEmployee = selectedEmpId !== 'all' ? allEmployees.find(e => e._id === selectedEmpId) : null
  const activeStreamsCount = allTelemetryTags.filter(t => t.liveValue !== null).length

  const barChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      textStyle: { color: '#334155', fontSize: 11 }
    },
    grid: { top: 15, bottom: 25, left: 35, right: 15 },
    xAxis: {
      type: 'category',
      data: allEmployees.map(e => e.name),
      axisLabel: { color: '#94a3b8', fontSize: 9 },
      axisLine: { lineStyle: { color: '#e2e8f0' } }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#94a3b8', fontSize: 9 },
      splitLine: { lineStyle: { color: '#f8fafc' } }
    },
    series: [{
      name: 'Assigned Params',
      type: 'bar',
      data: allEmployees.map(e => e.assignedTagIds?.length || 0),
      itemStyle: { color: '#3b82f6', borderRadius: [2, 2, 0, 0] },
      barMaxWidth: 28
    }]
  }), [allEmployees])

  const totalGW = summary?.totalGateways || 0
  const onlineGW = summary?.onlineGateways || 0
  const offlineGW = Math.max(0, totalGW - onlineGW)

  const doughnutChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      textStyle: { color: '#334155', fontSize: 11 }
    },
    series: [{
      name: 'Status',
      type: 'pie',
      radius: ['65%', '85%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: false } },
      labelLine: { show: false },
      data: [
        { value: onlineGW, name: 'Online', itemStyle: { color: '#10b981' } },
        { value: offlineGW, name: 'Offline', itemStyle: { color: '#ef4444' } }
      ]
    }]
  }), [onlineGW, offlineGW])

  const gwCountMap = useMemo(() => {
    const m = {}
    allTelemetryTags.forEach(t => {
      const gwName = t.gateway?.name || 'Unassigned'
      m[gwName] = (m[gwName] || 0) + 1
    })
    return m
  }, [allTelemetryTags])

  const gwLabels = Object.keys(gwCountMap)
  const gwDataValues = Object.values(gwCountMap)

  const gwBarChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      textStyle: { color: '#334155', fontSize: 11 }
    },
    grid: { top: 15, bottom: 25, left: 35, right: 15 },
    xAxis: {
      type: 'category',
      data: gwLabels,
      axisLabel: { color: '#94a3b8', fontSize: 9 },
      axisLine: { lineStyle: { color: '#e2e8f0' } }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#94a3b8', fontSize: 9 },
      splitLine: { lineStyle: { color: '#f8fafc' } }
    },
    series: [{
      name: 'Parameters',
      type: 'bar',
      data: gwDataValues,
      itemStyle: { color: '#6366f1', borderRadius: [2, 2, 0, 0] },
      barMaxWidth: 28
    }]
  }), [gwLabels, gwDataValues])

  if (error && !summary) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
          <i className="pi pi-exclamation-circle text-rose-500 text-3xl" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Unable to load dashboard</h3>
        <p className="text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            loadData(selectedEmpId)
          }}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg cursor-pointer transition-all"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      {switchingScope && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg transition-all duration-300">
          <div className="flex flex-col items-center gap-3 bg-white/70 backdrop-blur-md px-8 py-6 rounded-xl shadow-lg border border-white/40">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-700 animate-spin" />
              <div className="absolute inset-[3px] rounded-full bg-blue-50 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-700">Refreshing Scope</p>
              <p className="text-[10px] text-slate-400 font-light mt-0.5">Updating dashboard for selected employee</p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : summary ? (
          <>
            <StatCard
              label={selectedEmployee ? 'Active Scope' : 'Team Scope'}
              value={selectedEmployee ? selectedEmployee.name : `All Users (${summary.totalEmployees || 0})`}
              icon="pi pi-user"
              color="blue"
              trend={selectedEmployee ? 'Filtered single-user view' : 'All reporting users under management'}
            />
            <StatCard
              label="Monitored Params"
              value={summary.activeTags}
              icon="pi pi-chart-line"
              color="indigo"
              trend={`${activeStreamsCount} streaming live`}
            />
            <StatCard
              label="Gateway Nodes"
              value={`${summary.onlineGateways}/${summary.totalGateways}`}
              icon="pi pi-sitemap"
              color="amber"
              trend={`${summary.onlineGateways} nodes active`}
            />
            <StatCard
              label="Stream Efficiency"
              value={summary.activeTags ? `${Math.round((activeStreamsCount / summary.activeTags) * 100)}%` : '0%'}
              icon="pi pi-percentage"
              color={activeStreamsCount === summary.activeTags ? 'green' : 'teal'}
              trend="Active parameter ratio"
            />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            <SkeletonChart className="h-72" />
            <SkeletonChart className="h-72" />
            <SkeletonChart className="h-72" />
          </>
        ) : (
          <>
            <div className="bg-white border border-slate-200/80 p-5 flex flex-col h-72">
              <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-50 pb-2">
                <i className="pi pi-chart-bar text-blue-500 text-sm" />
                Parameters by User
              </h3>
              <div className="flex-1 min-h-0">
                {employees.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-light">No user distributions</div>
                ) : (
                  <EChart option={barChartOption} className="w-full h-full" />
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-5 flex flex-col h-72">
              <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-50 pb-2">
                <i className="pi pi-sitemap text-emerald-500 text-sm" />
                Gateway Nodes Status
              </h3>
              <div className="flex-1 min-h-0 flex items-center justify-center relative">
                {totalGW === 0 ? (
                  <div className="text-xs text-slate-400 font-light">No gateways in scope</div>
                ) : (
                  <>
                    <EChart option={doughnutChartOption} className="w-full h-full" />
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none mt-[-10px]">
                      <span className="text-xl font-extrabold text-slate-800">
                        {totalGW ? Math.round((onlineGW / totalGW) * 100) : 0}%
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Online</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-5 flex flex-col h-72">
              <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-50 pb-2">
                <i className="pi pi-sitemap text-indigo-500 text-sm" />
                Parameters by Gateway
              </h3>
              <div className="flex-1 min-h-0">
                {gwLabels.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-light">No gateways mapped</div>
                ) : (
                  <EChart option={gwBarChartOption} className="w-full h-full" />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {loading ? (
          <>
            <div className="lg:col-span-3">
              <SkeletonTable rows={5} />
            </div>
            <div className="lg:col-span-2">
              <SkeletonTable rows={5} />
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-3 bg-white border border-slate-200/80 flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-800">Operations Directory</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Reporting users and assigned resource metrics</p>
                </div>
                <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 font-mono px-2 py-0.5">
                  {employeesTotal} Users
                </span>
              </div>

              <div className="p-0 flex-1 overflow-x-auto relative min-h-[220px]">
                {employeesLoading && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <i className="pi pi-spin pi-spinner text-blue-600 text-lg" />
                  </div>
                )}
                {employees.length === 0 ? (
                  <div className="p-8 text-center">
                    <i className="pi pi-users text-slate-350 text-3xl mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No reporting users registered.</p>
                  </div>
                ) : (
                  <>
                    <DataTable
                      value={employees}
                      rowClassName={() => 'border-b border-slate-100 hover:bg-slate-50/50 transition-colors'}
                      className="border-none text-xs"
                      emptyMessage="No users found."
                    >
                    <Column
                      header="User Info"
                      body={(r) => (
                        <div className="py-1">
                          <p className="font-bold text-slate-800 text-xs leading-none">{r.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-1 leading-none">{r.email}</p>
                        </div>
                      )}
                    />
                    <Column
                      header="Gateways"
                      body={(r) => (
                        <span className="inline-flex items-center bg-slate-100 text-slate-660 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-200/60 shadow-none">
                          {r.assignedGatewayIds?.length || 0} GW
                        </span>
                      )}
                    />
                    <Column
                      header="Parameters"
                      body={(r) => (
                        <span className="inline-flex items-center bg-slate-100 text-slate-660 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-200/60 shadow-none">
                          {r.assignedTagCount || 0} Params
                        </span>
                      )}
                    />
                    <Column
                      header="Status"
                      body={(r) => {
                        const isActive = (r.assignedTagCount || 0) > 0
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isActive ? 'Live' : 'Idle'}
                            </span>
                          </div>
                        )
                      }}
                    />
                  </DataTable>
                  <ReactPaginator
                    totalRecords={employeesTotal}
                    rows={rows}
                    first={empFirst}
                    onPageChange={(e) => {
                      setEmpFirst(e.first)
                      const pageNum = (e.first / rows) + 1
                      loadEmployeesTable(pageNum)
                    }}
                  />
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200/80 flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-800">Live Parameter Monitor</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Real-time modbus register telemetry feed</p>
                </div>
                {telemetryTags.length > 0 && (
                  <span className="flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold uppercase px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Live
                  </span>
                )}
              </div>

              <div className="p-0 flex-1 overflow-x-auto relative min-h-[220px]">
                {tagsLoading && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <i className="pi pi-spin pi-spinner text-blue-600 text-lg" />
                  </div>
                )}
                {telemetryTags.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/10">
                    <i className="pi pi-chart-line text-slate-350 text-3xl mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No active telemetry tags assigned to this scope.</p>
                  </div>
                ) : (
                  <>
                    <DataTable
                      value={telemetryTags}
                      showHeader={false}
                      rowClassName={() => 'border-b border-slate-100 hover:bg-slate-50/50 transition-colors'}
                      className="border-none text-xs"
                      emptyMessage="No active telemetry tags assigned to this scope."
                    >
                    <Column
                      body={(tag) => (
                        <div className="py-1 min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 truncate" title={tag.displayName || tag.parameterName || (tag.topicName ? tag.topicName.replace(/^p(\d+)/i, 'P$1') : '')}>
                            {tag.displayName || tag.parameterName || (tag.topicName ? tag.topicName.replace(/^p(\d+)/i, 'P$1') : '')}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-slate-400 font-semibold truncate">
                              {tag.deviceName}
                            </span>
                            {tag.assignedEmployees && tag.assignedEmployees.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded-full border border-blue-100/80" title={tag.assignedEmployees.map(e => e.name || e.email).join(', ')}>
                                <i className="pi pi-user text-[8px] text-blue-600" />
                                <span>{tag.assignedEmployees.length === 1 ? tag.assignedEmployees[0].name : `${tag.assignedEmployees.length} Users`}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 text-slate-400 text-[8px] font-medium rounded-full">
                                Unassigned
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    />
                    <Column
                      align="right"
                      body={(tag) => (
                        <div className="text-right shrink-0 py-1">
                          <p className="inline-flex items-center bg-blue-50/50 text-blue-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-blue-100/50 font-mono shadow-none">
                            {tag.liveValue !== null && tag.liveValue !== undefined ? String(tag.liveValue) : 'N/A'}{' '}
                            {tag.liveValue !== null && tag.liveValue !== undefined && tag.unit && (
                              <span className="text-[9px] text-blue-500 font-normal ml-0.5">{tag.unit}</span>
                            )}
                          </p>
                          <p className="text-[9px] text-slate-400 font-light mt-0.5">
                            {timeAgo(tag)}
                          </p>
                        </div>
                      )}
                    />
                  </DataTable>
                  <ReactPaginator
                    totalRecords={tagsTotal}
                    rows={tagRows}
                    first={tagFirst}
                    onPageChange={(e) => {
                      setTagFirst(e.first)
                      const pageNum = (e.first / tagRows) + 1
                      loadTelemetryTable(pageNum, selectedEmpId)
                    }}
                  />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
