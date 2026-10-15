import { useState, useEffect } from 'react'

export function useChartTheme() {
  const [themeClass, setThemeClass] = useState(() => document.body.className || 'theme-default')

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeClass(document.body.className || 'theme-default')
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const isDark = Boolean(
    themeClass &&
    !themeClass.includes('theme-default') &&
    !themeClass.includes('theme-aquabreeze') &&
    !themeClass.includes('theme-lavender') &&
    !themeClass.includes('theme-solarsand') &&
    !themeClass.includes('theme-nordicsnow')
  )

  return {
    isDark,
    themeClass,
    textColor: '#94a3b8',
    primaryTextColor: isDark ? '#f8fafc' : '#0f172a',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    axisLineColor: 'rgba(255, 255, 255, 0.08)',
    offlineRingColor: isDark ? '#334155' : '#e2e8f0',
    legendTextColor: isDark ? '#cbd5e1' : '#94a3b8',
    tooltipBg: 'rgba(15, 23, 42, 0.95)',
    tooltipBorder: '#334155',
    tooltipText: '#f8fafc',
    lineColor: isDark ? '#3b82f6' : '#2563eb',
    areaTop: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37, 99, 235, 0.18)',
    areaBottom: isDark ? 'rgba(59, 130, 246, 0.02)' : 'rgba(37, 99, 235, 0.01)'
  }
}
