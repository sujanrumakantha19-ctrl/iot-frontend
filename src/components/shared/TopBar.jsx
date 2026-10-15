import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Dialog } from 'primereact/dialog'
import { getSession, logout } from '../../services/auth'
import { usersApi } from '../../services/usersApi'
import { companiesApi } from '../../services/companiesApi'
import { gatewaysApi } from '../../services/gatewaysApi'
import api from '../../services/axios'
import { initSocket } from '../../services/socketClient'
import { backupApi } from '../../services/backupApi'
import { downloadManager } from '../../services/downloadManager'

export default function TopBar({ title }) {
  const session = getSession()
  const navigate = useNavigate()
  const location = useLocation()

  const [downloadState, setDownloadState] = useState(downloadManager.getState())
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)
  const downloadPopupRef = useRef(null)

  useEffect(() => {
    return downloadManager.subscribe(setDownloadState)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadPopupRef.current && !downloadPopupRef.current.contains(event.target)) {
        setShowDownloadPopup(false)
      }
    }
    if (showDownloadPopup) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showDownloadPopup])

  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [employees, setEmployees] = useState([])
  const [companyName, setCompanyName] = useState('')
  const [selectedEmp, setSelectedEmp] = useState(
    localStorage.getItem('manager_selected_employee') || 'all'
  )

  const [searchItems, setSearchItems] = useState([])
  const [clockTime, setClockTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (session?.companyName) {
      setCompanyName(session.companyName)
    } else if (session?.companyId && session?.role !== 'admin') {
      companiesApi.getMyCompany()
        .then(res => {
          if (res?.company) setCompanyName(res.company.name)
        })
        .catch(err => console.error('Failed to fetch TopBar company:', err))
    }
  }, [session?.companyId, session?.companyName])

  useEffect(() => {
    if (session?.role === 'manager') {
      usersApi.getManagerEmployees()
        .then(list => {
          const emps = list || []
          setEmployees(emps)
          const stored = localStorage.getItem('manager_selected_employee') || 'all'
          if (stored !== 'all' && !emps.some(e => e._id?.toString() === stored)) {
            localStorage.setItem('manager_selected_employee', 'all')
            setSelectedEmp('all')
            window.dispatchEvent(new Event('manager_employee_changed'))
          }
        })
        .catch(err => console.error('Failed to load manager employees:', err))
    }

    const handleScopeChange = () => {
      setSelectedEmp(localStorage.getItem('manager_selected_employee') || 'all')
    }
    window.addEventListener('manager_employee_changed', handleScopeChange)
    return () => window.removeEventListener('manager_employee_changed', handleScopeChange)
  }, [session?.role])

  // Listen to keyboard shortcut ⌘F or Ctrl+K to trigger search modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault()
        setSearchModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Populate quick search index (pages + gateways)
  useEffect(() => {
    if (searchModalOpen) {
      const pageList = []
      const role = session?.role || 'admin'

      if (role === 'admin') {
        pageList.push(
          { label: 'Dashboard', category: 'Page', path: '/admin/dashboard', icon: 'pi pi-home' },
          { label: 'Companies', category: 'Page', path: '/admin/companies', icon: 'pi pi-building' },
          { label: 'Gateways', category: 'Page', path: '/admin/gateways', icon: 'pi pi-sitemap' },
          { label: 'Managers', category: 'Page', path: '/admin/managers', icon: 'pi pi-users' },
          { label: 'Users', category: 'Page', path: '/admin/employees', icon: 'pi pi-user' },
          { label: 'Thresholds', category: 'Page', path: '/admin/thresholds', icon: 'pi pi-exclamation-triangle' },
          { label: 'Digital Meters', category: 'Page', path: '/admin/digital-meters', icon: 'pi pi-gauge' },
          { label: 'Graphs', category: 'Page', path: '/admin/graphs', icon: 'pi pi-chart-line' },
          { label: 'Live Location', category: 'Page', path: '/admin/live-location', icon: 'pi pi-map' },
          { label: 'Backup', category: 'Page', path: '/admin/backup', icon: 'pi pi-download' },
          { label: 'Settings', category: 'Page', path: '/admin/settings', icon: 'pi pi-cog' },
          { label: 'Theme', category: 'Page', path: '/admin/theme', icon: 'pi pi-palette' }
        )

        gatewaysApi.getAll().then(res => {
          if (res?.gateways) {
            const gwItems = res.gateways.map(g => ({
              label: `${g.name} (${g.prefix})`,
              category: 'Gateway',
              path: `/admin/companies/${g.companyId}/gateways/${g._id}`,
              icon: 'pi pi-sitemap'
            }))
            setSearchItems([...pageList, ...gwItems])
          } else {
            setSearchItems(pageList)
          }
        }).catch(() => setSearchItems(pageList))
      } else if (role === 'manager') {
        pageList.push(
          { label: 'Dashboard', category: 'Page', path: '/manager/dashboard', icon: 'pi pi-home' },
          { label: 'Tabular View', category: 'Page', path: '/manager/tabular-view', icon: 'pi pi-table' },
          { label: 'Thresholds', category: 'Page', path: '/manager/thresholds', icon: 'pi pi-exclamation-triangle' },
          { label: 'Graphs', category: 'Page', path: '/manager/graphs', icon: 'pi pi-chart-bar' },
          { label: 'Reports', category: 'Page', path: '/manager/report', icon: 'pi pi-file' },
          { label: 'Users', category: 'Page', path: '/manager/users', icon: 'pi pi-users' },
          { label: 'Quick Insights', category: 'Page', path: '/manager/quick-insights', icon: 'pi pi-sliders-h' },
          { label: 'Settings', category: 'Page', path: '/manager/settings', icon: 'pi pi-cog' }
        )
        setSearchItems(pageList)
      } else {
        pageList.push(
          { label: 'Dashboard', category: 'Page', path: '/employee/dashboard', icon: 'pi pi-home' },
          { label: 'Tabular View', category: 'Page', path: '/employee/tabular-view', icon: 'pi pi-table' },
          { label: 'Graphs', category: 'Page', path: '/employee/graphs', icon: 'pi pi-chart-bar' },
          { label: 'Reports', category: 'Page', path: '/employee/report', icon: 'pi pi-file' },
          { label: 'Quick Insights', category: 'Page', path: '/employee/quick-insights', icon: 'pi pi-sliders-h' },
          { label: 'Settings', category: 'Page', path: '/employee/settings', icon: 'pi pi-cog' }
        )
        setSearchItems(pageList)
      }
    }
  }, [searchModalOpen, session?.role])

  const filteredSearchItems = searchItems.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleEmployeeChange = (e) => {
    const val = e.target.value
    setSelectedEmp(val)
    localStorage.setItem('manager_selected_employee', val)
    window.dispatchEvent(new Event('manager_employee_changed'))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleConfig = {
    admin: { color: 'bg-blue-50 text-[#1e3a8a] border border-blue-200', label: 'Administrator' },
    manager: { color: 'bg-indigo-50 text-indigo-800 border border-indigo-200', label: 'Manager' },
    employee: { color: 'bg-purple-50 text-purple-800 border border-purple-200', label: 'Employee' },
  }

  const cfg = roleConfig[session?.role] || { color: 'bg-slate-50 text-slate-600 border border-slate-200', label: session?.role }

  // System status metrics
  const [sysStatus, setSysStatus] = useState(null)
  const prevCountsRef = useRef(null)
  const [rateRW, setRateRW] = useState({ r: 0, w: 0 })

  useEffect(() => {
    let mounted = true
    const fetchStatus = async () => {
      try {
        const res = await api.get('/system-status')
        const data = res.data
        setSysStatus(data)
        if (prevCountsRef.current) {
          const dr = Math.max(0, data.reads - prevCountsRef.current.reads)
          const dw = Math.max(0, data.writes - prevCountsRef.current.writes)
          if (mounted) setRateRW({ r: dr, w: dw })
        }
        prevCountsRef.current = { reads: data.reads, writes: data.writes }
      } catch (_) {}
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  // Live Backup Sync state
  const [syncState, setSyncState] = useState(null)
  useEffect(() => {
    if (session?.role === 'admin') {
      backupApi.getSyncStatus()
        .then(state => { if (state) setSyncState(state) })
        .catch(err => console.error('Failed to load initial sync status:', err))

      const socket = initSocket()
      if (socket) {
        const handleSyncProgress = (data) => setSyncState(data)
        socket.on('backup:sync-progress', handleSyncProgress)
        const handleLocalSyncTrigger = () => {
          backupApi.getSyncStatus().then(s => s && setSyncState(s))
        }
        window.addEventListener('backup:local-trigger', handleLocalSyncTrigger)

        return () => {
          socket.off('backup:sync-progress', handleSyncProgress)
          window.removeEventListener('backup:local-trigger', handleLocalSyncTrigger)
        }
      }
    }
  }, [session?.role])

  const [bcUpdate, setBcUpdate] = useState(0)
  useEffect(() => {
    const handleBcUpdate = () => setBcUpdate(prev => prev + 1)
    window.addEventListener('breadcrumbs:update', handleBcUpdate)
    return () => window.removeEventListener('breadcrumbs:update', handleBcUpdate)
  }, [])

  const role = session?.role || 'admin'
  const homePath = `/${role}/dashboard`

  const generateBreadcrumbs = () => {
    const path = location.pathname
    if (path === '/' || path === homePath) {
      return [{ label: 'Home', path: homePath }]
    }

    const segments = path.split('/').filter(Boolean)
    const list = [{ label: 'Home', path: homePath }]
    let currentPath = ''
    segments.forEach((seg, index) => {
      currentPath += `/${seg}`
      if (index === 0) return

      const isObjectId = /^[0-9a-fA-F]{24}$/.test(seg)
      let label = seg.charAt(0).toUpperCase() + seg.slice(1)

      if (seg === 'companies') label = 'Companies'
      else if (seg === 'managers') label = 'Managers'
      else if (seg === 'employees') label = 'Users'
      else if (seg === 'gateways') label = 'Gateways'
      else if (seg === 'backup') label = 'Backup'
      else if (seg === 'telemetry' || seg === 'tabular-view') label = 'Tabular View'
      else if (seg === 'report') label = 'Reports'
      else if (seg === 'users') label = 'Users'
      else if (seg === 'quick-insights') label = 'Quick Insights'
      else if (seg === 'devices') label = 'Devices'
      else if (seg === 'history') label = 'History'
      else if (seg === 'theme' || seg === 'settings' || seg === 'change-password') label = 'Settings'
      else if (isObjectId) {
        if (segments[index - 1] === 'companies') {
          label = window.companyNameCache?.[seg] || (index === segments.length - 1 ? 'Company Detail' : 'Company')
        } else if (segments[index - 1] === 'gateways') {
          label = window.gatewayNameCache?.[seg] || 'Gateway Configuration'
        } else if (segments[index - 1] === 'users' || segments[index - 1] === 'employees') {
          label = 'User Profile'
        } else {
          label = 'Detail'
        }
      }

      let targetPath = currentPath
      if (seg === 'gateways' && segments[index - 2] === 'companies') {
        targetPath = '/admin/gateways'
      }

      list.push({ label, path: targetPath })
    })

    return list
  }

  const breadcrumbs = generateBreadcrumbs()

  return (
    <>
      {/* Top Bar Navigation Header */}
      <header className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 shrink-0 gap-3">
        
        {/* Left Section: Mobile Menu + Breadcrumb Navigation */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Mobile hamburger trigger */}
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0 border border-slate-200"
            onClick={() => window.dispatchEvent(new Event('sidebar:open'))}
            title="Open Menu"
          >
            <i className="pi pi-bars text-sm" />
          </button>

          {/* Breadcrumb Navigation inside TopBar Header */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium overflow-x-auto scrollbar-none py-0.5 select-none min-w-0">
            {breadcrumbs.map((bc, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <div key={idx} className="flex items-center gap-1.5 shrink-0">
                  {idx > 0 && <i className="pi pi-chevron-right text-[8px] text-slate-300" />}
                  {isLast ? (
                    <span className="text-slate-800 font-bold text-sm tracking-tight truncate max-w-[200px] sm:max-w-[300px]" style={{ color: 'var(--text-primary)' }}>{bc.label}</span>
                  ) : (
                    <Link
                      to={bc.path}
                      className="text-xs font-semibold transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {bc.label}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

        </div>

        {/* Right Section: Greeting + System Metrics + User Profile */}
        <div className="flex items-center gap-3 shrink-0">

          {/* User Greeting & Live Clock Badge (Right Section) */}
          {(() => {
            const h = clockTime.getHours()
            const greeting = h >= 5 && h < 12 ? { text: 'Good Morning', icon: '🌤️' }
              : h >= 12 && h < 17 ? { text: 'Good Afternoon', icon: '☀️' }
              : h >= 17 && h < 21 ? { text: 'Good Evening', icon: '🌇' }
              : { text: 'Good Night', icon: '🌙' }
            const timeStr = clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            const dateStr = clockTime.toLocaleDateString([], { month: 'short', day: 'numeric' })
            return (
              <div
                style={{ backgroundColor: 'var(--bg-hover, #f1f5f9)', borderColor: 'var(--border-color, #e2e8f0)' }}
                className="hidden lg:flex items-center border rounded-xl p-1 gap-1 shrink-0 select-none shadow-2xs h-[38px]"
              >
                <div
                  style={{ backgroundColor: 'var(--bg-card, #ffffff)' }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 h-full"
                >
                  <span className="text-sm leading-none">{greeting.icon}</span>
                  <span style={{ color: 'var(--text-secondary)' }} className="text-xs font-medium">
                    {greeting.text},{' '}
                    <strong className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {session?.name ? session.name.split(' ')[0] : 'User'}
                    </strong>
                  </span>
                </div>
                <div
                  style={{ backgroundColor: 'var(--bg-card, #ffffff)' }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 h-full"
                >
                  <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: 'var(--accent-primary, #2563eb)' }}>
                    {timeStr}
                  </span>
                  <span className="text-[10px] font-normal" style={{ color: 'var(--text-secondary)' }}>
                    ({dateStr})
                  </span>
                </div>
              </div>
            )
          })()}
          
          {/* Manager Scope Dropdown */}
          {session?.role === 'manager' && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl h-[38px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scope:</span>
              <select
                value={selectedEmp}
                onChange={handleEmployeeChange}
                className="h-full px-2 bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Users</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.addressLabel || emp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Realtime Backup Sync Progress */}
          {syncState && (syncState.status === 'running' || syncState.status === 'paused') && (
            <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-200/80 px-3 py-1.5 rounded-xl shadow-2xs h-[38px]">
              <i className={`pi ${syncState.status === 'running' ? 'pi-sync pi-spin text-[#1e3a8a]' : 'pi-pause-circle text-amber-500'} text-xs`} />
              <span className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-wide">
                Sync: <span className="font-mono text-xs">{syncState.progress}%</span>
              </span>
              <div className="w-16 bg-blue-200 h-1.5 rounded-full overflow-hidden shrink-0">
                <div 
                  className="h-full bg-[#1e3a8a] transition-all duration-300" 
                  style={{ width: `${syncState.progress}%` }} 
                />
              </div>
            </div>
          )}

          {/* System status metrics for admin */}
          {sysStatus && session?.role === 'admin' && (
            <div
              style={{ backgroundColor: 'var(--bg-hover, #f1f5f9)', borderColor: 'var(--border-color, #e2e8f0)' }}
              className="hidden xl:flex items-center border rounded-xl p-1 gap-1 shrink-0 h-[38px]"
            >
              <div
                style={{ backgroundColor: 'var(--bg-card, #ffffff)' }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 h-full"
                title="Database size"
              >
                <i className="pi pi-database text-[10px]" style={{ color: 'var(--text-secondary, #94a3b8)' }} />
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-primary, #1e293b)' }}>
                  {sysStatus.dbSizeMB} <span className="font-normal" style={{ color: 'var(--text-secondary, #94a3b8)' }}>MB</span>
                </span>
              </div>
              <div
                style={{ backgroundColor: 'var(--bg-card, #ffffff)' }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 h-full"
                title="Read/Write ops in last 10s"
              >
                <i className="pi pi-arrows-h text-[10px]" style={{ color: 'var(--text-secondary, #94a3b8)' }} />
                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--accent-primary, #2563eb)' }}>R&thinsp;{rateRW.r}</span>
                <span className="text-[9px]" style={{ color: 'var(--border-color, #cbd5e1)' }}>|</span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--accent-primary, #6366f1)' }}>W&thinsp;{rateRW.w}</span>
              </div>
              <div
                style={{
                  backgroundColor: sysStatus.mqttConnected ? '#10b981' : '#ef4444',
                  color: '#ffffff'
                }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 h-full shadow-2xs select-none"
                title="MQTT Connection Status"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-white">
                  MQTT {sysStatus.mqttConnected ? 'LIVE' : 'DOWN'}
                </span>
              </div>
            </div>
          )}

          {/* Admin Download Stream Button & Live Progress Popup */}
          {session?.role === 'admin' && (
            <div className="relative" ref={downloadPopupRef}>
              <button
                onClick={() => setShowDownloadPopup(prev => !prev)}
                style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                className={`topbar-download-btn icon-btn-circle border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                  downloadState.status === 'downloading'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 animate-pulse'
                    : downloadState.status === 'completed'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
                title="Database Downloads & Stream Progress"
              >
                {downloadState.status === 'downloading' ? (
                  <span className="font-extrabold text-[10px] font-mono text-blue-700">{downloadState.percent}%</span>
                ) : downloadState.status === 'completed' ? (
                  <i className="pi pi-check-circle text-emerald-600 text-sm" />
                ) : (
                  <i className="pi pi-download text-sm" style={{ color: 'var(--accent-primary, #1e3a8a)' }} />
                )}
              </button>

              {/* Floating Download Progress Popup Card */}
              {showDownloadPopup && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-2xl rounded-xl p-4 z-50 text-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-extrabold flex items-center gap-2 text-slate-800">
                      <i className="pi pi-download text-blue-600 text-xs" />
                      Live Backup Stream Downloader
                    </h4>
                    <button
                      onClick={() => setShowDownloadPopup(false)}
                      className="w-6 h-6 text-slate-400 hover:text-slate-600 flex items-center justify-center rounded-full hover:bg-slate-100 cursor-pointer"
                    >
                      <i className="pi pi-times text-[10px]" />
                    </button>
                  </div>

                  {downloadState.active ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="truncate max-w-[180px] text-slate-700">{downloadState.filename}</span>
                          <span className="text-blue-600 font-mono font-extrabold">{downloadState.percent}%</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              downloadState.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${downloadState.percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Speed, ETA & Size metrics */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block font-semibold uppercase">Speed</span>
                          <span className="font-extrabold text-slate-700 font-mono">{downloadState.speed}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-semibold uppercase">ETA</span>
                          <span className="font-extrabold text-slate-700 font-mono">{downloadState.eta}</span>
                        </div>
                        <div className="col-span-2 border-t border-slate-200/60 pt-1.5 flex justify-between">
                          <span className="text-slate-400 font-semibold uppercase">Size Transferred</span>
                          <span className="font-bold text-slate-600 font-mono">
                            {downloadManager.formatBytes(downloadState.receivedBytes)} / {downloadState.totalBytes ? downloadManager.formatBytes(downloadState.totalBytes) : 'Stream'}
                          </span>
                        </div>
                      </div>

                      {downloadState.status === 'downloading' && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => downloadManager.cancelDownload()}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <i className="pi pi-ban text-[10px]" />
                            Cancel Stream
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400 space-y-1">
                      <i className="pi pi-inbox text-2xl text-slate-300 block mb-1" />
                      <p className="font-semibold text-slate-600">No Active Downloads</p>
                      <p className="text-[10px] text-slate-400">Click Export in Backup settings tab to start a streaming backup.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </header>

      {/* Quick Search Modal */}
      <Dialog
        visible={searchModalOpen}
        onHide={() => setSearchModalOpen(false)}
        header={null}
        closable={false}
        className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 bg-slate-100/80 px-3.5 py-2.5 rounded-xl border border-slate-200">
            <i className="pi pi-search text-slate-400 text-sm" />
            <input
              type="text"
              autoFocus
              placeholder="Search pages, gateways, modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            <button
              onClick={() => setSearchModalOpen(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 border border-slate-300 rounded bg-white"
            >
              ESC
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 py-1">
            {filteredSearchItems.length > 0 ? (
              filteredSearchItems.map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSearchModalOpen(false)
                    setSearchQuery('')
                    navigate(item.path)
                  }}
                  className="flex items-center justify-between p-2.5 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#1e3a8a] group-hover:text-white flex items-center justify-center text-slate-500 transition-colors">
                      <i className={`${item.icon} text-xs`} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-[#1e3a8a]">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-[#1e3a8a]">
                    {item.category}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching results found
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <Dialog
        visible={logoutConfirmVisible}
        onHide={() => setLogoutConfirmVisible(false)}
        header={null}
        closable={false}
        className="w-full max-w-sm"
      >
        <div className="p-5 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <i className="pi pi-sign-out text-xl rotate-180" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">End Current Session</h3>
            <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
              Are you sure you want to log out of your account?
            </p>
          </div>
          <div className="flex gap-2.5 w-full pt-1">
            <button
              onClick={() => setLogoutConfirmVisible(false)}
              className="flex-1 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-2 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
