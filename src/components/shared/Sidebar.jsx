import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Dialog } from 'primereact/dialog'
import { getSession, logout, getMe } from '../../services/auth'
import { companiesApi } from '../../services/companiesApi'

const adminMenuGroups = [
  {
    title: 'MENU',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home', path: '/admin/dashboard' },
      { label: 'Companies', icon: 'pi pi-building', path: '/admin/companies' },
      { label: 'Managers', icon: 'pi pi-users', path: '/admin/managers' },
      { label: 'Users', icon: 'pi pi-user', path: '/admin/employees' },
      { label: 'Gateways', icon: 'pi pi-sitemap', path: '/admin/gateways' },
      { label: 'Thresholds', icon: 'pi pi-exclamation-triangle', path: '/admin/thresholds' },
      { label: 'Activity Logs', icon: 'pi pi-history', path: '/admin/activity-logs' },
      { label: 'Digital Meters', icon: 'pi pi-gauge', path: '/admin/digital-meters' },
      { label: 'Asset Digital Twin', icon: 'pi pi-box', path: '/admin/asset-digital-twin' },
      { label: 'Graphs', icon: 'pi pi-chart-line', path: '/admin/graphs' },
      { label: 'Live Location', icon: 'pi pi-map', path: '/admin/live-location' },
    ]
  },
  {
    title: 'GENERAL',
    items: [
      { label: 'Settings', icon: 'pi pi-cog', path: '/admin/settings' },
    ]
  }
]

const managerMenuGroups = [
  {
    title: 'MENU',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home', path: '/manager/dashboard' },
      { label: 'Tabular View', icon: 'pi pi-table', path: '/manager/tabular-view' },
      { label: 'Gateways', icon: 'pi pi-server', path: '/manager/gateways' },
      { label: 'Quick Insights', icon: 'pi pi-sliders-h', path: '/manager/quick-insights' },
      { label: 'Assign', icon: 'pi pi-link', path: '/manager/assign' },
      { label: 'Asset Digital Twin', icon: 'pi pi-box', path: '/manager/asset-digital-twin' },
      { label: 'Thresholds', icon: 'pi pi-exclamation-triangle', path: '/manager/thresholds' },
      { label: 'Graphs', icon: 'pi pi-chart-bar', path: '/manager/graphs' },
      { label: 'Reports', icon: 'pi pi-file', path: '/manager/report' },
      { label: 'Users', icon: 'pi pi-users', path: '/manager/users' },
    ]
  },
  {
    title: 'GENERAL',
    items: [
      { label: 'Settings', icon: 'pi pi-cog', path: '/manager/settings' },
    ]
  }
]

const employeeMenuGroups = [
  {
    title: 'MENU',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home', path: '/employee/dashboard' },
      { label: 'Tabular View', icon: 'pi pi-table', path: '/employee/tabular-view' },
      { label: 'Digital Meters', icon: 'pi pi-gauge', path: '/employee/digital-meters' },
      { label: 'Asset Digital Twin', icon: 'pi pi-box', path: '/employee/asset-digital-twin' },
      { label: 'Quick Insights', icon: 'pi pi-sliders-h', path: '/employee/quick-insights' },
      { label: 'Graphs', icon: 'pi pi-chart-bar', path: '/employee/graphs' },
      { label: 'Reports', icon: 'pi pi-file', path: '/employee/report' },
    ]
  },
  {
    title: 'GENERAL',
    items: [
      { label: 'Settings', icon: 'pi pi-cog', path: '/employee/settings' },
    ]
  }
]

