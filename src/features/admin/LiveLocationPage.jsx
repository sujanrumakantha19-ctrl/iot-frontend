import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Dialog } from 'primereact/dialog'
import { getSocket } from '../../services/socketClient'
import { gatewaysApi } from '../../services/gatewaysApi'
import { showToast } from '../../utils/toast'
import api from '../../services/axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet'

const redPinIcon = L.divIcon({
  className: '',
  html: `<svg viewBox="0 0 40 52" width="40" height="52" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 4C12.15 4 5.8 10.66 5.8 18.84c0 8.67 11.7 20.66 12.78 21.76.56.6 1.64.6 2.2 0 1.08-1.1 12.78-13.1 12.78-21.76C33.56 10.66 27.2 4 20 4z" fill="#e53e3e" stroke="#c53030" stroke-width="1.2"/>
    <circle cx="20" cy="18.5" r="6" fill="#fff"/>
    <path d="M20 44l-5-8h10l-5 8z" fill="#e53e3e" stroke="#c53030" stroke-width="1"/>
  </svg>`,
  iconSize: [40, 52],
  iconAnchor: [20, 52],
  popupAnchor: [0, -54],
  tooltipAnchor: [0, -56],
})

function RecenterControl({ markers }) {
  const map = useMap()
  const handleRecenter = () => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 })
    }
  }
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={handleRecenter}
          title="Fit all markers"
          className="w-[34px] h-[34px] flex items-center justify-center bg-white hover:bg-slate-50 cursor-pointer border-b border-slate-200 text-slate-600 text-sm transition-colors"
        >
          <i className="pi pi-compass" />
        </button>
      </div>
    </div>
  )
}

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LiveLocationPage() {
  const [gateways, setGateways] = useState([])
  const [companies, setCompanies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [configureModalVisible, setConfigureModalVisible] = useState(false)
  const [modalCompanyFilter, setModalCompanyFilter] = useState('all')
  const [modalSearch, setModalSearch] = useState('')
  const [loadingGps, setLoadingGps] = useState(new Set())
  const searchDebounce = useRef(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [gRes, cRes] = await Promise.all([
        api.get('/admin/gateways', { params: { limit: 500 } }),
        api.get('/admin/companies'),
      ])
      setGateways(gRes.data.gateways || [])
      setCompanies(cRes.data.companies || [])
    } catch (err) {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to load gateways' })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handler = (data) => {
      setGateways((prev) =>
        prev.map((g) =>
          g._id === data.gatewayId
            ? { ...g, gps: { lat: data.gps.lat, lng: data.gps.lng, updatedAt: new Date().toISOString() } }
            : g
        )
      )
    }
    socket.on('gateway:gps-response', handler)
    return () => socket.off('gateway:gps-response', handler)
  }, [])

  // Build company map for fast lookup
  const companyMap = useMemo(() => {
    const m = {}
    companies.forEach((c) => (m[c._id] = c.name))
    return m
  }, [companies])

  // Filtered gateways for main map
  const filteredGateways = useMemo(() => {
    let list = gateways
    if (companyFilter !== 'all') {
      list = list.filter((g) => (g.companyId?._id || g.companyId) === companyFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q) || g.prefix.toLowerCase().includes(q))
    }
    return list
  }, [gateways, companyFilter, searchQuery])

  // Gateways that have GPS coordinates (for map markers)
  const gpsMarkers = useMemo(() => {
    return filteredGateways
      .filter((g) => g.gps && g.gps.lat != null && g.gps.lng != null)
      .map((g) => ({
        id: g._id,
        lat: g.gps.lat,
        lng: g.gps.lng,
        name: g.name,
        prefix: g.prefix,
        status: g.status,
        companyName: companyMap[g.companyId?._id || g.companyId] || 'Unknown',
        gps: g.gps,
      }))
  }, [filteredGateways, companyMap])

  // Gateways grouped by company for configure modal
  const groupedGateways = useMemo(() => {
    const groups = {}
    let list = gateways
    if (modalCompanyFilter !== 'all') {
      list = list.filter((g) => (g.companyId?._id || g.companyId) === modalCompanyFilter)
    }
    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q) || g.prefix.toLowerCase().includes(q))
    }
    list.forEach((g) => {
      const cid = g.companyId?._id || g.companyId
      if (!groups[cid]) groups[cid] = { companyName: companyMap[cid] || 'Unknown', gateways: [] }
      groups[cid].gateways.push(g)
    })
    return Object.entries(groups).sort((a, b) => a[1].companyName.localeCompare(b[1].companyName))
  }, [gateways, modalCompanyFilter, modalSearch, companyMap])

  const handleGetGps = async (gatewayId) => {
    if (loadingGps.has(gatewayId)) return
    setLoadingGps((prev) => new Set(prev).add(gatewayId))
    try {
      const res = await gatewaysApi.getGpsLocation(gatewayId)
      if (res.success && res.gps) {
        setGateways((prev) =>
          prev.map((g) =>
            g._id === gatewayId
              ? { ...g, gps: { lat: res.gps.lat, lng: res.gps.lng, updatedAt: new Date().toISOString() } }
              : g
          )
        )
        showToast({
          severity: 'success',
          summary: 'GPS Updated',
          detail: `Gateway location: ${res.gps.lat}, ${res.gps.lng}`,
          life: 3000,
        })
      } else {
        showToast({ severity: 'warn', summary: 'GPS Timeout', detail: 'Gateway did not respond within 10s' })
      }
    } catch (err) {
      showToast({ severity: 'error', summary: 'GPS Error', detail: err.message })
    } finally {
      setLoadingGps((prev) => {
        const next = new Set(prev)
        next.delete(gatewayId)
        return next
      })
    }
  }

  const gpsCount = gateways.filter((g) => g.gps && g.gps.lat != null).length

  return (
    <div className="h-full flex flex-col">
      {/* ─── Top Toolbar ─── */}
      <div className="flex items-center gap-3 pb-4 flex-wrap shrink-0">

        <div className="flex-1" />

        {/* Company filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</span>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[140px]"
          >
            <option value="all">All Companies</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Gateway search */}
        <div className="relative">
          <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              clearTimeout(searchDebounce.current)
              searchDebounce.current = setTimeout(() => {}, 200)
            }}
            placeholder="Search gateway..."
            className="h-9 w-[180px] pl-8 pr-3 border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
          />
        </div>

        {/* Configure button */}
        <button
          onClick={() => { setConfigureModalVisible(true); setModalCompanyFilter('all'); setModalSearch('') }}
          className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
        >
          <i className="pi pi-cog text-[10px]" />
          Configure
        </button>

        {/* GPS count badge */}
        <div className="flex items-center gap-1.5 h-9 px-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
          <i className="pi pi-map-marker text-emerald-500" />
          {gpsCount} / {gateways.length} GPS
        </div>
      </div>

      {/* ─── Main Map ─── */}
      <div className="flex-1 bg-white border-t border-slate-200/80 relative min-h-[500px] -ml-6 -mr-6 -mb-6">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
              <i className="pi pi-spin pi-spinner" />
              Loading gateways...
            </div>
          </div>
        ) : (
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            className="w-full h-full z-0"
            scrollWheelZoom={true}
            maxZoom={11}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <RecenterControl markers={gpsMarkers} />

            {gpsMarkers.map((m) => (
              <Marker
                key={m.id}
                position={[m.lat, m.lng]}
                icon={redPinIcon}
              >
                <Tooltip direction="top" offset={[0, 2]} permanent={true}>
                  <div className="text-xs font-bold whitespace-nowrap">
                    {m.name}
                    <span className="text-slate-400 font-normal ml-1">({m.companyName})</span>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="min-w-[180px] space-y-2">
                    <div className="font-bold text-sm text-slate-800">{m.name}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{m.companyName}</div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-slate-400">{m.prefix}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        m.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="border-t border-slate-100 pt-1.5 space-y-0.5">
                      <div className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-500">Lat:</span> {m.lat}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-500">Lng:</span> {m.lng}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Updated: {formatTimestamp(m.gps?.updatedAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGetGps(m.id) }}
                      disabled={loadingGps.has(m.id)}
                      className="w-full mt-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      {loadingGps.has(m.id) ? (
                        <><i className="pi pi-spin pi-spinner text-[9px]" /> Fetching...</>
                      ) : (
                        <><i className="pi pi-refresh text-[9px]" /> Refresh GPS</>
                      )}
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {gpsMarkers.length === 0 && (
              <div className="leaflet-top leaflet-center" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                <div className="leaflet-control bg-white/90 backdrop-blur px-5 py-3 shadow-lg border border-slate-200 mt-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                    <i className="pi pi-map-marker text-slate-300" />
                    No GPS markers yet — click <strong className="text-blue-600 mx-1">Configure</strong> to fetch locations
                  </div>
                </div>
              </div>
            )}
          </MapContainer>
        )}
      </div>

      {/* ─── Configure Modal ─── */}
      <Dialog
        header={
          <div className="flex items-center gap-2">
            <i className="pi pi-map-marker text-blue-500" />
            <span className="text-base font-bold text-slate-800">Configure Gateway GPS Locations</span>
          </div>
        }
        visible={configureModalVisible}
        onHide={() => setConfigureModalVisible(false)}
        draggable={false}
        className="w-full max-w-4xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Modal filters */}
          <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</span>
              <select
                value={modalCompanyFilter}
                onChange={(e) => setModalCompanyFilter(e.target.value)}
                className="h-9 px-3 border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[140px]"
              >
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 max-w-[200px]">
              <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              <input
                type="text"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="Search gateway..."
                className="w-full h-9 pl-8 pr-3 border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {gateways.length} gateway{gateways.length !== 1 ? 's' : ''} total
            </span>
          </div>

          {/* Gateway groups by company */}
          {groupedGateways.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-medium">
              <i className="pi pi-info-circle text-xl block mb-2" />
              No gateways found
            </div>
          ) : (
            groupedGateways.map(([companyId, group]) => (
              <div key={companyId} className="border border-slate-200/80">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200/80">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="pi pi-building text-slate-400 text-xs" />
                    {group.companyName}
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5">
                      {group.gateways.length}
                    </span>
                  </h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.gateways.map((gw) => {
                    const hasGps = gw.gps && gw.gps.lat != null
                    const isLoadingGps = loadingGps.has(gw._id)
                    return (
                      <div key={gw._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        {/* Status */}
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          gw.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'
                        }`} title={gw.status} />

                        {/* Name + prefix */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{gw.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{gw.prefix}</div>
                        </div>

                        {/* GPS coords */}
                        <div className="hidden sm:block min-w-[160px] text-xs">
                          {hasGps ? (
                            <span className="font-mono text-emerald-600 font-semibold">
                              {gw.gps.lat}, {gw.gps.lng}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not set</span>
                          )}
                        </div>

                        {/* Last updated */}
                        <div className="hidden md:block min-w-[100px] text-[10px] text-slate-400 font-medium">
                          {hasGps ? formatTimestamp(gw.gps.updatedAt) : '—'}
                        </div>

                        {/* Get GPS button */}
                        <button
                          onClick={() => handleGetGps(gw._id)}
                          disabled={isLoadingGps}
                          className={`shrink-0 px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                            hasGps
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {isLoadingGps ? (
                            <><i className="pi pi-spin pi-spinner text-[9px]" /> Getting...</>
                          ) : (
                            <><i className={`pi ${hasGps ? 'pi-refresh' : 'pi-map-marker'} text-[9px]`} /> {hasGps ? 'Refresh' : 'Get GPS'}</>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </Dialog>
    </div>
  )
}
