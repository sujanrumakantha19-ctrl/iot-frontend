import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog } from 'primereact/dialog'
import api from '../../services/axios'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

export default function ActivityUserTimelineModal({ visible, onHide, userObj }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // Top Date Picker & Category Filters inside Modal
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [expandedLogId, setExpandedLogId] = useState(null)
  const scrollContainerRef = useRef(null)

  const userId = userObj?.userId || userObj?._id || userObj?.id
  const userEmail = userObj?.userEmail

  // Reset states when modal opens/closes or when user/filters change
  useEffect(() => {
    if (visible && (userId || userEmail)) {
      setPage(1)
      setLogs([])
      fetchTimelineLogs(1, true)
    } else {
      setLogs([])
      setPage(1)
      setHasMore(false)
    }
  }, [visible, userId, userEmail, startDate, endDate, selectedCategory])

  const fetchTimelineLogs = async (pageNum, isInitial = false) => {
    if (!userId && !userEmail) return

    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const params = {
        userId,
        userEmail,
        page: pageNum,
        limit: 15, // Load 15 logs per infinite scroll chunk
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined
      }

      const res = await api.get('/admin/activity-logs/timeline', { params })
      const fetchedLogs = res.data.logs || []
      const moreAvailable = Boolean(res.data.hasMore)

      if (isInitial) {
        setLogs(fetchedLogs)
      } else {
        setLogs(prev => [...prev, ...fetchedLogs])
      }

      setHasMore(moreAvailable)
      setTotalCount(res.data.total || 0)
      setPage(pageNum)
    } catch (err) {
      console.error('[Timeline] Failed to load timeline batch:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Infinite Scroll Trigger on Scroll Container
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el || loading || loadingMore || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = el
    // If user is within 50px of bottom, fetch next page
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      fetchTimelineLogs(page + 1, false)
    }
  }, [loading, loadingMore, hasMore, page])

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'Security':
        return { bg: 'bg-rose-500/10 text-rose-600 border-rose-200', icon: 'pi pi-shield' }
      case 'Gateway':
        return { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: 'pi pi-sitemap' }
      case 'Company':
        return { bg: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: 'pi pi-building' }
      case 'User':
        return { bg: 'bg-purple-500/10 text-purple-600 border-purple-200', icon: 'pi pi-user' }
      case 'Telemetry':
        return { bg: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: 'pi pi-sliders-h' }
      default:
        return { bg: 'bg-slate-500/10 text-slate-600 border-slate-200', icon: 'pi pi-info-circle' }
    }
  }

  const getImpactBadge = (action) => {
    if (action && (action.includes('DELETE') || action.includes('REMOVE'))) {
      return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'HIGH IMPACT', dot: 'bg-rose-500' }
    }
    if (action && (action.includes('PUBLISH') || action.includes('UPDATE') || action.includes('WRITE') || action.includes('ASSIGN'))) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'CONFIG CHANGE', dot: 'bg-amber-500' }
    }
    return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'STANDARD', dot: 'bg-emerald-500' }
  }

  const getRelativeTime = (isoStr) => {
    if (!isoStr) return ''
    const now = new Date()
    const date = new Date(isoStr)
    const diffSec = Math.floor((now - date) / 1000)

    if (diffSec < 10) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}h ago`
    const diffDays = Math.floor(diffHour / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatExactTimestamp = (isoStr) => {
    if (!isoStr) return ''
    const date = new Date(isoStr)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatTimeOnly = (isoStr) => {
    if (!isoStr) return ''
    const date = new Date(isoStr)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getDateGroupHeader = (isoStr) => {
    if (!isoStr) return 'OTHER'
    const today = new Date()
    const date = new Date(isoStr)

    const isToday = today.toDateString() === date.toDateString()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const isYesterday = yesterday.toDateString() === date.toDateString()

    if (isToday) return 'TODAY'
    if (isYesterday) return 'YESTERDAY'

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  }

  // Group logs into Day-by-Day clusters
  const groupedLogs = logs.reduce((acc, log) => {
    const header = getDateGroupHeader(log.timestamp)
    if (!acc[header]) acc[header] = []
    acc[header].push(log)
    return acc
  }, {})

  const toggleExpand = (logId) => {
    setExpandedLogId(prev => (prev === logId ? null : logId))
  }

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      draggable={false}
      resizable={false}
      header={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-sm uppercase shrink-0">
            {userObj?.userName ? userObj.userName.charAt(0) : 'U'}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 leading-tight">
              {userObj?.userName || 'User Activity Trail'}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{userObj?.userEmail || 'No Email'}</span>
              {userObj?.userPhone && (
                <>
                  <span>•</span>
                  <span>{userObj.userPhone}</span>
                </>
              )}
              {userObj?.userRole && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 ml-1">
                  {userObj.userRole === 'employee' ? 'USER' : userObj.userRole.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      }
      style={{ width: '92vw', maxWidth: '750px' }}
      modal
      className="p-dialog-custom rounded-2xl"
    >
      <div className="py-2 space-y-4">
        {/* Top Controls: Date Picker Range & Category Selector Dropdown inside Modal */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* DatePicker Range Inputs */}
            <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                <i className="pi pi-calendar text-blue-600" />
                Date Range:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-medium bg-white text-slate-700 focus:border-blue-600 shadow-2xs cursor-pointer"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-medium bg-white text-slate-700 focus:border-blue-600 shadow-2xs cursor-pointer"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer ml-1"
                >
                  Clear Dates
                </button>
              )}
            </div>

            {/* Category Dropdown Filter inside Modal */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-slate-200 hover:border-slate-350 focus:border-blue-600 px-3 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-white shadow-2xs cursor-pointer min-w-[140px]"
              >
                <option value="all">⚡ All Categories</option>
                <option value="Security">Security</option>
                <option value="Gateway">Gateway</option>
                <option value="Company">Company</option>
                <option value="User">User</option>
              </select>

              <div className="text-[11px] font-bold text-slate-600 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {totalCount} Activities
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Container with Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="min-h-[300px] max-h-[60vh] overflow-y-auto px-2 pr-3 scrollbar-thin space-y-6"
        >
          {loading ? (
            <div className="py-16 text-center">
              <LoadingSpinner />
              <p className="text-xs text-slate-400 font-semibold mt-3">Loading Activity Timeline...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center select-none flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <i className="pi pi-history text-xl" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No Recorded Activities</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                There are no logged audit trails for this user matching your date and category filters.
              </p>
            </div>
          ) : (
            Object.keys(groupedLogs).map((groupHeader) => (
              <div key={groupHeader} className="space-y-3">
                {/* Day-by-Day Sticky Header */}
                <div className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur-xs border-y border-slate-200/80 py-1 px-3 rounded-lg flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <i className="pi pi-calendar text-blue-600 text-[10px]" />
                    {groupHeader}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {groupedLogs[groupHeader].length} events
                  </span>
                </div>

                {/* Timeline Items under this Date Cluster */}
                <div className="relative pl-6 border-l-2 border-slate-200 ml-3 space-y-4">
                  {groupedLogs[groupHeader].map((log, idx) => {
                    const badge = getCategoryBadgeClass(log.category)
                    const impact = getImpactBadge(log.action)
                    const isExpanded = expandedLogId === log._id
                    const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0

                    return (
                      <div key={log._id || idx} className="relative group">
                        {/* Timeline Category Icon Dot */}
                        <div className={`absolute -left-[31px] top-1.5 w-6 h-6 rounded-full ${badge.bg} border ${badge.border} flex items-center justify-center text-[10px] shadow-2xs`}>
                          <i className={badge.icon} />
                        </div>

                        {/* Activity Card */}
                        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 hover:border-slate-300 transition-all shadow-2xs">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs text-slate-800 tracking-tight">
                                  {log.action}
                                </span>
                                
                                {/* Impact Rating Badge */}
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 ${impact.bg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${impact.dot}`} />
                                  {impact.label}
                                </span>

                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border}`}>
                                  {log.category}
                                </span>

                                {log.companyName && (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    🏢 {log.companyName}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-600 mt-1.5 font-medium leading-relaxed">
                                {log.details || 'No action summary provided'}
                              </p>
                            </div>

                            {/* Relative Time Badge + Exact Tooltip on Hover */}
                            <div className="text-right shrink-0" title={formatExactTimestamp(log.timestamp)}>
                              <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                                ⏱️ {getRelativeTime(log.timestamp)}
                              </span>
                              <span className="text-[9px] font-mono font-medium text-slate-400 block mt-1">
                                {formatTimeOnly(log.timestamp)}
                              </span>
                            </div>
                          </div>

                          {/* Metadata Toggle */}
                          {hasMetadata && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => toggleExpand(log._id)}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
                              >
                                <i className={`pi ${isExpanded ? 'pi-chevron-up' : 'pi-chevron-down'} text-[9px]`} />
                                <span>{isExpanded ? 'Hide Raw Details' : 'View Raw Details'}</span>
                              </button>

                              {isExpanded && (
                                <pre className="mt-2 p-2.5 bg-slate-900 text-emerald-400 text-[10px] font-mono rounded-lg overflow-x-auto max-h-40 border border-slate-800 leading-tight">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}

          {/* Infinite Scroll Bottom Loader */}
          {loadingMore && (
            <div className="py-4 text-center">
              <LoadingSpinner />
              <p className="text-[11px] text-slate-400 font-semibold mt-1">Loading older activities...</p>
            </div>
          )}

          {!hasMore && logs.length > 0 && (
            <div className="py-3 text-center text-[11px] font-semibold text-slate-400 border-t border-slate-100">
              End of activity history
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
