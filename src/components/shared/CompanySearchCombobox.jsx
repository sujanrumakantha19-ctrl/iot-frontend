import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../services/axios'

export default function CompanySearchCombobox({ value, onSelect, onClear }) {
  const [query, setQuery] = useState(value?.name || '')
  const [results, setResults] = useState([])
  const [defaults, setDefaults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(value || null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Load top 4 companies once on mount for default suggestions
  useEffect(() => {
    api.get('/admin/companies')
      .then(res => setDefaults((res.data.companies || []).slice(0, 4)))
      .catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get(`/admin/companies?search=${encodeURIComponent(q)}`)
        setResults(res.data.companies || [])
      } catch (_) {}
      finally { setLoading(false) }
    }, 500)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    // Clear selection if user edits after selecting
    if (selected) {
      setSelected(null)
      onClear?.()
    }
    if (!val.trim()) {
      setResults([])
    } else {
      search(val)
    }
    setOpen(true)
  }

  const handleFocus = () => {
    setOpen(true)
  }

  const handleSelect = (company) => {
    setSelected(company)
    setQuery(company.name)
    setResults([])
    setOpen(false)
    onSelect?.(company)
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    setResults([])
    setOpen(false)
    onClear?.()
    inputRef.current?.focus()
  }

  // What to show in dropdown
  const displayList = query.trim() ? results : defaults

  return (
    <div className="relative" ref={containerRef}>
      {/* Input row */}
      <div className={`flex items-center bg-white border transition-all ${
        open ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-200'
      }`}>
        {loading
          ? <i className="pi pi-spin pi-spinner text-[11px] text-blue-400 ml-3 shrink-0" />
          : <i className="pi pi-search text-[11px] text-slate-400 ml-3 shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Search company by name..."
          className="flex-1 px-3 py-2.5 text-sm text-slate-800 bg-transparent focus:outline-none placeholder-slate-400 font-medium"
          autoComplete="off"
        />
        {/* Right-side indicators */}
        {selected ? (
          <div className="flex items-center gap-1.5 mr-2 shrink-0">
            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 uppercase tracking-wide">
              ✓ Selected
            </span>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleClear() }}
              className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer p-0.5"
              title="Clear"
            >
              <i className="pi pi-times text-[10px]" />
            </button>
          </div>
        ) : query ? (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleClear() }}
            className="mr-3 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
            title="Clear"
          >
            <i className="pi pi-times text-[10px]" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-40 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 shadow-xl overflow-hidden">
          {/* Header label */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {query.trim() ? 'Search Results' : 'Top Companies'}
            </span>
          </div>

          {displayList.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 italic">
              {loading ? 'Searching...' : query.trim() ? 'No companies found' : 'No companies available'}
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
              {displayList.map((c, i) => {
                const isActive = selected?._id === c._id
                return (
                  <button
                    key={c._id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Color-indexed dot for top 4 */}
                      {!query.trim() && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500'][i] || 'bg-slate-400'
                        }`} />
                      )}
                      <span className={`text-sm font-semibold truncate ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                        {c.name}
                      </span>
                    </div>
                    {isActive && <i className="pi pi-check text-blue-600 text-xs shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
