import { useSearchParams } from 'react-router-dom'
import ProfileSettingsTab from './ProfileSettingsTab'
import ThemePage from './ThemePage'

export default function UserSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'profile'

  const handleDownloadApk = () => {
    window.open('https://drive.google.com/file/d/1IwEXEnPUbSgb-BAUjaUjxB9cw-ta_z3p/view?usp=sharing', '_blank')
  }

  const handleDownloadWindows = () => {
    window.open('https://drive.google.com/file/d/1iCJN5OcuIK6fIh4tVhEEzxdYgPH60abf/view?usp=sharing', '_blank')
  }

  return (
    <div className="w-full space-y-6 pb-10">
      {/* Header & Tabs */}
      <div className="space-y-4 pb-2">
        <div>
          <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <i className="pi pi-cog text-xl" style={{ color: 'var(--accent-primary)' }} />
            Account &amp; System Settings
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Customize your personal profile, security credentials, visual theme, and download companion apps.
          </p>
        </div>

        {/* Tabs Bar */}
        <div className="flex gap-2 pt-2 border-b" style={{ borderColor: 'var(--border-color, rgba(226, 232, 240, 0.8))' }}>
          {[
            { id: 'profile', label: 'Profile Settings', icon: 'pi-user' },
            { id: 'theme', label: 'Theme Customizer', icon: 'pi-palette' },
            { id: 'downloads', label: 'Apps & Downloads', icon: 'pi-mobile' }
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setSearchParams({ tab: tab.id })
                }}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 cursor-pointer transition-all -mb-[1px]"
                style={{
                  borderColor: isActive ? 'var(--accent-primary, #2563eb)' : 'transparent',
                  color: isActive ? 'var(--accent-primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                  background: isActive ? 'var(--bg-hover, rgba(0,0,0,0.03))' : 'transparent',
                }}
              >
                <i className={`pi ${tab.icon} text-xs`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* TAB 1: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <ProfileSettingsTab />
      )}

      {/* TAB 2: THEME CUSTOMIZER */}
      {activeTab === 'theme' && (
        <ThemePage />
      )}

      {/* TAB 3: APPS & DOWNLOADS */}
      {activeTab === 'downloads' && (
        <div
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderColor: 'var(--border-color, #e2e8f0)',
            color: 'var(--text-primary, #1e293b)'
          }}
          className="border p-6 space-y-6 shadow-sm rounded-xl"
        >
          <div className="border-b pb-4" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <i className="pi pi-mobile text-emerald-500 text-base" />
              Sarayu IIOT Mobile &amp; Desktop Applications
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Download native application builds for Android mobile devices and Windows desktop workstations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Android APK Download Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-hover, #f8fafc)',
                borderColor: 'var(--border-color, #e2e8f0)'
              }}
              className="border rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-3">
                <div
                  style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
                  className="w-12 h-12 rounded-xl border text-emerald-500 flex items-center justify-center text-2xl font-bold"
                >
                  <i className="pi pi-android" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    Android Mobile Application (APK)
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Install the native Sarayu IIOT APK on your Android smartphone or tablet to monitor live telemetry sensors on the go with push alerts.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadApk}
                  style={{
                    backgroundColor: 'var(--accent-primary, #059669)',
                    color: '#ffffff'
                  }}
                  className="w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90 shadow-sm"
                >
                  <i className="pi pi-download text-xs" />
                  <span>Download APK</span>
                </button>
              </div>
            </div>

            {/* Windows Desktop App Download Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-hover, #f8fafc)',
                borderColor: 'var(--border-color, #e2e8f0)'
              }}
              className="border rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-3">
                <div
                  style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
                  className="w-12 h-12 rounded-xl border text-blue-500 flex items-center justify-center text-2xl font-bold"
                >
                  <i className="pi pi-desktop" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    Windows Desktop Application
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Download and install the dedicated Sarayu IIOT Windows workstation application for continuous desktop telemetry monitoring and exports.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadWindows}
                  style={{
                    backgroundColor: 'var(--accent-primary, #2563eb)',
                    color: '#ffffff'
                  }}
                  className="w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90 shadow-sm"
                >
                  <i className="pi pi-download text-xs" />
                  <span>Download for Windows</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
