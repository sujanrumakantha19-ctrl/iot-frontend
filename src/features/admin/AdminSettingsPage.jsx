import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/axios'
import { showToast } from '../../utils/toast'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import ThemePage from '../shared/ThemePage'
import BackupPage from './BackupPage'

export default function AdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'email'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [host, setHost] = useState('smtp.gmail.com')
  const [port, setPort] = useState(587)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [secure, setSecure] = useState(false)
  const [fromEmail, setFromEmail] = useState('')
  const [enableAlerts, setEnableAlerts] = useState(true)

  const [showTestModal, setShowTestModal] = useState(false)
  const [testEmailInput, setTestEmailInput] = useState('')
  const [testResult, setTestResult] = useState(null)

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingAlertsState, setPendingAlertsState] = useState(null)

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/settings/smtp')
      if (res.data?.config) {
        const c = res.data.config
        setHost(c.host || 'smtp.gmail.com')
        setPort(c.port || 587)
        setUser(c.user || '')
        setPass(c.pass || '')
        setSecure(c.secure || false)
        setFromEmail(c.fromEmail || c.user || '')
        setEnableAlerts(c.enableAlerts !== false)
        setTestEmailInput(c.user || '')
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load SMTP settings' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!host || !user) {
      showToast({ severity: 'warn', summary: 'Missing Information', detail: 'SMTP Host and User Email are required.' })
      return
    }

    try {
      setSaving(true)
      const res = await api.put('/admin/settings/smtp', {
        host,
        port: Number(port),
        user,
        pass,
        secure,
        fromEmail: fromEmail || user,
        enableAlerts
      })
      showToast({ severity: 'success', summary: 'Saved', detail: res.data?.message || 'SMTP Settings updated successfully!' })
    } catch (err) {
      showToast({ severity: 'error', summary: 'Save Failed', detail: err.message || 'Failed to save SMTP settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!testEmailInput) {
      showToast({ severity: 'warn', summary: 'Input Required', detail: 'Please enter a target email address for testing.' })
      return
    }

    try {
      setTesting(true)
      setTestResult(null)
      const currentConfig = { host, port: parseInt(port, 10) || 587, user, pass, secure, fromEmail, enableAlerts }
      const res = await api.post('/admin/settings/smtp/test', { targetEmail: testEmailInput, config: currentConfig })
      if (res.data?.success) {
        setTestResult({ success: true, message: res.data.message })
        showToast({ severity: 'success', summary: 'Test Successful', detail: res.data.message })
      } else {
        setTestResult({ success: false, message: res.data?.message || 'SMTP connection failed' })
        showToast({ severity: 'error', summary: 'Test Failed', detail: res.data?.message || 'SMTP connection failed' })
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message })
      showToast({ severity: 'error', summary: 'Test Error', detail: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleTestCriticalAlert = async () => {
    if (!testEmailInput) {
      showToast({ severity: 'warn', summary: 'Input Required', detail: 'Please enter a target email address for testing.' })
      return
    }

    try {
      setTesting(true)
      setTestResult(null)
      const currentConfig = { host, port: parseInt(port, 10) || 587, user, pass, secure, fromEmail, enableAlerts }
      const res = await api.post('/admin/settings/smtp/test-alert', { targetEmail: testEmailInput, severity: 'critical', config: currentConfig })
      if (res.data?.success) {
        setTestResult({ success: true, message: res.data.message })
        showToast({ severity: 'success', summary: 'Critical Alert Sent', detail: res.data.message })
      } else {
        setTestResult({ success: false, message: res.data?.message || 'Failed to dispatch critical alert' })
        showToast({ severity: 'error', summary: 'Alert Failed', detail: res.data?.message || 'Failed to dispatch critical alert' })
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message })
      showToast({ severity: 'error', summary: 'Error', detail: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleToggleAlertsClick = (e) => {
    e.preventDefault()
    const nextState = !enableAlerts
    setPendingAlertsState(nextState)
    setShowConfirmModal(true)
  }

  const confirmToggleAlerts = () => {
    if (pendingAlertsState !== null) {
      setEnableAlerts(pendingAlertsState)
    }
    setShowConfirmModal(false)
    setPendingAlertsState(null)
  }

  return (
    <div className="w-full space-y-6 pb-10">
      {/* Header & Tabs Navigation Banner */}
      <div className="space-y-4 pb-2">
        <div>
          <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <i className="pi pi-cog text-xl" style={{ color: 'var(--accent-primary)' }} />
            System &amp; Admin Settings
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage email servers, notification alerts, UI theme preferences, and database backups.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 pt-2 border-b" style={{ borderColor: 'var(--border-color, rgba(226, 232, 240, 0.8))' }}>
          {[
            { id: 'email', label: 'Email Settings', icon: 'pi-envelope' },
            { id: 'theme', label: 'Theme Customizer', icon: 'pi-palette' },
            { id: 'backup', label: 'Database Backup', icon: 'pi-download' }
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

      {/* TAB 1: EMAIL SETTINGS */}
      {activeTab === 'email' && (
        <>
          {loading ? (
            <LoadingSpinner text="Loading email settings..." />
          ) : (
            <form onSubmit={handleSave} className="bg-white border border-slate-200/80 p-6 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <i className="pi pi-envelope text-indigo-500" />
                    SMTP Mail Server Settings
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Configure host credentials to dispatch automated alert emails.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setTestResult(null); setShowTestModal(true) }}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <i className="pi pi-send text-xs" />
                    Test Connection
                  </button>

                  <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                    <span className="text-xs font-bold text-slate-600">Email Alerts</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableAlerts}
                        onChange={handleToggleAlertsClick}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Host */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    SMTP Host Server <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. smtp.gmail.com"
                    className="w-full h-9 px-3 border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs font-semibold text-slate-750 rounded-none bg-slate-50/20"
                    required
                  />
                </div>

                {/* Port */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    SMTP Port <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => {
                      const val = e.target.value
                      setPort(val)
                      if (val === '465') setSecure(true)
                      else if (val === '587' || val === '25') setSecure(false)
                    }}
                    placeholder="587 or 465"
                    className="w-full h-9 px-3 border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs font-semibold text-slate-750 rounded-none bg-slate-50/20 font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block">
                    {port == 465 ? 'Port 465 uses direct SSL/TLS.' : 'Port 587 uses STARTTLS.'}
                  </span>
                </div>

                {/* User Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Sender Email ID / Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="e.g. alerts@company.com"
                    className="w-full h-9 px-3 border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs font-semibold text-slate-750 rounded-none bg-slate-50/20"
                    required
                  />
                </div>

                {/* Passcode */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Passcode / App Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full h-9 px-3 border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-xs font-semibold text-slate-750 rounded-none bg-slate-50/20 font-mono"
                  />
                </div>

                {/* SSL/TLS Checkbox */}
                <div className="flex flex-col justify-end pt-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="secureCheckbox"
                      checked={secure}
                      onChange={(e) => {
                        const chk = e.target.checked
                        setSecure(chk)
                        if (chk && (port === 587 || port === '587')) setPort(465)
                        else if (!chk && (port === 465 || port === '465')) setPort(587)
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 accent-blue-600 cursor-pointer"
                    />
                    <label htmlFor="secureCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Use SSL / TLS (Required for Port 465)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? <i className="pi pi-spin pi-spinner text-xs" /> : <i className="pi pi-check text-xs" />}
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* TAB 2: THEME CUSTOMIZER */}
      {activeTab === 'theme' && (
        <ThemePage />
      )}

      {/* TAB 3: DATABASE BACKUP */}
      {activeTab === 'backup' && (
        <BackupPage />
      )}

      {/* Test Connection Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="pi pi-send text-purple-600" />
                Test SMTP Mail Dispatch
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="w-7 h-7 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter a recipient email address below to send a live test message using the configured SMTP server credentials.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  placeholder="e.g. target@example.com"
                  className="w-full h-9 px-3 border border-slate-200 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 text-xs font-semibold text-slate-750 rounded-none bg-white"
                />
              </div>

              {testResult && (
                <div className={`p-3 border text-xs font-medium ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  <p className="font-bold flex items-center gap-1.5 mb-0.5">
                    <i className={testResult.success ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'} />
                    {testResult.success ? 'Success' : 'Connection Failed'}
                  </p>
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50 flex-wrap">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestCriticalAlert}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Dispatch a sample Critical Alert notification"
                >
                  <i className="pi pi-exclamation-triangle text-xs" />
                  <span>Send Critical Alert</span>
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestConnection}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testing && <i className="pi pi-spin pi-spinner text-xs" />}
                  {testing ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Toggle Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md shadow-xl overflow-hidden">
            <div className={`p-4 border-b flex items-center gap-3 ${pendingAlertsState ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${pendingAlertsState ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                <i className={pendingAlertsState ? 'pi pi-bell' : 'pi pi-bell-slash'} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold">
                  {pendingAlertsState ? 'Enable Global Email Alerts?' : 'Disable Global Email Alerts?'}
                </h3>
                <p className="text-[11px] opacity-80">
                  Confirmation required before modifying system notification state.
                </p>
              </div>
            </div>

            <div className="p-5 text-xs text-slate-600 leading-relaxed space-y-3">
              {pendingAlertsState ? (
                <p>
                  You are about to <strong className="text-emerald-700 font-bold">ENABLE</strong> system-wide email notifications. Whenever sensor telemetry tags cross configured warning or critical threshold limits, automated HTML email alerts will be dispatched to assigned employees and managers.
                </p>
              ) : (
                <p>
                  You are about to <strong className="text-amber-700 font-bold">DISABLE</strong> system-wide email notifications. Warning and critical threshold breaches will <strong className="underline font-bold">NO LONGER</strong> dispatch email notifications to any managers or employees.
                </p>
              )}
              <p className="text-[11px] text-slate-400 italic">
                Note: Remember to click "Save Settings" at the bottom of the form to persist your changes.
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => { setShowConfirmModal(false); setPendingAlertsState(null) }}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggleAlerts}
                className={`px-4 py-2 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm ${pendingAlertsState ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {pendingAlertsState ? 'Yes, Enable Alerts' : 'Yes, Disable Alerts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
