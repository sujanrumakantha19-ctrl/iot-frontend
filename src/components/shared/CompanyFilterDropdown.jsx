import { useState, useEffect, useRef } from 'react'

export default function CompanyFilterDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find(o => o.value === value)
  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  )

  const handleSearch = (e) => {
    const text = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(text)
    }, 500)
  }

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-slate-200 px-3 py-2 text-sm bg-white cursor-pointer font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-[180px]"
      >
        <span className="flex-1 text-left truncate">
          {selected ? selected.label : 'All Companies'}
        </span>
        <i className={`pi pi-chevron-down text-[10px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 shadow-lg z-50">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              placeholder="Search companies..."
              onChange={handleSearch}
              className="w-full border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">No results found</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value ?? '__all__'}
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors ${
                    value === o.value
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
