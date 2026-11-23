import { useState, useEffect, useRef } from 'react'
import api from '../../services/axios'
import { getMe, getSession } from '../../services/auth'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

export default function ProfileSettingsTab() {
  const session = getSession()
  const isEmployee = session?.role === 'employee'

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  // Profile Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [addressLabel, setAddressLabel] = useState('')
  const [address, setAddress] = useState('')
  const [profilePhoto, setProfilePhoto] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const fileInputRef = useRef(null)

  // Password Reset Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const loadProfile = async () => {
    try {
      setLoading(true)
      const res = await getMe()
      if (res.user) {
        setUser(res.user)
        setName(res.user.name || '')
        setEmail(res.user.email || '')
        setAddressLabel(res.user.addressLabel || '')
        setAddress(res.user.address || '')
        setProfilePhoto(res.user.profilePhoto || '')
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load user profile' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  // Handle Photo Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      showToast({ severity: 'error', summary: 'File Too Large', detail: 'Profile picture must be less than 1MB.' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setProfilePhoto(reader.result)
      showToast({ severity: 'info', summary: 'Photo Selected', detail: 'Click "Save Profile" to update your photo.' })
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setProfilePhoto('')
  }

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name || !email) {
      showToast({ severity: 'warn', summary: 'Validation Error', detail: 'Name and Email are required.' })
      return
    }

    try {
      setSavingProfile(true)
      const payload = {
        name,
        email,
        profilePhoto,
        ...(!isEmployee ? { addressLabel, address } : {})
      }
      const res = await api.put('/auth/profile', payload)
      if (res.data?.user) {
        setUser(res.data.user)
        const sess = getSession()
        if (sess) {
          sess.name = res.data.user.name
          sess.email = res.data.user.email
          sess.profilePhoto = res.data.user.profilePhoto || ''
          localStorage.setItem('iot_session', JSON.stringify(sess))
        }
        window.dispatchEvent(new CustomEvent('iot_user_updated', { detail: res.data.user }))
        window.dispatchEvent(new Event('user_profile_updated'))
      }
      showToast({ severity: 'success', summary: 'Saved', detail: 'Profile updated successfully!' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save Failed', detail: err.response?.data?.message || err.message })
    } finally {
      setSavingProfile(false)
    }
  }

  // Handle Password Reset
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast({ severity: 'warn', summary: 'Validation Error', detail: 'All password fields are required.' })
      return
    }
    if (newPassword !== confirmPassword) {
      showToast({ severity: 'warn', summary: 'Validation Error', detail: 'New password and Confirm password do not match.' })
      return
    }
    if (newPassword.length < 6) {
      showToast({ severity: 'warn', summary: 'Validation Error', detail: 'New password must be at least 6 characters long.' })
      return
    }

    try {
      setChangingPassword(true)
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      })
      showToast({ severity: 'success', summary: 'Password Changed', detail: res.data?.message || 'Password updated successfully!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast({ severity: 'error', summary: 'Password Update Failed', detail: err.response?.data?.message || err.message })
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) return <LoadingSpinner text="Retrieving profile & settings..." />

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : (name ? name.substring(0, 2).toUpperCase() : 'US')

  return (
    <div className="space-y-6">
      {/* User Details & Photo Form */}
      <form
        onSubmit={handleSaveProfile}
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderColor: 'var(--border-color, #e2e8f0)',
          color: 'var(--text-primary, #1e293b)'
        }}
        className="border p-6 space-y-6 shadow-sm rounded-xl"
      >
        <div className="border-b pb-4" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <i className="pi pi-user text-blue-500" />
            Personal Profile Information
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Manage your photo, display name, and contact information.
          </p>
        </div>

        {/* Avatar & Photo Upload Section */}
        <div className="flex items-center gap-6 pb-2">
          <div className="relative group shrink-0">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 shadow-md"
                style={{ borderColor: 'var(--accent-primary, #2563eb)' }}
              />
            ) : (
              <div
                style={{ backgroundColor: 'var(--accent-primary, #2563eb)' }}
                className="w-20 h-20 rounded-full text-white flex items-center justify-center font-extrabold text-2xl shadow-md border-2 border-white"
              >
                {initials}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  backgroundColor: 'var(--bg-hover, #f1f5f9)',
                  borderColor: 'var(--border-color, #cbd5e1)',
                  color: 'var(--text-primary, #1e293b)'
                }}
                className="px-3.5 py-1.5 border text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <i className="pi pi-upload text-xs" />
                Upload Photo
              </button>
              {profilePhoto && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              JPG, PNG or GIF. Maximum file size 1MB.
            </p>
          </div>
        </div>

        {/* Profile Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              style={{
                backgroundColor: 'var(--bg-app, #f8fafc)',
                borderColor: 'var(--border-color, #e2e8f0)',
                color: 'var(--text-primary, #1e293b)'
              }}
              className="w-full h-9 px-3 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@company.com"
              style={{
                backgroundColor: 'var(--bg-app, #f8fafc)',
                borderColor: 'var(--border-color, #e2e8f0)',
                color: 'var(--text-primary, #1e293b)'
              }}
              className="w-full h-9 px-3 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {/* Show Address Label & Address for Manager & Admin */}
          {!isEmployee && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
                  Address Label
                </label>
                <input
                  type="text"
                  value={addressLabel}
                  onChange={(e) => setAddressLabel(e.target.value)}
                  placeholder="e.g. Headquarters / Plant 1"
                  style={{
                    backgroundColor: 'var(--bg-app, #f8fafc)',
                    borderColor: 'var(--border-color, #e2e8f0)',
                    color: 'var(--text-primary, #1e293b)'
                  }}
                  className="w-full h-9 px-3 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
                  Full Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Physical location or facility address"
                  style={{
                    backgroundColor: 'var(--bg-app, #f8fafc)',
                    borderColor: 'var(--border-color, #e2e8f0)',
                    color: 'var(--text-primary, #1e293b)'
                  }}
                  className="w-full h-9 px-3 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
          <button
            type="submit"
            disabled={savingProfile}
            style={{
              backgroundColor: 'var(--accent-primary, #2563eb)',
              color: '#ffffff'
            }}
            className="px-6 py-2.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90 shadow-sm rounded-lg disabled:opacity-50"
          >
            {savingProfile ? <i className="pi pi-spin pi-spinner text-xs" /> : <i className="pi pi-check text-xs" />}
            {savingProfile ? 'Saving Profile...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Password Reset Form */}
      <form
        onSubmit={handleChangePassword}
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderColor: 'var(--border-color, #e2e8f0)',
          color: 'var(--text-primary, #1e293b)'
        }}
        className="border p-6 space-y-5 shadow-sm rounded-xl"
      >
        <div className="border-b pb-4" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <i className="pi pi-lock text-purple-500" />
            Security &amp; Password Reset
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Update your account login password securely.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
              Current Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{
                backgroundColor: 'var(--bg-app, #f8fafc)',
                borderColor: 'var(--border-color, #e2e8f0)',
                color: 'var(--text-primary, #1e293b)'
              }}
              className="w-full h-9 px-3 text-xs font-semibold font-mono rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
              New Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              style={{
                backgroundColor: 'var(--bg-app, #f8fafc)',
                borderColor: 'var(--border-color, #e2e8f0)',
                color: 'var(--text-primary, #1e293b)'
              }}
              className="w-full h-9 px-3 text-xs font-semibold font-mono rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              style={{
                backgroundColor: 'var(--bg-app, #f8fafc)',
                borderColor: 'var(--border-color, #e2e8f0)',
                color: 'var(--text-primary, #1e293b)'
              }}
              className="w-full h-9 px-3 text-xs font-semibold font-mono rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
          <button
            type="submit"
            disabled={changingPassword}
            style={{
              backgroundColor: 'var(--accent-primary, #9333ea)',
              color: '#ffffff'
            }}
            className="px-6 py-2.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90 shadow-sm rounded-lg disabled:opacity-50"
          >
            {changingPassword ? <i className="pi pi-spin pi-spinner text-xs" /> : <i className="pi pi-key text-xs" />}
            {changingPassword ? 'Updating Password...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
