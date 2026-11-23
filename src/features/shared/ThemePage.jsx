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
      cardBg: '#ffffff',
      cardBorder: '#e2e8f0',
      titleColor: '#0f172a',
      descColor: '#64748b',
      dot1: '#f8fafc',
      dot2: '#cbd5e1',
      accent: '#1e3a8a'
    },
    {
      id: 'midnight',
      name: 'Midnight Dark',
      description: 'Deep royal space-slate UI',
      cardBg: '#0f172a',
      cardBorder: '#1e293b',
      titleColor: '#ffffff',
      descColor: '#94a3b8',
      dot1: '#090d16',
      dot2: '#3b82f6',
      accent: '#3b82f6'
    },
    {
      id: 'forest',
      name: 'Forest Emerald',
      description: 'Eco-industrial dark green UI',
      cardBg: '#081a14',
      cardBorder: '#0f3025',
      titleColor: '#ffffff',
      descColor: '#6ee7b7',
      dot1: '#030d0a',
      dot2: '#10b981',
      accent: '#10b981'
    },
    {
      id: 'oceanic',
      name: 'Oceanic Abyss',
      description: 'Clinical deep teal marine UI',
      cardBg: '#05161e',
      cardBorder: '#0a2e3d',
      titleColor: '#ffffff',
      descColor: '#67e8f9',
      dot1: '#020d12',
      dot2: '#06b6d4',
      accent: '#06b6d4'
    },
    {
      id: 'sunset',
      name: 'Sunset Velvet',
      description: 'Rich dark violet evening UI',
      cardBg: '#14081c',
      cardBorder: '#2b113c',
      titleColor: '#ffffff',
      descColor: '#d8b4fe',
      dot1: '#0a040d',
      dot2: '#c084fc',
      accent: '#c084fc'
    },
    {
      id: 'cyberpunk',
      name: 'Cyberpunk Neon',
      description: 'High-contrast charcoal & gold UI',
      cardBg: '#181818',
      cardBorder: '#2e2e2e',
      titleColor: '#ffffff',
      descColor: '#fde68a',
      dot1: '#0d0d0d',
      dot2: '#fbbf24',
      accent: '#fbbf24'
    },
    {
      id: 'aquabreeze',
      name: 'Aqua Breeze',
      description: 'Vibrant light cyan & mint UI',
      cardBg: '#ecfeff',
      cardBorder: '#cffafe',
      titleColor: '#083344',
      descColor: '#0e7490',
      dot1: '#cffafe',
      dot2: '#0891b2',
      accent: '#0891b2'
    },
    {
      id: 'lavender',
      name: 'Lavender Blush',
      description: 'Soft light lavender & indigo UI',
      cardBg: '#faf5ff',
      cardBorder: '#f3e8ff',
      titleColor: '#3b0764',
      descColor: '#7e22ce',
      dot1: '#f3e8ff',
      dot2: '#7c3aed',
      accent: '#7c3aed'
    },
    {
      id: 'solarsand',
      name: 'Solar Sand',
      description: 'Warm low-strain day-sand UI',
      cardBg: '#fefaf0',
      cardBorder: '#f7e8cf',
      titleColor: '#451a03',
      descColor: '#b45309',
      dot1: '#f7e8cf',
      dot2: '#d97706',
      accent: '#d97706'
    },
    {
      id: 'nordicsnow',
      name: 'Nordic Snow',
      description: 'Crisp glacial sky-blue light UI',
      cardBg: '#f0f9ff',
      cardBorder: '#e0f2fe',
      titleColor: '#0c4a6e',
      descColor: '#0284c7',
      dot1: '#e0f2fe',
      dot2: '#0284c7',
      accent: '#0284c7'
    },
    {
      id: 'crimson',
      name: 'Crimson Rust',
      description: 'Industrial dark burgundy UI',
      cardBg: '#1c0c0e',
      cardBorder: '#381418',
      titleColor: '#ffffff',
      descColor: '#fca5a5',
      dot1: '#381418',
      dot2: '#dc2626',
      accent: '#dc2626'
    },
    {
      id: 'monochrome',
      name: 'Monochrome Slate',
      description: 'Pure high-contrast dark gray UI',
      cardBg: '#1a1a1a',
      cardBorder: '#2e2e2e',
      titleColor: '#ffffff',
      descColor: '#d4d4d4',
      dot1: '#2e2e2e',
      dot2: '#f5f5f5',
      accent: '#f5f5f5'
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
              style={{
                '--swatch-bg': t.cardBg,
                '--swatch-border': isSelected ? t.accent : t.cardBorder,
                '--swatch-title': t.titleColor,
                '--swatch-desc': t.descColor,
                backgroundColor: t.cardBg,
                borderColor: isSelected ? t.accent : t.cardBorder,
                boxShadow: isSelected ? `0 0 0 2px ${t.accent}` : undefined,
                color: t.titleColor
              }}
              className={`theme-preview-card relative flex flex-col justify-between p-5 border transition-all cursor-pointer select-none rounded-none h-32 hover:opacity-95 ${
                isSelected ? 'scale-[1.01]' : 'hover:shadow-sm'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className="theme-preview-title text-xs font-bold uppercase tracking-wider"
                    style={{ color: t.titleColor }}
                  >
                    {t.name}
                  </span>
                  {isSelected && (
                    <i className="pi pi-check-circle text-sm" style={{ color: t.accent }} />
                  )}
                </div>
                <p
                  className="theme-preview-desc text-[10px] leading-snug"
                  style={{ color: t.descColor }}
                >
                  {t.description}
                </p>
              </div>

              {/* Color Dots Palette Preview */}
              <div className="flex gap-1.5 mt-2">
                <span
                  className="theme-preview-dot w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                  style={{ '--dot-bg': t.dot1, backgroundColor: t.dot1 }}
                />
                <span
                  className="theme-preview-dot w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                  style={{ '--dot-bg': t.dot2, backgroundColor: t.dot2 }}
                />
                <span
                  className="theme-preview-dot w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                  style={{ '--dot-bg': t.accent, backgroundColor: t.accent }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