export const openMobileSidebar = () => window.dispatchEvent(new Event('sidebar:open'))
export const closeMobileSidebar = () => window.dispatchEvent(new Event('sidebar:close'))

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const session = getSession()
  const [assignMode, setAssignMode] = useState(() => session?.assignPermissionMode || 'all')
  const [featurePerms, setFeaturePerms] = useState(() => session?.featurePermissions || {})
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (session?.role === 'manager') {
      getMe()
        .then(res => {
          const userObj = res?.user
          if (userObj) {
            const mode = userObj.assignPermissionMode || 'all'
            const fp = userObj.featurePermissions || {}
            setAssignMode(mode)
            setFeaturePerms(fp)
            const currentSession = getSession()
            if (currentSession) {
              localStorage.setItem('iot_session', JSON.stringify({
                ...currentSession,
                assignPermissionMode: mode,
                allowedGraphIds: userObj.allowedGraphIds || [],
                allowedMeterTypes: userObj.allowedMeterTypes || [],
                featurePermissions: fp
              }))
            }
          }
        })
        .catch(err => console.error('Failed to sync manager permissions:', err))
    }
  }, [location.pathname])

  useEffect(() => {
    const open = () => setMobileOpen(true)
    const close = () => setMobileOpen(false)
    window.addEventListener('sidebar:open', open)
    window.addEventListener('sidebar:close', close)
    return () => {
      window.removeEventListener('sidebar:open', open)
      window.removeEventListener('sidebar:close', close)
    }
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    if (session?.companyName) {
      setCompanyName(session.companyName)
    } else if (session?.companyId && session?.role !== 'admin') {
      companiesApi.getMyCompany()
        .then(res => { if (res?.company) setCompanyName(res.company.name) })
        .catch(err => console.error('Failed to fetch sidebar company:', err))
    }
  }, [session?.companyId, session?.companyName])

  const handleLogout = () => { logout(); navigate('/login') }

  const roleConfig = {
    admin: { label: 'Administrator' },
    manager: { label: 'Manager' },
    employee: { label: 'Employee' },
  }
  const cfg = roleConfig[session?.role] || { label: session?.role }

  const rawGroups = ({ admin: adminMenuGroups, manager: managerMenuGroups, employee: employeeMenuGroups })[session?.role] || []

  const groups = rawGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (session?.role === 'manager') {
        if (assignMode === 'restrict' && item.path === '/manager/assign') {
          return false
        }
        if (item.path === '/manager/users' && featurePerms?.showUsers === false) {
          return false
        }
        if (item.path === '/manager/gateways' && !featurePerms?.showGateway) {
          return false
        }
      }
      return true
    })
  }))

  const sidebarRef = useRef(null)
  const mobileSidebarRef = useRef(null)
  const isSidebarActiveRef = useRef(false)
  const [hoveredTooltip, setHoveredTooltip] = useState(null)

  // ─── KEYBOARD NAVIGATION (ArrowUp / ArrowDown) ───────────────
  const allNavItems = groups.flatMap(g => g.items)

  useEffect(() => {
    // Track whether the user's last click was inside the sidebar
    const handlePointerDown = (e) => {
      const isInsideDesktop = sidebarRef.current && sidebarRef.current.contains(e.target)
      const isInsideMobile = mobileSidebarRef.current && mobileSidebarRef.current.contains(e.target)
      isSidebarActiveRef.current = !!(isInsideDesktop || isInsideMobile)
    }

    const handleKeyDown = (e) => {
      // ONLY allow arrow nav when the user's last click was inside the sidebar
      if (!isSidebarActiveRef.current) return

      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

      const activeEl = document.activeElement
      if (
        activeEl &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
          activeEl.isContentEditable)
      ) {
        return
      }

      if (allNavItems.length === 0) return

      const path = location.pathname
      const currentIndex = allNavItems.findIndex(item => {
        if (item.path === `/${session?.role}/dashboard`) {
          return path === item.path
        } else if (item.path.endsWith('/gateways')) {
          return path.includes('/gateways')
        } else if (item.path.endsWith('/companies')) {
          return path.includes('/companies') && !path.includes('/gateways')
        } else if (item.path.endsWith('/employees')) {
          return path.includes('/employees')
        } else if (item.path.endsWith('/managers')) {
          return path.includes('/managers')
        } else if (item.path.endsWith('/users')) {
          return path.includes('/users')
        }
        return path.startsWith(item.path)
      })

      if (currentIndex === -1) return

      e.preventDefault()
      let nextIndex
      if (e.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % allNavItems.length
      } else {
        nextIndex = (currentIndex - 1 + allNavItems.length) % allNavItems.length
      }

      const targetItem = allNavItems[nextIndex]
      if (targetItem?.path) {
        navigate(targetItem.path)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [location.pathname, groups, session?.role, navigate, allNavItems])

  // ─── NAV ITEMS ───────────────────────────────────────────────
  const renderNavContent = (isMobile = false) => {
    const isCollapsedDesktop = collapsed && !isMobile
    return (
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overflowX: 'visible', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '24px', scrollbarWidth: 'none' }}>
        {groups.map((group, gIdx) => (
          <div key={gIdx}>
            {(!collapsed || isMobile) && (
              <h5 style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 6px 12px', userSelect: 'none' }}>
                {group.title}
              </h5>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {group.items.map((item) => {
                let active = false
                const path = location.pathname

                if (item.path === `/${session?.role}/dashboard`) {
                  active = path === item.path
                } else if (item.path.endsWith('/gateways')) {
                  active = path.includes('/gateways')
                } else if (item.path.endsWith('/companies')) {
                  active = path.includes('/companies') && !path.includes('/gateways')
                } else if (item.path.endsWith('/employees')) {
                  active = path.includes('/employees')
                } else if (item.path.endsWith('/managers')) {
                  active = path.includes('/managers')
                } else if (item.path.endsWith('/users')) {
                  active = path.includes('/users')
                } else {
                  active = path.startsWith(item.path)
                }

                return (
                  <div key={item.path} style={{ position: 'relative' }}>
                    <button
                      onClick={() => navigate(item.path)}
                      className={`sidebar-nav-btn ${active ? 'active' : ''}`}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: isCollapsedDesktop ? 0 : '12px',
                        justifyContent: isCollapsedDesktop ? 'center' : 'flex-start',
                        padding: isCollapsedDesktop ? '10px' : '10px 14px',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: active ? 700 : 600,
                        transition: 'all 0.15s ease',
                        background: active ? 'var(--accent-primary, #1e3a8a)' : 'transparent',
                        color: active ? 'var(--accent-contrast, #ffffff)' : 'var(--text-secondary, #64748b)',
                        position: 'relative',
                      }}
                      onMouseEnter={e => {
                        if (!active) e.currentTarget.style.background = 'var(--bg-hover, #f1f5f9)'
                        if (isCollapsedDesktop) {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setHoveredTooltip({ label: item.label, top: rect.top + rect.height / 2 })
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) e.currentTarget.style.background = 'transparent'
                        if (isCollapsedDesktop) {
                          setHoveredTooltip(null)
                        }
                      }}
                    >
                      <i className={item.icon} style={{ fontSize: '14px', color: active ? 'var(--accent-contrast, #ffffff)' : 'var(--text-secondary, #94a3b8)', transform: active ? 'scale(1.1)' : 'none', flexShrink: 0 }} />

                      {(!collapsed || isMobile) && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─── USER PROFILE ─────────────────────────────────────────────
  const renderUserProfile = (isMobile = false) => {
    if (collapsed && !isMobile) {
      return (
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-light, #f1f5f9)', display: 'flex', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setLogoutConfirmVisible(true)}
            style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-primary, #1e3a8a)', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={`Logout (${session?.name || 'User'})`}
          >
            <i className="pi pi-power-off text-sm" />
          </button>
        </div>
      )
    }
    return (
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-light, #f1f5f9)', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            gap: '10px',
            background: 'var(--bg-hover, #f8fafc)',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '8px 10px',
            borderRadius: '12px',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-primary, #3b82f6)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
            e.currentTarget.style.background = 'var(--bg-card, #ffffff)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-primary, #1e3a8a)', color: 'var(--accent-contrast, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
              {session?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #1e293b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session?.name || 'Admin User'}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', textTransform: 'capitalize', marginTop: '2px' }}>{cfg.label}</span>
            </div>
          </div>
          <button
            onClick={() => setLogoutConfirmVisible(true)}
            style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s ease', marginLeft: 'auto' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary, #94a3b8)' }}
            title="Logout"
          >
            <i className="pi pi-power-off" style={{ fontSize: '12px' }} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* CSS for tooltip hover */}
      <style>{`
        button:hover .sidebar-tooltip { opacity: 1 !important; }
      `}</style>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(2px)', zIndex: 40 }} onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <aside ref={mobileSidebarRef} style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: '256px',
        background: 'var(--bg-sidebar, #ffffff)', borderRight: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column',
        zIndex: 50, transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease', boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
      }} className="lg:hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', padding: '0 20px', borderBottom: '1px solid var(--border-light, #f1f5f9)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--accent-primary, #1e3a8a)', color: 'var(--accent-contrast, #ffffff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="pi pi-shield" style={{ fontSize: '13px' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text-primary, #1e293b)', letterSpacing: '-0.02em' }}>SarayuIIOT</span>
          </div>
          <button onClick={() => setMobileOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="pi pi-times" style={{ fontSize: '11px' }} />
          </button>
        </div>
        {renderNavContent(true)}
        {renderUserProfile(true)}
      </aside>

      {/* Desktop Sidebar Wrapper */}
      <div
        ref={sidebarRef}
        className="hidden lg:flex"
        style={{ width: collapsed ? '80px' : '240px', flexShrink: 0, position: 'relative', height: '100%', transition: 'width 0.3s ease' }}
      >
        {/* PERFECT CIRCLE TOGGLE with Theme Variables */}
        <button
          onClick={toggleCollapsed}
          className="sidebar-toggle-btn"
          style={{
            position: 'absolute',
            top: '52px',
            right: '-12px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid var(--border-color, #cbd5e1)',
            color: 'var(--accent-primary, #1e3a8a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 30,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <i className={`pi ${collapsed ? 'pi-chevron-right' : 'pi-chevron-left'}`} style={{ fontSize: '10px', color: 'var(--accent-primary, #1e3a8a)', fontWeight: 'bold' }} />
        </button>

        {/* Sidebar Panel */}
        <aside style={{
          width: '100%', height: '100%', background: 'var(--bg-sidebar, #ffffff)',
          borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'visible',
        }}>
          {/* Brand Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', height: '64px',
            padding: collapsed ? '0 20px' : '0 20px',
            borderBottom: '1px solid var(--border-light, #f1f5f9)', flexShrink: 0, overflow: 'hidden',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-primary, #1e3a8a)', color: 'var(--accent-contrast, #ffffff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(30,58,138,0.25)' }}>
              <i className="pi pi-shield" style={{ fontSize: '14px' }} />
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '15px', color: 'var(--text-primary, #1e293b)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SarayuIIOT</span>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '-1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {companyName || 'Enterprise'}
                </span>
              </div>
            )}
          </div>

          {renderNavContent(false)}
          {renderUserProfile(false)}
        </aside>
      </div>

      {/* Logout Dialog */}
      <Dialog visible={logoutConfirmVisible} onHide={() => setLogoutConfirmVisible(false)} header={null} closable={false} className="w-full max-w-sm">
        <div className="p-5 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <i className="pi pi-sign-out text-xl rotate-180" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">End Current Session</h3>
            <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">Are you sure you want to log out?</p>
          </div>
          <div className="flex gap-2.5 w-full pt-1">
            <button onClick={() => setLogoutConfirmVisible(false)} className="flex-1 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer transition-colors">Cancel</button>
            <button onClick={handleLogout} className="flex-1 py-2 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors shadow-sm">Logout</button>
          </div>
        </div>
      </Dialog>

      {/* Fixed Tooltip when collapsed */}
      {collapsed && hoveredTooltip && (
        <div
          style={{
            position: 'fixed',
            left: '88px',
            top: `${hoveredTooltip.top}px`,
            transform: 'translateY(-50%)',
            background: 'var(--accent-primary, #0f172a)',
            color: 'var(--accent-contrast, #ffffff)',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: '8px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 99999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {hoveredTooltip.label}
          <span style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '5px solid var(--accent-primary, #0f172a)' }} />
        </div>
      )}
    </>
  )
}
