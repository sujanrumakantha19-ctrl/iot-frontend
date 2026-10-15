import { useState, useEffect, useMemo } from 'react'
import StatCard from '../../components/shared/StatCard'
import GreetingBanner from '../../components/shared/GreetingBanner'
import EChart from '../../components/shared/EChart'
import { SkeletonCard, SkeletonChart } from '../../components/shared/Skeleton'
import { showToast } from '../../utils/toast'
import { getSession } from '../../services/auth'
import { telemetryApi } from '../../services/telemetryApi'
import { getSocket } from '../../services/socketClient'

export default function EmployeeDashboard() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await telemetryApi.getEmployeeDashboard()
      const tagsWithTimestamp = (list || []).map((t) => {
        const tTime = t.arrivedAt || t.latestArrivedAt || t.updatedAt
        return {
          ...t,
          lastReceivedAt: tTime ? new Date(tTime).getTime() : Date.now()
        }
      })
      setTags(tagsWithTimestamp)
    } catch (err) {
      console.error('Failed to load employee dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleTelemetryReading = (reading) => {
      const now = Date.now()
      setTags((prevTags) =>
        prevTags.map((tag) => {
          const idMatches = (tag.tagId && tag.tagId === reading.tagId) || (tag._id && tag._id.toString() === reading.tagId) || (tag.id && tag.id === reading.tagId)
          if (idMatches) {
            const dec = reading.decimal !== undefined ? reading.decimal : tag.decimal
            const isNone = dec === null || dec === undefined || String(dec).toLowerCase() === 'none' || Number(dec) === 0
            const rawVal = reading.valueStr ?? reading.valStr ?? reading.value
            const displayVal = isNone
              ? (!isNaN(Number(rawVal)) ? String(Math.trunc(Number(rawVal))) : String(rawVal).replace(/\.\d+$/, ''))
              : rawVal
            return {
              ...tag,
              decimal: dec,
              liveValue: displayVal,
              arrivedAt: reading.arrivedAt,
              lastReceivedAt: now,
              todayMax: reading.todayMax,
              yesterdayMax: reading.yesterdayMax,
              weekMax: reading.weekMax
            }
          }
          return tag
        })
      )
    }

    socket.on('telemetry:reading', handleTelemetryReading)
    return () => {
      socket.off('telemetry:reading', handleTelemetryReading)
    }
  }, [])

  const handleWatchlistToggle = async (tag) => {
    try {
      const isWatchlisted = await telemetryApi.toggleWatchlist(tag.tagId)
      setTags(tags.map(t => t.tagId === tag.tagId ? { ...t, isWatchlisted } : t))
      showToast({
        severity: 'success',
        summary: isWatchlisted ? 'Added to Watchlist' : 'Removed from Watchlist',
        detail: `${tag.topicName} updated successfully`,
        life: 2000
      })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    }
  }

  const gateways = []
  const gwIds = new Set()
  tags.forEach(t => {
    if (t.gateway && !gwIds.has(t.gateway.id)) {
      gwIds.add(t.gateway.id)
      gateways.push(t.gateway)
    }
  })

  const totalGW = gateways.length
  const onlineGW = gateways.filter(g => g.status === 'online').length
  const offlineGW = Math.max(0, totalGW - onlineGW)

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
      data: tags.map(t => t.displayName || t.parameterName || (t.topicName ? t.topicName.replace(/^p(\d+)/i, 'P$1') : '')),
      axisLabel: { color: '#94a3b8', fontSize: 9 },
      axisLine: { lineStyle: { color: '#e2e8f0' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 9 },
      splitLine: { lineStyle: { color: '#f8fafc' } }
    },
    series: [{
      name: 'Current Value',
      type: 'bar',
      data: tags.map(t => t.liveValue || t.todayMax || 0),
      itemStyle: { color: '#3b82f6', borderRadius: [2, 2, 0, 0] },
      barMaxWidth: 28
    }]
  }), [tags])

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
    tags.forEach(t => {
      const gwName = t.gateway?.name || 'Unassigned'
      m[gwName] = (m[gwName] || 0) + 1
    })
    return m
  }, [tags])

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard label="Assigned Gateways" value={gateways.length} icon="pi pi-sitemap" color="blue" />
            <StatCard label="Assigned Tags" value={tags.length} icon="pi pi-tag" color="green" />
            <StatCard label="Online Nodes" value={onlineGW} icon="pi pi-check-circle" color="amber" />
          </>
        )}
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
                Parameter Values Comparison
              </h3>
              <div className="flex-1 min-h-0">
                {tags.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-light">No parameters assigned</div>
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
    </div>
  )
}
