import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { showToast } from '../../utils/toast'
import api from '../../services/axios'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

export default function UserDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [companyGateways, setCompanyGateways] = useState([])
  const [companyTags, setCompanyTags] = useState([])
  const [selectedGateways, setSelectedGateways] = useState([])
  const [selectedTags, setSelectedTags] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadUser = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/admin/users/${userId}`)
      const userData = res.data.user
      setUser(userData)

      // Set initial selections
      setSelectedGateways(userData.assignedGatewayIds?.map(g => g._id || g) || [])
      setSelectedTags(userData.assignedTagIds?.map(t => t._id || t) || [])

      // Load gateways & tags for the user's company
      const compId = userData.companyId?._id || userData.companyId
      if (compId) {
        const [compDetailRes, tagRes] = await Promise.all([
          api.get(`/admin/companies/${compId}/detail`),
          api.get('/admin/telemetry-tags')
        ])

        setCompanyGateways(compDetailRes.data.gateways || [])
        
        const allTags = tagRes.data.tags || []
        const filteredTags = allTags.filter(t => {
          const tcId = t.companyId?._id || t.companyId
          return tcId === compId
        })
        setCompanyTags(filteredTags)
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load user details' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  }, [userId])

  const handleSaveAssignments = async () => {
    try {
      setSaving(true)
      await api.put(`/admin/employees/${userId}`, {
        assignedGatewayIds: selectedGateways,
        assignedTagIds: selectedTags
      })
      showToast({ severity: 'success', summary: 'Saved', detail: 'Assignments updated successfully' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save Failed', detail: err.message })
    } finally {
      setSaving(false)
    }
  }

  const toggleGateway = (gwId) => {
    setSelectedGateways(prev =>
      prev.includes(gwId) ? prev.filter(id => id !== gwId) : [...prev, gwId]
    )
  }

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  if (loading) return <LoadingSpinner text="Retrieving profile folder..." />
  if (!user) return <div className="p-6 text-center text-slate-500">User not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
        >
          <i className="pi pi-arrow-left text-slate-600 text-xs" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{user.name}</h2>
          <p className="text-xs text-slate-400 capitalize">{user.role} profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div
          style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
          className="border p-5 space-y-4 rounded-xl"
        >
          <h3 className="text-xs font-bold uppercase tracking-widest border-b pb-2" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
            User details
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="block" style={{ color: 'var(--text-secondary)' }}>Name</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
            </div>
            
            <div>
              <span className="block" style={{ color: 'var(--text-secondary)' }}>Email Address</span>
              <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{user.email}</span>
            </div>

            <div>
              <span className="block" style={{ color: 'var(--text-secondary)' }}>Role</span>
              <span className={`inline-block px-2 py-0.5 mt-0.5 text-[10px] font-bold uppercase tracking-wider ${
                user.role === 'manager' ? 'bg-pink-500/10 text-pink-500 border border-pink-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              }`}>
                {user.role}
              </span>
            </div>

            <div>
              <span className="block" style={{ color: 'var(--text-secondary)' }}>Status</span>
              <span className={`inline-block px-2 py-0.5 mt-0.5 text-[10px] font-bold uppercase tracking-wider ${
                user.active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              }`}>
                {user.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div>
              <span className="block" style={{ color: 'var(--text-secondary)' }}>Company Space</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.companyId?.name || 'Unassigned'}</span>
            </div>

            {user.role === 'employee' && (
              <div>
                <span className="block" style={{ color: 'var(--text-secondary)' }}>Reporting Manager</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.managerId?.name || 'Unassigned'}</span>
              </div>
            )}

            <div>
              <span className="block" style={{ color: 'var(--text-secondary)' }}>Date Created</span>
              <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {new Date(user.createdAt || user._id.getTimestamp?.() || Date.now()).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Assignments Panel (Only for Employees) */}
        {user.role === 'employee' ? (
          <div
            style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
            className="border p-5 lg:col-span-2 flex flex-col justify-between space-y-6 rounded-xl"
          >
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>Assign Access Scopes</span>
                <span className="text-[10px] lowercase font-normal text-slate-400">
                  check items to grant access
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Gateways Checkbox List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <i className="pi pi-sitemap text-blue-500" />
                    Gateways ({companyGateways.length})
                  </h4>
                  <div className="border border-slate-200 max-h-[250px] overflow-y-auto divide-y divide-slate-100">
                    {companyGateways.length === 0 ? (
                      <p className="p-3 text-xs text-slate-400 italic">No gateways registered in company.</p>
                    ) : (
                      companyGateways.map(g => {
                        const isChecked = selectedGateways.includes(g._id)
                        return (
                          <label key={g._id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer select-none text-xs">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleGateway(g._id)}
                              className="w-4 h-4 border-slate-350 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="font-semibold text-slate-700">{g.name}</p>
                              <p className="text-[10px] text-slate-450 font-mono">{g.prefix}</p>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Telemetry Tags Checkbox List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <i className="pi pi-tag text-emerald-500" />
                    Telemetry Topics ({companyTags.length})
                  </h4>
                  <div className="border border-slate-200 max-h-[250px] overflow-y-auto divide-y divide-slate-100">
                    {companyTags.length === 0 ? (
                      <p className="p-3 text-xs text-slate-400 italic">No telemetry tags registered in company.</p>
                    ) : (
                      companyTags.map(t => {
                        const isChecked = selectedTags.includes(t._id)
                        return (
                          <label key={t._id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer select-none text-xs">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTag(t._id)}
                              className="w-4 h-4 border-slate-350 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="font-semibold text-slate-700">{t.topicName}</p>
                              <p className="text-[10px] text-slate-450 font-mono">
                                {t.deviceName} ({t.parameterName})
                              </p>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={handleSaveAssignments}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-5 cursor-pointer disabled:opacity-50 transition-all shadow-none"
              >
                {saving ? 'Saving...' : 'Save Assignments'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 p-5 lg:col-span-2 flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-2 max-w-sm">
              <i className="pi pi-shield text-slate-300 text-3xl" />
              <h4 className="text-sm font-bold text-slate-700">Manager Account Access Control</h4>
              <p className="text-xs text-slate-450">
                Managers automatically oversee all gateways and tags under their company space. Explicit allocation of scopes is restricted to employee profiles.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
