import React from 'react'

export default function StatCard({ label, value, icon, color = 'blue' }) {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50 border border-blue-100 text-blue-600',
      circle: 'bg-blue-500/[0.07] border border-blue-500/[0.14]'
    },
    purple: {
      bg: 'bg-pink-50 border border-pink-100 text-pink-600',
      circle: 'bg-pink-500/[0.07] border border-pink-500/[0.14]'
    },
    green: {
      bg: 'bg-emerald-50 border border-emerald-100 text-emerald-600',
      circle: 'bg-emerald-500/[0.07] border border-emerald-500/[0.14]'
    },
    amber: {
      bg: 'bg-amber-50 border border-amber-100 text-amber-600',
      circle: 'bg-amber-500/[0.07] border border-amber-500/[0.14]'
    },
    red: {
      bg: 'bg-red-50 border border-red-100 text-red-600',
      circle: 'bg-red-500/[0.07] border border-red-500/[0.14]'
    },
    indigo: {
      bg: 'bg-indigo-50 border border-indigo-100 text-indigo-600',
      circle: 'bg-indigo-500/[0.07] border border-indigo-500/[0.14]'
    },
  }

  const theme = colorMap[color] || colorMap.blue

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between min-h-[145px]">
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xl font-bold text-slate-800 mt-1 font-sans">{value}</span>
      </div>
    </div>
  )
}
