import React, { useState, useEffect, useCallback, useRef } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { getSession } from '../../services/auth'
import { quickInsightsApi } from '../../services/quickInsightsApi'
import TabBar from '../../components/quickinsights/TabBar'
import WidgetCard from '../../components/quickinsights/WidgetCard'
import AddWidgetModal from '../../components/quickinsights/AddWidgetModal'
import { getSocket } from '../../services/socketClient'

const ALL_RESIZE_HANDLES = ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']

export default function ManagerQuickInsightsPage() {
  const session = getSession()
  // selectedEmpId is driven by the top bar SCOPE selector (via localStorage + event)
  const [selectedEmpId, setSelectedEmpId] = useState(() => localStorage.getItem('manager_selected_employee') || 'all')

  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [widgets, setWidgets] = useState([])
  const [layout, setLayout] = useState([])
  const [loading, setLoading] = useState(false)

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deleteWidgetModalOpen, setDeleteWidgetModalOpen] = useState(false)
  const [widgetToDelete, setWidgetToDelete] = useState(null)

  const roRef = useRef(null)
  const [gridWidth, setGridWidth] = useState(0)
  const saveTimerRef = useRef(null)

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

  const assignPermissionMode = session?.assignPermissionMode || 'all'
  const allowedGraphIds = session?.allowedGraphIds || []
  const allowedMeterTypes = session?.allowedMeterTypes || []

  // Listen for top bar scope changes (SCOPE selector in top bar dispatches this event)
  useEffect(() => {
    const handleScopeChange = () => {
      const nextId = localStorage.getItem('manager_selected_employee') || 'all'
      setSelectedEmpId(nextId)
    }
    // Also read on mount in case topbar already set it before we rendered
    handleScopeChange()
    window.addEventListener('manager_employee_changed', handleScopeChange)
    return () => window.removeEventListener('manager_employee_changed', handleScopeChange)
  }, [])

  const loadTabs = useCallback(async (empId) => {
    if (!empId || empId === 'all') return
    setLoading(true)
    try {
      const res = await quickInsightsApi.getTabs(empId)
      const tabsData = res.data.tabs || []
      setTabs(tabsData)
      if (tabsData.length > 0) {
        if (!activeTabId || !tabsData.find(t => t._id === activeTabId)) {
          setActiveTabId(tabsData[0]._id)
        }
      } else {
        setActiveTabId(null)
        setWidgets([])
        setLayout([])
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
      const res = await quickInsightsApi.getWidgets(tabId)
      const wData = res.data.widgets || []
      setWidgets(wData)
      setLayout(wData.map(w => ({
        i: w._id,
        x: w.x,
        y: w.y,
        w: w.type === 'assetTwin' ? (w.w || 12) : w.w,
        h: w.type === 'assetTwin' ? (w.h || 6) : w.h,
        minW: w.type === 'assetTwin' ? 12 : 2,
        minH: w.type === 'assetTwin' ? 5 : 2,
        maxW: 12,
        resizeHandles: ALL_RESIZE_HANDLES
      })))
    } catch (err) {
      console.error('Failed to load widgets:', err)
      setWidgets([])
      setLayout([])
    }
  }, [])

  useEffect(() => {
    if (selectedEmpId && selectedEmpId !== 'all') {
      loadTabs(selectedEmpId)
    }
  }, [selectedEmpId, loadTabs])

  useEffect(() => {
    if (activeTabId) {
      loadWidgets(activeTabId)
    } else {
      setWidgets([])
      setLayout([])
    }
  }, [activeTabId, loadWidgets])

  // Real-time socket telemetry updates
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
      if (selectedEmpId && selectedEmpId !== 'all') loadTabs(selectedEmpId)
    }
    socket.on('quick-insights:refresh-required', handleRefresh)
    socket.on('telemetry:tags-deleted', handleRefresh)

    return () => {
      socket.off('telemetry:reading', handleReading)
      socket.off('quick-insights:refresh-required', handleRefresh)
      socket.off('telemetry:tags-deleted', handleRefresh)
    }
  }, [activeTabId, selectedEmpId, loadWidgets, loadTabs])

  const handleCreateTab = async (name) => {
    if (!selectedEmpId || selectedEmpId === 'all') return
    try {
      const res = await quickInsightsApi.createTab(selectedEmpId, { name })
      const newTab = res.data.tab
      setTabs(prev => [...prev, newTab])
      setActiveTabId(newTab._id)
    } catch (err) {
      console.error('Failed to create tab:', err)
    }
  }

  const handleRenameTab = async (tabId, name) => {
    try {
      await quickInsightsApi.updateTab(tabId, { name })
      setTabs(prev => prev.map(t => (t._id === tabId ? { ...t, name } : t)))
    } catch (err) {
      console.error('Failed to rename tab:', err)
    }
  }

  const handleDeleteTab = async (tabId) => {
    try {
      await quickInsightsApi.deleteTab(tabId)
      const remaining = tabs.filter(t => t._id !== tabId)
      setTabs(remaining)
      if (activeTabId === tabId) {
        setActiveTabId(remaining.length > 0 ? remaining[0]._id : null)
      }
    } catch (err) {
      console.error('Failed to delete tab:', err)
    }
  }

  const saveLayoutToDb = async (currentLayout) => {
    if (!activeTabId || !currentLayout?.length) return
    try {
      const updates = currentLayout.map(item => ({
        widgetId: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
      }))
      await quickInsightsApi.saveLayout(activeTabId, updates)
    } catch (err) {
      console.error('Failed to save layout to DB:', err)
    }
  }

  const handleLayoutChange = (newLayout) => {
    const updated = newLayout.map(item => ({
      ...item,
      resizeHandles: ALL_RESIZE_HANDLES
    }))
    setLayout(updated)
  }

  const handleDragStop = (newLayout) => {
    const updated = newLayout.map(item => ({
      ...item,
      resizeHandles: ALL_RESIZE_HANDLES
    }))
    setLayout(updated)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveLayoutToDb(updated)
    }, 300)
  }

  const handleResizeStop = (newLayout) => {
    const updated = newLayout.map(item => ({
      ...item,
      resizeHandles: ALL_RESIZE_HANDLES
    }))
    setLayout(updated)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveLayoutToDb(updated)
    }, 300)
  }

  const handlePromptDeleteWidget = (widgetId) => {
    const w = widgets.find(item => item._id === widgetId)
    if (w) {
      setWidgetToDelete(w)
      setDeleteWidgetModalOpen(true)
    }
  }

  const handleConfirmDeleteWidget = async () => {
    if (!widgetToDelete) return
    try {
      await quickInsightsApi.deleteWidget(widgetToDelete._id)
      setWidgets(prev => prev.filter(w => w._id !== widgetToDelete._id))
      setLayout(prev => prev.filter(l => l.i !== widgetToDelete._id))
      setTabs(prev => prev.map(t => (t._id === activeTabId ? { ...t, widgetCount: Math.max(0, (t.widgetCount || 1) - 1) } : t)))
    } catch (err) {
      console.error('Failed to delete widget:', err)
    } finally {
      setDeleteWidgetModalOpen(false)
      setWidgetToDelete(null)
    }
  }

  const handleWidgetAdded = (newWidget) => {
    setWidgets(prev => [...prev, newWidget])
    setLayout(prev => [
      ...prev,
      {
        i: newWidget._id,
        x: newWidget.x,
        y: newWidget.y,
        w: newWidget.type === 'assetTwin' ? (newWidget.w || 12) : newWidget.w,
        h: newWidget.type === 'assetTwin' ? (newWidget.h || 6) : newWidget.h,
        minW: newWidget.type === 'assetTwin' ? 12 : 2,
        minH: newWidget.type === 'assetTwin' ? 5 : 2,
        maxW: 12,
        resizeHandles: ALL_RESIZE_HANDLES
      }
    ])
    setTabs(prev => prev.map(t => (t._id === activeTabId ? { ...t, widgetCount: (t.widgetCount || 0) + 1 } : t)))
  }

  return (
    <div className="w-full space-y-4">
      {/* ── Main Tab & Grid Dashboard Container ── */}
      {selectedEmpId && selectedEmpId !== 'all' ? (
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
              onCreateTab={handleCreateTab}
              onRenameTab={handleRenameTab}
              onDeleteTab={handleDeleteTab}
              editable={true}
              rightActions={
                activeTabId ? (
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 px-4 h-[38px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none shadow-xs shrink-0"
                  >
                    <i className="pi pi-plus text-xs" />
                    <span>Add Widget</span>
                  </button>
                ) : null
              }
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
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
                <i className="pi pi-plus-circle" />
              </div>
              <div>
                <h3 className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>No Tabs Created Yet</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1 max-w-md mx-auto">
                  Create a custom tab (e.g., "Vibration Monitor", "Temperature Suite") to start building the telemetry dashboard.
                </p>
              </div>
              <button
                onClick={() => handleCreateTab('Main Dashboard')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer border-none shadow-xs"
              >
                Create "Main Dashboard" Tab
              </button>
            </div>
          ) : activeTabId ? (
            <div ref={containerRef} className="w-full min-h-[400px]">
              {widgets.length === 0 ? (
                <div
                  className="rounded-2xl border border-dashed p-12 text-center flex flex-col items-center justify-center space-y-3"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                    <i className="pi pi-chart-line" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>This tab is empty</h3>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                      Add a digital meter or live telemetry graph to display parameters.
                    </p>
                  </div>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer border-none shadow-xs"
                  >
                    + Add First Widget
                  </button>
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
                  isDraggable={true}
                  isResizable={true}
                  resizeHandles={ALL_RESIZE_HANDLES}
                  onLayoutChange={handleLayoutChange}
                  onDragStop={handleDragStop}
                  onResizeStop={handleResizeStop}
                >
                  {widgets.map(w => (
                    <div key={w._id} className="h-full w-full">
                      <WidgetCard
                        widget={w}
                        editable={true}
                        onDelete={handlePromptDeleteWidget}
                      />
                    </div>
                  ))}
                </GridLayout>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Please select an employee scope from the top bar to configure Quick Insights.</p>
        </div>
      )}


      {/* Add Widget Modal */}
      <AddWidgetModal
        visible={addModalOpen}
        employeeId={selectedEmpId}
        tabId={activeTabId}
        onClose={() => setAddModalOpen(false)}
        onAdded={handleWidgetAdded}
        assignPermissionMode={assignPermissionMode}
        allowedGraphIds={allowedGraphIds}
        allowedMeterTypes={allowedMeterTypes}
      />

      {/* Delete Widget Confirmation Modal */}
      {deleteWidgetModalOpen && widgetToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setDeleteWidgetModalOpen(false)}
        >
          <div
            className="rounded-3xl shadow-2xl border max-w-md w-full overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)' }}
            >
              <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <i className="pi pi-exclamation-triangle text-amber-500 text-base" />
                Remove Widget
              </h3>
              <button
                type="button"
                onClick={() => setDeleteWidgetModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80 transition-colors border-none cursor-pointer"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                Are you sure you want to remove the widget for <strong>"{widgetToDelete.tag?.displayName || widgetToDelete.tag?.parameterName || 'this parameter'}"</strong> from this tab?
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteWidgetModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteWidget}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer border-none shadow-xs"
                >
                  Remove Widget
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
