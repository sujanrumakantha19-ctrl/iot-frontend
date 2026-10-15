import { useState, useEffect } from 'react'
import { showToast } from '../../utils/toast'
import api from '../../services/axios'
import PageHeader from '../../components/shared/PageHeader'
import { getSession, applyTheme } from '../../services/auth'

export default function ThemePage() {
  const session = getSession()
  const [activeTheme, setActiveTheme] = useState(session?.themePreference || 'default')

  useEffect(() => {
    // Fetch latest theme from database
    api.get('/auth/preferences')
      .then(res => {
        if (res.data?.success && res.data?.themePreference) {
          const dbTheme = res.data.themePreference
          setActiveTheme(dbTheme)
          const currentSession = getSession()
          if (currentSession && currentSession.themePreference !== dbTheme) {
            currentSession.themePreference = dbTheme
            localStorage.setItem('iot_session', JSON.stringify(currentSession))
          }
          applyTheme(dbTheme)
        }
      })
      .catch(err => {
        console.debug('Failed to load theme preferences from database:', err.message)
      })
  }, [])

  const themesList = [
    {
      id: 'default',
      name: 'Default Light',
      description: 'Clean cool slate light UI',
      bgClass: 'bg-slate-50 border-slate-200 text-[#1e293b]',
      dotBg1: 'bg-slate-200',
      dotBg2: 'bg-[#1e3a8a]',
      textColor: 'text-[#1e293b]',
      accentColor: 'bg-[#1e3a8a]'
    },
    {
      id: 'midnight',
      name: 'Midnight Dark',
      description: 'Deep royal space-slate UI',
      bgClass: 'bg-[#0f172a] border-[#1e293b] text-white',
      dotBg1: 'bg-[#090d16]',
      dotBg2: 'bg-[#3b82f6]',
      textColor: 'text-white',
      accentColor: 'bg-[#3b82f6]'
    },
    {
      id: 'forest',
      name: 'Forest Emerald',
      description: 'Eco-industrial dark green UI',
      bgClass: 'bg-[#081a14] border-[#0f3025] text-white',
      dotBg1: 'bg-[#030d0a]',
      dotBg2: 'bg-[#10b981]',
      textColor: 'text-white',
      accentColor: 'bg-[#10b981]'
    },
    {
      id: 'oceanic',
      name: 'Oceanic Abyss',
      description: 'Clinical deep teal marine UI',
      bgClass: 'bg-[#05161e] border-[#0a2e3d] text-white',
      dotBg1: 'bg-[#020d12]',
      dotBg2: 'bg-[#06b6d4]',
      textColor: 'text-white',
      accentColor: 'bg-[#06b6d4]'
    },
    {
      id: 'sunset',
      name: 'Sunset Velvet',
      description: 'Rich dark violet evening UI',
      bgClass: 'bg-[#14081c] border-[#2b113c] text-white',
      dotBg1: 'bg-[#0a040d]',
      dotBg2: 'bg-[#c084fc]',
      textColor: 'text-white',
      accentColor: 'bg-[#c084fc]'
    },
    {
      id: 'cyberpunk',
      name: 'Cyberpunk Neon',
      description: 'High-contrast charcoal & gold UI',
      bgClass: 'bg-[#181818] border-[#2e2e2e] text-white',
      dotBg1: 'bg-[#0d0d0d]',
      dotBg2: 'bg-[#fbbf24]',
      textColor: 'text-white',
      accentColor: 'bg-[#fbbf24]'
    },
    {
      id: 'aquabreeze',
      name: 'Aqua Breeze',
      description: 'Vibrant light cyan & mint UI',
      bgClass: 'bg-[#ecfeff] border-[#cffafe] text-[#083344]',
      dotBg1: 'bg-[#cffafe]',
      dotBg2: 'bg-[#0891b2]',
      textColor: 'text-[#083344]',
      accentColor: 'bg-[#0891b2]'
    },
    {
      id: 'lavender',
      name: 'Lavender Blush',
      description: 'Soft light lavender & indigo UI',
      bgClass: 'bg-[#faf5ff] border-[#f3e8ff] text-[#3b0764]',
      dotBg1: 'bg-[#f3e8ff]',
      dotBg2: 'bg-[#7c3aed]',
      textColor: 'text-[#3b0764]',
      accentColor: 'bg-[#7c3aed]'
    },
    {
      id: 'solarsand',
      name: 'Solar Sand',
      description: 'Warm low-strain day-sand UI',
      bgClass: 'bg-[#fefaf0] border-[#f7e8cf] text-[#451a03]',
      dotBg1: 'bg-[#f7e8cf]',
      dotBg2: 'bg-[#d97706]',
      textColor: 'text-[#451a03]',
      accentColor: 'bg-[#d97706]'
    },
    {
      id: 'nordicsnow',
      name: 'Nordic Snow',
      description: 'Crisp glacial sky-blue light UI',
      bgClass: 'bg-[#f0f9ff] border-[#e0f2fe] text-[#0c4a6e]',
      dotBg1: 'bg-[#e0f2fe]',
      dotBg2: 'bg-[#0284c7]',
      textColor: 'text-[#0c4a6e]',
      accentColor: 'bg-[#0284c7]'
    },
    {
      id: 'crimson',
      name: 'Crimson Rust',
      description: 'Industrial dark burgundy UI',
      bgClass: 'bg-[#1c0c0e] border-[#381418] text-white',
      dotBg1: 'bg-[#381418]',
      dotBg2: 'bg-[#dc2626]',
      textColor: 'text-white',
      accentColor: 'bg-[#dc2626]'
    },
    {
      id: 'monochrome',
      name: 'Monochrome Slate',
      description: 'Pure high-contrast dark gray UI',
      bgClass: 'bg-[#1a1a1a] border-[#2e2e2e] text-white',
      dotBg1: 'bg-[#2e2e2e]',
      dotBg2: 'bg-[#f5f5f5]',
      textColor: 'text-white',
      accentColor: 'bg-[#f5f5f5]'
    }
  ]

  const handleSelectTheme = async (themeId) => {
    try {
      setActiveTheme(themeId)
      await api.put('/auth/preferences', { themePreference: themeId })
      
      // Update session in localStorage
      const session = getSession()
      if (session) {
        session.themePreference = themeId
        localStorage.setItem('iot_session', JSON.stringify(session))
      }
      
      // Update body class globally
      applyTheme(themeId)
      
      showToast({ 
        severity: 'success', 
        summary: 'Theme Updated', 
        detail: `Switched to ${themeId} theme successfully.`, 
        life: 2500 
      })
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'Theme Error',
        detail: err.response?.data?.message || err.message || 'Failed to update theme preference'
      })
    }
  }

  return (
    <div className="w-full space-y-6 pt-2">
      <PageHeader 
        title="UI Theme Customization" 
        subtitle="Select your preferred user interface color scheme. This choice applies to all pages." 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {themesList.map((t) => {
          const isSelected = activeTheme === t.id
          return (
            <div
              key={t.id}
              onClick={() => handleSelectTheme(t.id)}
              className={`relative flex flex-col justify-between p-5 border transition-all cursor-pointer select-none rounded-none h-32 ${t.bgClass} ${
                isSelected 
                  ? 'ring-2 ring-blue-600 border-transparent shadow-md scale-[1.01]' 
                  : 'border-slate-200 hover:border-slate-400 hover:shadow-sm'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">{t.name}</span>
                  {isSelected && (
                    <i className="pi pi-check-circle text-blue-600 text-sm" />
                  )}
                </div>
                <p className="text-[10px] opacity-75 leading-snug">{t.description}</p>
              </div>

              {/* Color Dots Palette Preview */}
              <div className="flex gap-1.5 mt-2">
                <span className={`w-3.5 h-3.5 rounded-full ${t.dotBg1} border border-slate-200/20`} />
                <span className={`w-3.5 h-3.5 rounded-full ${t.dotBg2} border border-slate-200/20`} />
                <span className={`w-3.5 h-3.5 rounded-full ${t.accentColor} border border-slate-200/20`} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
