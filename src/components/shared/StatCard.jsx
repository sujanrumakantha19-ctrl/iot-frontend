import React from 'react'

export default function StatCard({ label, value, icon, color = 'blue' }) {
  const colorMap = {
    blue: {
      bg: 'bg-blue-500/10 border border-blue-500/20 text-blue-500',
      circle: 'bg-blue-500/[0.07] border border-blue-500/[0.14]'
    },
    purple: {
      bg: 'bg-pink-500/10 border border-pink-500/20 text-pink-500',
      circle: 'bg-pink-500/[0.07] border border-pink-500/[0.14]'
    },
    green: {
      bg: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500',
      circle: 'bg-emerald-500/[0.07] border border-emerald-500/[0.14]'
    },
    amber: {
      bg: 'bg-amber-500/10 border border-amber-500/20 text-amber-500',
      circle: 'bg-amber-500/[0.07] border border-amber-500/[0.14]'
    },
    red: {
      bg: 'bg-red-500/10 border border-red-500/20 text-red-500',
      circle: 'bg-red-500/[0.07] border border-red-500/[0.14]'
    },
    indigo: {
      bg: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-500',
      circle: 'bg-indigo-500/[0.07] border border-indigo-500/[0.14]'
    },
  }

  const theme = colorMap[color] || colorMap.blue

  return (
    <div
      style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
      className="rounded-xl border p-5 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between min-h-[145px]"
    >
      {/* Top right decorative half circle */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${theme.circle} pointer-events-none`} />

      {/* Top row */}
      <div className="flex items-center justify-between z-10">
        <div className={`w-12 h-12 rounded-xl ${theme.bg} flex items-center justify-center shrink-0`}>
          <i className={`${icon} text-lg`} />
        </div>
      </div>

      {/* Bottom text info */}
      <div className="flex flex-col mt-4 z-10">
        <span style={{ color: 'var(--text-secondary, #94a3b8)' }} className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <span style={{ color: 'var(--text-primary, #1e293b)' }} className="text-xl font-bold mt-1 font-sans">{value}</span>
      </div>
    </div>
  )
}
