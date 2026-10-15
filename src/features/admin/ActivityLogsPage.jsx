import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../services/axios'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import ActivityUserTimelineModal from './ActivityUserTimelineModal'

export default function ActivityLogsPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalLogs: 0, todayLogs: 0, securityEvents: 0, gatewayEvents: 0 })
  const [companies, setCompanies] = useState([])

  // Search & Filters state
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('all')
  const [selectedRole, setSelectedRole] = useState('all')

  // Pagination state (12 User Cards per page)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 12

  // User Timeline Modal state
  const [timelineModalVisible, setTimelineModalVisible] = useState(false)
  const [selectedUserObj, setSelectedUserObj] = useState(null)

  // 500ms Debounce Timer for Search Input
  const debounceTimerRef = useRef(null)

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchInput(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 500)
  }

  // Load companies and summary stats
  useEffect(() => {
    api.get('/admin/companies')
      .then(res => setCompanies(res.data.companies || []))
      .catch(err => console.error('[ActivityLogs] Failed to fetch companies:', err))

    api.get('/admin/activity-logs/stats')
      .then(res => setStats(res.data.stats || {}))
      .catch(err => console.error('[ActivityLogs] Failed to fetch stats:', err))
  }, [])

  // Fetch unique User cards from backend with 12 items per page pagination
  const fetchUserCards = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        page,
        limit,
        search: debouncedSearch,
        companyId: selectedCompany,
        role: selectedRole
      }

      const res = await api.get('/admin/activity-logs/users', { params })
      setUsers(res.data.users || [])
      setTotalPages(res.data.totalPages || 1)
      setTotalCount(res.data.total || 0)
    } catch (err) {
      console.error('[ActivityLogs] Error fetching user cards:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, selectedCompany, selectedRole])

  useEffect(() => {
    fetchUserCards()
  }, [fetchUserCards])

  const openTimelineModal = (user) => {
    setSelectedUserObj({
      userId: user.userId || user._id,
      userName: user.userName,
      userEmail: user.userEmail,
      userPhone: user.userPhone,
      userRole: user.userRole
    })
    setTimelineModalVisible(true)
  }

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'admin':
        return { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'ADMIN' }
      case 'manager':
        return { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'MANAGER' }
      case 'employee':
      default:
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'USER' }
    }
  }

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return ''
    const date = new Date(isoStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Header Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Total System Logs</p>
            <h4 className="text-xl font-extrabold text-[var(--text-primary)]">{stats.totalLogs || 0}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-lg">
            <i className="pi pi-history" />
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Logins / Events Today</p>
            <h4 className="text-xl font-extrabold text-[var(--text-primary)]">{stats.todayLogs || 0}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-lg">
            <i className="pi pi-check-circle" />
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Security Audits</p>
            <h4 className="text-xl font-extrabold text-[var(--text-primary)]">{stats.securityEvents || 0}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-lg">
            <i className="pi pi-shield" />
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Gateway Activities</p>
            <h4 className="text-xl font-extrabold text-[var(--text-primary)]">{stats.gatewayEvents || 0}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-lg">
            <i className="pi pi-sitemap" />
          </div>
        </div>
      </div>

      {/* Main Controls & User Cards Grid Container */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-2xs space-y-4">
        
        {/* Top Controls: Search Bar & Company Selector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Backend Driven Search Bar with 500ms Debounce */}
          <div className="relative flex-1 max-w-md">
            <i className="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search by User Name, Email, or Phone (500ms debounced)..."
              className="w-full pl-10 pr-9 py-2 border border-slate-200 hover:border-slate-350 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setDebouncedSearch('')
                  setPage(1)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                <i className="pi pi-times-circle" />
              </button>
            )}
          </div>

          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value)
                setPage(1)
              }}
              className="border border-slate-200 hover:border-slate-350 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white cursor-pointer transition-all min-w-[180px]"
            >
              <option value="all">🏢 All Companies</option>
              {companies.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 overflow-x-auto">
          {[
            { id: 'all', label: 'All Roles' },
            { id: 'admin', label: 'Admins' },
            { id: 'manager', label: 'Managers' },
            { id: 'employee', label: 'Users' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedRole(tab.id)
                setPage(1)
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRole === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Unique User Cards Grid (12 User Cards per page) */}
        {loading ? (
          <div className="py-20 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-400 font-semibold mt-3">Loading Active Users List...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center select-none flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/30 my-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <i className="pi pi-users text-xl" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">No Active Users Found</h4>
            <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed font-medium">
              No matching user cards found for your current search and role criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
            {users.map((user, idx) => {
              const roleBadge = getRoleBadgeStyle(user.userRole)
              return (
                <div
                  key={user._id || idx}
                  onClick={() => openTimelineModal(user)}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    {/* User Monogram Header & Role Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center uppercase shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                          {user.userName ? user.userName.charAt(0) : 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                            {user.userName || 'Unnamed User'}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">
                            {user.userEmail || user.userPhone || 'No Email'}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${roleBadge.bg}`}>
                        {roleBadge.label}
                      </span>
                    </div>

                    {/* Company Tag */}
                    {user.companyName && (
                      <div className="mb-3">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100/80 border border-slate-200/60 px-2 py-0.5 rounded-md inline-block">
                          🏢 {user.companyName}
                        </span>
                      </div>
                    )}

                    {/* User Activity Stats Pill */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between text-xs my-1">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Total Actions</span>
                        <strong className="text-slate-800 font-extrabold text-xs">{user.totalActivities || 0} Recorded</strong>
                      </div>
                      {user.lastAction && (
                        <div className="text-right">
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Latest Action</span>
                          <span className="text-blue-600 font-bold text-[11px] truncate block max-w-[110px]">{user.lastAction}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Last Active & View Timeline Link */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      Last Active: {formatTimestamp(user.lastActiveAt)}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openTimelineModal(user)
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>View Timeline</span>
                      <i className="pi pi-arrow-right text-[9px]" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Backend Pagination Controls (12 Unique User Cards per page) */}
        {!loading && users.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Showing Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong> ({totalCount} active users)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all font-semibold"
              >
                <i className="pi pi-chevron-left text-[10px] mr-1" />
                Previous
              </button>

              <span className="px-2.5 py-1 text-slate-700 font-bold bg-slate-100 rounded-lg">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all font-semibold"
              >
                Next
                <i className="pi pi-chevron-right text-[10px] ml-1" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Interactive Infinite Scroll User Activity Timeline Modal with Date Picker */}
      <ActivityUserTimelineModal
        visible={timelineModalVisible}
        onHide={() => setTimelineModalVisible(false)}
        userObj={selectedUserObj}
      />
    </div>
  )
}
