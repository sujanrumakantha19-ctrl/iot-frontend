export default function TableToolbar({ search, onSearchChange, searchPlaceholder = 'Search...', children }) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
      {onSearchChange ? (
        <div className="relative w-full max-w-xs">
          <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            value={search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-white placeholder-slate-400 text-slate-700 transition-all shadow-sm"
          />
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
