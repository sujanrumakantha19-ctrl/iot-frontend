import React, { useState, useEffect, useCallback, useRef } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { quickInsightsApi } from '../../services/quickInsightsApi'
import TabBar from '../../components/quickinsights/TabBar'
import WidgetCard from '../../components/quickinsights/WidgetCard'
import { getSocket } from '../../services/socketClient'

export default function EmployeeQuickInsightsPage() {
  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [widgets, setWidgets] = useState([])
  const [layout, setLayout] = useState([])
  const [loading, setLoading] = useState(false)

  const roRef = useRef(null)
  const [gridWidth, setGridWidth] = useState(0)

  // Callback ref: attaches ResizeObserver the moment the grid container div mounts
  const containerRef = useCallback((node) => {
    if (roRef.current) {
      roRef.current.disconnect()
      roRef.current = null
    }
    if (node) {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const w = Math.floor(entry.contentRect.width)
          if (w > 0) setGridWidth(w)
        }
      })
      ro.observe(node)
      roRef.current = ro
      setGridWidth(Math.floor(node.getBoundingClientRect().width))
    }
  }, [])

  const loadTabs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await quickInsightsApi.getEmployeeTabs()
      const tabsData = res.data.tabs || []
      setTabs(tabsData)
      if (tabsData.length > 0 && !activeTabId) {
        setActiveTabId(tabsData[0]._id)
      }
    } catch (err) {
      console.error('Failed to load tabs:', err)
      setTabs([])
    } finally {
      setLoading(false)
    }
  }, [activeTabId])

  const loadWidgets = useCallback(async (tabId) => {
    if (!tabId) return
    try {
      const res = await quickInsightsApi.getEmployeeWidgets(tabId)
      const wData = res.data.widgets || []
      setWidgets(wData)
      setLayout(wData.map(w => ({
        i: w._id,
        x: w.x,
        y: w.y,
        w: w.type === 'assetTwin' ? (w.w || 12) : w.w,
        h: w.type === 'assetTwin' ? (w.h || 6) : w.h,
        static: true
      })))
    } catch (err) {
      console.error('Failed to load widgets:', err)
      setWidgets([])
      setLayout([])
    }
  }, [])

  useEffect(() => {
    loadTabs()
  }, [loadTabs])

  useEffect(() => {
    if (activeTabId) {
      loadWidgets(activeTabId)
    }
  }, [activeTabId, loadWidgets])

  // Live Socket.io Telemetry Listener
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleReading = (reading) => {
      setWidgets(prev => prev.map(w => {
        if (w.type === 'assetTwin' && w.assetTwin?.tagBindings) {
          const bindings = w.assetTwin.tagBindings
          let slotKey = null
          Object.entries(bindings).forEach(([key, tag]) => {
            const tagId = tag?._id?.toString?.() || tag?._id
            if (tagId && tagId === reading.tagId?.toString()) slotKey = key
          })
          if (slotKey) {
            return {
              ...w,
              assetTwin: {
                ...w.assetTwin,
                values: {
                  ...(w.assetTwin.values || {}),
                  [slotKey]: reading.value != null ? reading.value : w.assetTwin.values?.[slotKey]
                },
                tagBindings: {
                  ...bindings,
                  [slotKey]: {
                    ...bindings[slotKey],
                    latestValue: reading.value != null ? reading.value : bindings[slotKey]?.latestValue,
                    latestValueStr: reading.valueStr || reading.valStr || bindings[slotKey]?.latestValueStr,
                    latestArrivedAt: reading.arrivedAt || bindings[slotKey]?.latestArrivedAt
                  }
                }
              }
            }
          }
        }
        const isTagMatch = (w.tagId && String(w.tagId) === String(reading.tagId)) || (w.tag?._id && String(w.tag._id) === String(reading.tagId))
        if (isTagMatch) {
          return {
            ...w,
            tag: {
              ...w.tag,
              latestValue: reading.value != null ? reading.value : w.tag?.latestValue,
              latestValueStr: reading.valueStr || reading.valStr || (reading.value != null ? String(reading.value) : w.tag?.latestValueStr),
              decimal: reading.decimal !== undefined ? reading.decimal : w.tag?.decimal,
              latestArrivedAt: reading.arrivedAt || new Date().toISOString()
            }
          }
        }
        return w
      }))
    }

    socket.on('telemetry:reading', handleReading)

    const handleRefresh = () => {
      if (activeTabId) loadWidgets(activeTabId)
      loadTabs()
    }
    socket.on('quick-insights:refresh-required', handleRefresh)
    socket.on('telemetry:tags-deleted', handleRefresh)

    return () => {
      socket.off('telemetry:reading', handleReading)
      socket.off('quick-insights:refresh-required', handleRefresh)
      socket.off('telemetry:tags-deleted', handleRefresh)
    }
  }, [activeTabId, loadWidgets, loadTabs])

  return (
    <div className="w-full space-y-4">
      {/* ── Header ── */}
      <div
        className="rounded-2xl p-4 border shadow-xs flex items-center gap-3"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold shadow-xs">
          <i className="pi pi-chart-line text-lg" />
        </div>
        <div>
          <h2 className="text-base font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>
            Quick Insights
          </h2>
          <p className="text-xs font-semibold text-slate-400">
            Real-time telemetry parameter monitoring dashboard
          </p>
        </div>
      </div>

      {/* ── Main Content Container ── */}
      <div className="space-y-3">
        {/* Tab Bar Header */}
        <div
          className="rounded-2xl p-3 border shadow-xs flex items-center justify-between"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={setActiveTabId}
            editable={false}
          />
        </div>

        {/* Grid Content Body */}
        {loading ? (
          <div
            className="w-full min-h-[350px] flex items-center justify-center rounded-2xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <i className="pi pi-spinner pi-spin text-blue-600 text-2xl" />
          </div>
        ) : tabs.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed p-12 text-center flex flex-col items-center justify-center space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
              <i className="pi pi-inbox" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>No Insights Configured</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1 max-w-md mx-auto">
                Your manager has not configured any quick insight tabs for your dashboard yet.
              </p>
            </div>
          </div>
        ) : activeTabId ? (
          <div ref={containerRef} className="w-full min-h-[400px]">
            {widgets.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed p-12 text-center flex flex-col items-center justify-center space-y-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                  <i className="pi pi-chart-bar" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>No widgets in this tab</h3>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                    Your manager has not added any meters or graphs to this tab yet.
                  </p>
                </div>
              </div>
            ) : (
              <GridLayout
                className="layout"
                layout={layout}
                cols={12}
                rowHeight={100}
                width={gridWidth > 0 ? gridWidth : undefined}
                compactType="vertical"
                margin={[10, 10]}
                containerPadding={[0, 12]}
                isDraggable={false}
                isResizable={false}
              >
                {widgets.map(w => (
                  <div key={w._id} className="h-full w-full">
                    <WidgetCard
                      widget={w}
                      editable={false}
                    />
                  </div>
                ))}
              </GridLayout>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
