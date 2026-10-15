import React from 'react'

export default function EmptyState({
  message = "No records found.",
  description = "Please add new entries or adjust search parameters.",
  icon = "pi-inbox"
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3.5 my-2">
      <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
        <i className={`pi ${icon} text-lg`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{message}</p>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>
    </div>
  )
}
