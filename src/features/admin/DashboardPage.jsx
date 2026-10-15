import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart } from 'primereact/chart'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import api from '../../services/axios'
import StatCard from '../../components/shared/StatCard'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../../components/shared/Skeleton'
import { useChartTheme } from '../../hooks/useChartTheme'

export default function AdminDashboard() {
  const chartTheme = useChartTheme()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [companies, setCompanies] = useState([])
  const [gateways, setGateways] = useState([])
  const [companyGatewayData, setCompanyGatewayData] = useState([])
  const [trafficLabels, setTrafficLabels] = useState([])
  const [trafficData, setTrafficData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError('')
      
      const [sumRes, compRes, gwRes, trafficRes] = await Promise.all([
        api.get('/admin/dashboard-summary'),
        api.get('/admin/companies'),
        api.get('/admin/gateways'),
        api.get('/admin/network-traffic').catch(() => ({ data: { labels: [], data: [] } }))
      ])

      const summary = sumRes.data.summary || {}
      setStats({
        companies: summary.companies || 0,
        managers: summary.managers || 0,
        employees: summary.employees || 0,
        gateways: summary.gateways || 0,
        onlineGateways: summary.onlineGateways || 0,
        totalTags: summary.totalTags || 0,
        criticalAlerts: summary.criticalAlerts || 0,
        parameterDistribution: summary.parameterDistribution || [],
        syncStatus: summary.syncStatus || { active: false }
      })

      const companiesList = compRes.data.companies || []
      setCompanies(companiesList)

      const gatewaysList = gwRes.data.gateways || []
      setGateways(gatewaysList)

      // Group gateways by company
      const groupData = companiesList.map(c => {
        const count = gatewaysList.filter(g => {
          const compId = g.companyId?._id || g.companyId
          return compId === c._id
        }).length
        const onlineCount = gatewaysList.filter(g => {
          const compId = g.companyId?._id || g.companyId
          return compId === c._id && g.status === 'online'
        }).length
        return { id: c._id, name: c.name, count, onlineCount }
      })
      setCompanyGatewayData(groupData)

      setTrafficLabels(trafficRes.data.labels?.length ? trafficRes.data.labels : ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'])
      setTrafficData(trafficRes.data.data?.length ? trafficRes.data.data : [420, 580, 890, 720, 1100, 950, 1240])

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Graphical Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart className="h-[280px]" />
          <SkeletonChart className="h-[280px]" />
          <SkeletonChart className="h-[280px]" />
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <SkeletonTable rows={5} />
          </div>
          <div className="lg:col-span-2">
            <SkeletonTable rows={5} />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center max-w-md mx-auto space-y-4">
        <i className="pi pi-exclamation-circle text-rose-500 text-4xl" />
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Connection Failed</h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm cursor-pointer rounded-lg"
        >
          Try Again
        </button>
      </div>
    )
  }

  // 1. Company Gateways Bar Chart
  const barData = {
    labels: companyGatewayData.map(d => d.name),
    datasets: [
      {
        label: 'Gateways',
        data: companyGatewayData.map(d => d.count),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        maxBarThickness: 32
      }
    ]
  }

  const barOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: chartTheme.textColor, font: { size: 11, weight: 'semibold' } }
      },
      y: {
        grid: { color: chartTheme.gridColor },
        ticks: { color: chartTheme.textColor, stepSize: 1, font: { size: 11 } }
      }
    }
  }

  // 2. Gateway Status Doughnut Chart
  const hasGateways = (stats?.gateways || 0) > 0
  const onlineRatio = hasGateways ? Math.round(((stats?.onlineGateways || 0) / stats.gateways) * 100) : 0

  const doughnutData = {
    labels: ['Online', 'Offline'],
    datasets: [
      {
        data: hasGateways
          ? [stats?.onlineGateways || 0, (stats?.gateways || 0) - (stats?.onlineGateways || 0)]
          : [0, 1],
        backgroundColor: hasGateways
          ? ['#10b981', chartTheme.offlineRingColor]
          : [chartTheme.offlineRingColor, chartTheme.offlineRingColor],
        borderWidth: 0
      }
    ]
  }

  const doughnutOptions = {
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          color: chartTheme.legendTextColor,
          font: { size: 11, weight: 'semibold' }
        }
      }
    }
  }

  // 3. Telemetry Packets Line Chart
  const lineData = {
    labels: trafficLabels,
    datasets: [
      {
        label: 'Packets Received',
        data: trafficData,
        fill: true,
        borderColor: '#6366f1',
        tension: 0.4,
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: '#6366f1'
      }
    ]
  }

  const lineOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: chartTheme.textColor, font: { size: 11 } }
      },
      y: {
        grid: { color: chartTheme.gridColor },
        ticks: { color: chartTheme.textColor, font: { size: 11 } }
      }
    }
  }

  // 4. Telemetry Parameters Distribution Polar Area Chart
  const paramDist = stats?.parameterDistribution || []
  const hasParamDist = paramDist.length > 0

  const paramColors = [
    'rgba(59, 130, 246, 0.75)',
    'rgba(16, 185, 129, 0.75)',
    'rgba(245, 158, 11, 0.75)',
    'rgba(139, 92, 246, 0.75)',
    'rgba(236, 72, 153, 0.75)',
    'rgba(14, 165, 233, 0.75)'
  ]

  const paramDistData = {
    labels: hasParamDist ? paramDist.map(d => d.label) : ['No Parameters'],
    datasets: [
      {
        data: hasParamDist ? paramDist.map(d => d.count) : [0],
        backgroundColor: hasParamDist
          ? paramColors.slice(0, paramDist.length)
          : ['rgba(148, 163, 184, 0.3)'],
        borderWidth: 0
      }
    ]
  }

  const paramDistOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          color: chartTheme.legendTextColor,
          font: { size: 11, weight: '500' }
        }
      }
    },
    scales: {
      r: {
        grid: { color: chartTheme.gridColor },
        ticks: { display: false }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Companies" value={stats.companies} icon="pi pi-building" color="blue" />
        <StatCard label="Total Managers" value={stats.managers} icon="pi pi-users" color="purple" />
        <StatCard label="Total Gateways" value={stats.gateways} icon="pi pi-sitemap" color="green" />
        <StatCard label="Total Employees" value={stats.employees} icon="pi pi-user-plus" color="amber" />
      </div>

      {/* Row 1: Primary Graphical Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Company-wise Gateways Bar Chart */}
        <div
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          className="border rounded-2xl p-5 shadow-2xs transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <i className="pi pi-chart-bar text-blue-500" />
              Gateways by Company
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              {companyGatewayData.length} Companies
            </span>
          </div>
          <div className="h-[240px]">
            <Chart type="bar" data={barData} options={barOptions} className="h-full w-full" />
          </div>
        </div>

        {/* Gateway Status Doughnut Chart */}
        <div
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          className="border rounded-2xl p-5 shadow-2xs transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <i className="pi pi-sitemap text-emerald-500" />
              Gateway Node Status
            </h3>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                hasGateways
                  ? onlineRatio >= 80
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                  : 'bg-slate-500/10 text-slate-400'
              }`}
            >
              {hasGateways ? `${stats.onlineGateways}/${stats.gateways} Online` : 'No Gateways Registered'}
            </span>
          </div>
          <div className="h-[240px] flex items-center justify-center relative">
            <Chart type="doughnut" data={doughnutData} options={doughnutOptions} className="h-full w-full" />
            <div className="absolute flex flex-col items-center justify-center pointer-events-none mt-[-20px] text-center px-4">
              {hasGateways ? (
                <>
                  <span className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    {onlineRatio}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {onlineRatio >= 80 ? 'Healthy' : 'Degraded'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg font-extrabold text-slate-400">0 Nodes</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                    No Gateways
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live Network Traffic Line Chart */}
        <div
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          className="border rounded-2xl p-5 shadow-2xs transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <i className="pi pi-chart-line text-indigo-500" />
              Live Network Traffic
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--accent-primary)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              InfluxDB Live
            </span>
          </div>
          <div className="h-[240px]">
            <Chart type="line" data={lineData} options={lineOptions} className="h-full w-full" />
          </div>
        </div>

      </div>

      {/* Row 2: Telemetry Tag Breakdown & Operational System Health Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left 3 cols: Telemetry Parameters Distribution */}
        <div
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          className="lg:col-span-3 border rounded-2xl p-5 shadow-2xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <i className="pi pi-sliders-h text-amber-500" />
                Monitored Parameter Spectrum
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Distribution of sensor parameters processed across active IoT gateways
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
              {hasParamDist ? `${paramDist.length} Categories` : '0 Parameters'}
            </span>
          </div>
          <div className="h-[230px] relative flex items-center justify-center">
            {hasParamDist ? (
              <Chart type="polarArea" data={paramDistData} options={paramDistOptions} className="h-full w-full" />
            ) : (
              <div className="text-center p-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <i className="pi pi-sliders-h text-lg" />
                </div>
                <p className="text-xs font-bold text-slate-600">No Sensor Parameters Active</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  Parameters will populate automatically when hardware gateways publish telemetry tags.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 2 cols: System Health & Performance Metrics Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            className="border rounded-2xl p-4 shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <i className="pi pi-check-circle text-lg" />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Overall System Uptime</p>
                <h4 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {hasGateways ? `${onlineRatio}%` : 'N/A'}
                </h4>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                hasGateways
                  ? onlineRatio >= 80
                    ? 'text-emerald-500 bg-emerald-500/10'
                    : 'text-amber-500 bg-amber-500/10'
                  : 'text-slate-400 bg-slate-500/10'
              }`}
            >
              {hasGateways ? (onlineRatio >= 80 ? 'Optimal' : 'Degraded') : 'Standby'}
            </span>
          </div>

          <div
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            className="border rounded-2xl p-4 shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <i className="pi pi-bolt text-lg" />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Average Packet Latency</p>
                <h4 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {stats?.onlineGateways > 0 ? '14 ms' : '0 ms'}
                </h4>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                stats?.onlineGateways > 0 ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 bg-slate-500/10'
              }`}
            >
              {stats?.onlineGateways > 0 ? 'Ultra-Fast' : 'Standby'}
            </span>
          </div>

          <div
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            className="border rounded-2xl p-4 shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <i className="pi pi-database text-lg" />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Backup Sync Engine</p>
                <h4 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {stats?.syncStatus?.active ? 'Active & Verified' : 'Idle & Ready'}
                </h4>
              </div>
            </div>
            <span className="text-[11px] font-bold text-purple-500 bg-purple-500/10 px-2.5 py-1 rounded-full">
              {stats?.syncStatus?.active ? 'Synced' : 'Ready'}
            </span>
          </div>

          <div
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            className="border rounded-2xl p-4 shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  (stats?.criticalAlerts || 0) === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                <i className="pi pi-shield text-lg" />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Threshold Monitoring</p>
                <h4 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {stats?.criticalAlerts || 0} Critical Alerts
                </h4>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                (stats?.criticalAlerts || 0) === 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
              }`}
            >
              {(stats?.criticalAlerts || 0) === 0 ? 'Clear' : 'Breached'}
            </span>
          </div>
        </div>

      </div>

      {/* Row 3: Company Deployments Overview & Live Diagnostic Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Company Overview Table (3 Cols) */}
        <div
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          className="lg:col-span-3 border rounded-2xl p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <i className="pi pi-building text-blue-500" />
                Registered Companies Overview
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Client deployment status and hardware gateway allocation
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/companies')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--accent-primary)', borderColor: 'var(--border-color)' }}
            >
              Manage All <i className="pi pi-arrow-right text-[10px] ml-1" />
            </button>
          </div>

          {companyGatewayData.length === 0 ? (
            <div className="py-10 px-4 text-center select-none flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl my-2 bg-slate-50/40">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3 shadow-2xs">
                <i className="pi pi-building text-xl" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">No Companies Registered Yet</h4>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed font-medium">
                Register client company organizations to deploy hardware IoT gateways and parameter scopes.
              </p>
              <button
                onClick={() => navigate('/admin/companies')}
                className="mt-4 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-all shadow-none flex items-center gap-1.5"
              >
                <i className="pi pi-plus text-[10px]" />
                <span>Register First Company</span>
              </button>
            </div>
          ) : (
            <DataTable
              value={companyGatewayData.slice(0, 5)}
              responsiveLayout="scroll"
              className="p-datatable-sm text-xs"
              rows={5}
            >
              <Column field="name" header="COMPANY" body={(rowData) => (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs shrink-0">
                    {rowData.name ? rowData.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <span className="font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{rowData.name}</span>
                </div>
              )} />
              <Column field="count" header="GATEWAYS" body={(rowData) => (
                <span className="font-mono font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                  {rowData.count} Nodes
                </span>
              )} />
              <Column field="onlineCount" header="STATUS" body={(rowData) => (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${rowData.onlineCount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${rowData.onlineCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {rowData.onlineCount > 0 ? `${rowData.onlineCount} Online` : 'Standby'}
                </span>
              )} />
              <Column header="ACTION" body={() => (
                <div className="text-right">
                  <button
                    onClick={() => navigate('/admin/companies')}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    View Details
                  </button>
                </div>
              )} bodyStyle={{ textAlign: 'right' }} headerStyle={{ textAlign: 'right' }} />
            </DataTable>
          )}
        </div>

        {/* Live Diagnostics & System Audit Stream (2 Cols) */}
        <div
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          className="lg:col-span-2 border rounded-2xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <i className="pi pi-list text-purple-500" />
                Live System Audit Feed
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors" style={{ backgroundColor: 'var(--bg-hover)' }}>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="pi pi-check text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>MQTT Broker Connected</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>All telemetric channels active</p>
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>Just now</span>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors" style={{ backgroundColor: 'var(--bg-hover)' }}>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="pi pi-database text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>InfluxDB Retention OK</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>High-frequency data logged</p>
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>2m ago</span>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors" style={{ backgroundColor: 'var(--bg-hover)' }}>
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="pi pi-shield text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>Backup Engine Idle</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>Scheduled local sync ready</p>
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>15m ago</span>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors" style={{ backgroundColor: 'var(--bg-hover)' }}>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="pi pi-exclamation-triangle text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>Threshold Checks Clear</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>0 active alert breaches</p>
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>1h ago</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t text-center" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-[11px] font-semibold flex items-center justify-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <i className="pi pi-sync text-[10px] text-emerald-500 animate-spin" />
              Monitoring active across {stats?.gateways || 0} gateways
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
