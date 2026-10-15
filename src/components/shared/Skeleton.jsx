export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white border border-slate-200/80 p-5 ${className}`}>
      <div className="h-3 w-24 bg-slate-100 rounded animate-pulse mb-4" />
      <div className="space-y-2">
        <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
        <div className="h-2.5 w-32 bg-slate-100 rounded animate-pulse" />
      </div>
    </div>
  )
}

export function SkeletonChart({ className = '' }) {
  return (
    <div className={`bg-white border border-slate-200/80 p-5 flex flex-col ${className}`}>
      <div className="h-3 w-40 bg-slate-100 rounded animate-pulse mb-4" />
      <div className="flex-1 bg-slate-50/50 rounded animate-pulse min-h-0" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200/80 ${className}`}>
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-3/5 bg-slate-100 rounded animate-pulse" />
              <div className="h-2 w-2/5 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
