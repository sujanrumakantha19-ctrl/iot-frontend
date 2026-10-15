import { useState, useEffect, useRef, useCallback } from 'react'
import { assetTwinsApi } from '../../services/assetTwinsApi'
import { formatTagDisplayName } from '../../utils/tagUtils'

export function formatTagLabel(tag) {
  if (!tag) return ''
  const label = formatTagDisplayName(tag)
  const device = tag.deviceName ? ` · ${tag.deviceName}` : ''
  return `${label}${device}`
}

export default function TagSearchCombobox({
  value,
  selectedTag,
  gatewayId = '',
  placeholder = 'Search tags...',
  onSelect,
  onClear
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [defaults, setDefaults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (selectedTag) {
      setQuery(formatTagLabel(selectedTag))
    } else if (!value) {
      setQuery('')
    }
  }, [selectedTag, value])

  useEffect(() => {
    setDefaults([])
    setResults([])
  }, [gatewayId])

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadDefaults = useCallback(async () => {
    setLoading(true)
    try {
      const res = await assetTwinsApi.getTagOptions({
        page: 1,
        limit: 10,
        gatewayId: gatewayId || ''
      })
      setDefaults(res.tags || [])
    } catch {
      setDefaults([])
    } finally {
      setLoading(false)
    }
  }, [gatewayId])

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await assetTwinsApi.getTagOptions({
          page: 1,
          limit: 10,
          search: q.trim(),
          gatewayId: gatewayId || ''
        })
        setResults(res.tags || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [gatewayId])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (selectedTag || value) {
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
    if (defaults.length === 0) {
      loadDefaults()
    }
  }

  const handleSelect = (tag) => {
    setQuery(formatTagLabel(tag))
    setResults([])
    setOpen(false)
    onSelect?.(tag)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    onClear?.()
    inputRef.current?.focus()
  }

  let displayList = query.trim() ? results : defaults
  if (selectedTag && value && !displayList.some(t => t._id === value)) {
    displayList = [selectedTag, ...displayList]
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className={`flex items-center bg-white border rounded-lg transition-all ${
        open ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
      }`}>
        {loading
          ? <i className="pi pi-spin pi-spinner text-[10px] text-blue-400 ml-2.5 shrink-0" />
          : <i className="pi pi-search text-[10px] text-slate-400 ml-2.5 shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1 px-2 py-2 text-sm text-slate-800 bg-transparent focus:outline-none placeholder-slate-400 min-w-0"
          autoComplete="off"
        />
        {(selectedTag || value || query) && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleClear() }}
            className="mr-2 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0 border-none bg-transparent p-0.5"
            title="Clear"
          >
            <i className="pi pi-times text-[10px]" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          <div className="px-2.5 py-1 bg-slate-50 border-b border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {query.trim() ? 'Search results' : 'Recent tags'}
            </span>
          </div>
          {displayList.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-400 italic">
              {loading ? 'Loading...' : query.trim() ? 'No tags found' : 'No tags available'}
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
              {displayList.map(tag => {
                const isActive = value === tag._id
                return (
                  <button
                    key={tag._id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(tag) }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer border-none ${
                      isActive ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                        {formatTagLabel(tag)}
                      </p>
                      {tag.unit && (
                        <p className="text-[10px] text-slate-400 truncate">{tag.unit}</p>
                      )}
                    </div>
                    {isActive && <i className="pi pi-check text-blue-600 text-[10px] shrink-0" />}
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
