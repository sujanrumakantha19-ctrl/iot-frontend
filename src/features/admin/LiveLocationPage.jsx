import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
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
  Polyline,
} from 'react-leaflet'

const createPinIcon = (status, indexBadge = null) => {
  const isOnline = status === 'online'
  const mainColor = isOnline ? '#10b981' : '#e53e3e'
  const strokeColor = isOnline ? '#059669' : '#c53030'

  return L.divIcon({
    className: 'custom-pin-icon',
    html: `
      <div style="position: relative; width: 38px; height: 50px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.28));">
        <svg viewBox="0 0 40 52" width="38" height="50" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4C12.15 4 5.8 10.66 5.8 18.84c0 8.67 11.7 20.66 12.78 21.76.56.6 1.64.6 2.2 0 1.08-1.1 12.78-13.1 12.78-21.76C33.56 10.66 27.2 4 20 4z" fill="${mainColor}" stroke="${strokeColor}" stroke-width="1.2"/>
          <circle cx="20" cy="18.5" r="7" fill="#ffffff"/>
          <circle cx="20" cy="18.5" r="4.2" fill="${mainColor}"/>
          <path d="M20 44l-4.5-7h9l-4.5 7z" fill="${mainColor}" stroke="${strokeColor}" stroke-width="1"/>
        </svg>
        ${indexBadge ? `
          <span style="position: absolute; top: -3px; right: -3px; background: #1e293b; color: #ffffff; border: 1.5px solid #ffffff; font-size: 9px; font-weight: 800; border-radius: 9999px; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
            ${indexBadge}
          </span>
        ` : ''}
      </div>
    `,
    iconSize: [38, 50],
    iconAnchor: [19, 50],
    popupAnchor: [0, -52],
    tooltipAnchor: [0, -54],
  })
}

const createHubIcon = (count, hasOnline) => {
  const bgFill = hasOnline ? '#2563eb' : '#475569'
  const strokeFill = hasOnline ? '#1d4ed8' : '#334155'

  return L.divIcon({
    className: 'location-hub-pin',
    html: `
      <div style="position: relative; width: 44px; height: 56px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.32));">
        <svg viewBox="0 0 40 52" width="44" height="56" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4C12.15 4 5.8 10.66 5.8 18.84c0 8.67 11.7 20.66 12.78 21.76.56.6 1.64.6 2.2 0 1.08-1.1 12.78-13.1 12.78-21.76C33.56 10.66 27.2 4 20 4z" fill="${bgFill}" stroke="${strokeFill}" stroke-width="1.4"/>
          <circle cx="20" cy="18.5" r="9.5" fill="#ffffff"/>
          <path d="M20 44l-5-8h10l-5 8z" fill="${bgFill}" stroke="${strokeFill}" stroke-width="1"/>
        </svg>
        <div style="position: absolute; top: 9px; left: 12px; width: 20px; height: 20px; border-radius: 50%; background: ${bgFill}; color: #ffffff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; font-family: monospace;">
          ${count > 99 ? '99+' : count}
        </div>
        <div style="position: absolute; top: -3px; right: -4px; background: #f59e0b; color: #ffffff; border: 1.5px solid #ffffff; font-size: 8px; font-weight: 800; border-radius: 9999px; padding: 1px 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); letter-spacing: 0.5px;">
          HUB
        </div>
      </div>
    `,
    iconSize: [44, 56],
    iconAnchor: [22, 56],
    popupAnchor: [0, -58],
    tooltipAnchor: [0, -60],
  })
}

function SingleGatewayPopupContent({ gw, loadingGps, handleGetGps }) {
  return (
    <div className="min-w-[190px] space-y-2">
      <div className="font-bold text-sm text-slate-800">{gw.name}</div>
      <div className="text-[11px] text-slate-500 font-medium">{gw.companyName}</div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-mono text-slate-400">{gw.prefix}</span>
        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
          gw.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {gw.status}
        </span>
      </div>
      <div className="border-t border-slate-100 pt-1.5 space-y-0.5">
        <div className="text-[11px] text-slate-600">
          <span className="font-semibold text-slate-500">Lat:</span> {Number(gw.lat).toFixed(5)}
        </div>
        <div className="text-[11px] text-slate-600">
          <span className="font-semibold text-slate-500">Lng:</span> {Number(gw.lng).toFixed(5)}
        </div>
        <div className="text-[10px] text-slate-400">
          Updated: {formatTimestamp(gw.gps?.updatedAt)}
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleGetGps(gw.id) }}
          disabled={loadingGps.has(gw.id)}
          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
        >
          {loadingGps.has(gw.id) ? (
            <><i className="pi pi-spin pi-spinner text-[9px]" /> Fetching...</>
          ) : (
            <><i className="pi pi-refresh text-[9px]" /> Refresh GPS</>
          )}
        </button>
      </div>
    </div>
  )
}

function HubPopupContent({ gateways, centerLat, centerLng, loadingGps, handleGetGps, setIsDispersed }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const activeGw = gateways[selectedIdx] || gateways[0]

  return (
    <div className="min-w-[240px] max-w-[280px] space-y-2.5">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold text-[9px] uppercase tracking-wider">
              Site Hub
            </span>
            <span className="text-xs font-bold text-slate-800">
              {gateways.length} Gateways Here
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsDispersed(true)
            }}
            className="text-[9px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer"
            title="Fan out these gateways on the map"
          >
            <i className="pi pi-share-alt text-[8px]" />
            Fan Out
          </button>
        </div>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
          Lat: {centerLat.toFixed(5)}, Lng: {centerLng.toFixed(5)}
        </div>
      </div>

      {/* Gateway Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {gateways.map((gw, idx) => {
          const isSelected = idx === selectedIdx
          return (
            <button
              key={gw.id}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedIdx(idx)
              }}
              className={`px-2 py-1 text-[10px] font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${gw.status === 'online' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              <span className="truncate max-w-[80px]">{gw.name}</span>
            </button>
          )
        })}
      </div>

      {/* Active Gateway Details */}
      {activeGw && (
        <div className="bg-slate-50 p-2.5 border border-slate-200/80 space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <div>
              <div className="font-bold text-sm text-slate-800 leading-snug">{activeGw.name}</div>
              <div className="text-[11px] text-slate-500 font-medium">{activeGw.companyName}</div>
            </div>
            <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0 ${
              activeGw.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {activeGw.status}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200/60">
            <span>Prefix: {activeGw.prefix}</span>
          </div>

          <div className="text-[10px] text-slate-400">
            Updated: {formatTimestamp(activeGw.gps?.updatedAt)}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleGetGps(activeGw.id)
              }}
              disabled={loadingGps.has(activeGw.id)}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              {loadingGps.has(activeGw.id) ? (
                <><i className="pi pi-spin pi-spinner text-[9px]" /> Fetching...</>
              ) : (
                <><i className="pi pi-refresh text-[9px]" /> Refresh GPS</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [isDispersed, setIsDispersed] = useState(false)
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

  // Group markers that share identical coordinates (~1.1 meter threshold)
  const locationGroups = useMemo(() => {
    const groups = new Map()

    gpsMarkers.forEach((m) => {
      const latNum = Number(m.lat)
      const lngNum = Number(m.lng)
      if (isNaN(latNum) || isNaN(lngNum)) return

      const key = `${latNum.toFixed(5)},${lngNum.toFixed(5)}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          centerLat: latNum,
          centerLng: lngNum,
          gateways: [],
        })
      }
      groups.get(key).gateways.push(m)
    })

    return Array.from(groups.values()).map((g) => {
      const isMultiple = g.gateways.length > 1
      const hasOnline = g.gateways.some((gw) => gw.status === 'online')
      const allOnline = g.gateways.every((gw) => gw.status === 'online')
      return {
        ...g,
        count: g.gateways.length,
        isMultiple,
        hasOnline,
        allOnline,
      }
    })
  }, [gpsMarkers])

  const overlappingSitesCount = useMemo(() => {
    return locationGroups.filter((g) => g.count > 1).length
  }, [locationGroups])

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

        {/* Disperse / Cluster Toggle when overlapping sites exist */}
        {overlappingSitesCount > 0 && (
          <button
            onClick={() => setIsDispersed((prev) => !prev)}
            className={`h-9 px-3 border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isDispersed
                ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title={isDispersed ? 'Group overlapping gateways into site hubs' : 'Disperse overlapping gateways in a circle'}
          >
            <i className={`pi ${isDispersed ? 'pi-th-large' : 'pi-share-alt'} text-xs`} />
            <span>{isDispersed ? 'Group Sites' : 'Disperse Overlapping'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              isDispersed ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {overlappingSitesCount} site{overlappingSitesCount > 1 ? 's' : ''}
            </span>
          </button>
        )}

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

            {locationGroups.map((group) => {
              // Case 1: Single gateway at this location
              if (!group.isMultiple) {
                const m = group.gateways[0]
                return (
                  <Marker
                    key={m.id}
                    position={[m.lat, m.lng]}
                    icon={createPinIcon(m.status)}
                  >
                    <Tooltip direction="top" offset={[0, -2]} permanent={true}>
                      <div className="text-xs font-bold whitespace-nowrap">
                        {m.name}
                        <span className="text-slate-400 font-normal ml-1">({m.companyName})</span>
                      </div>
                    </Tooltip>
                    <Popup>
                      <SingleGatewayPopupContent
                        gw={m}
                        loadingGps={loadingGps}
                        handleGetGps={handleGetGps}
                      />
                    </Popup>
                  </Marker>
                )
              }

              // Case 2: Multiple gateways & User clicked "Disperse Overlapping"
              if (isDispersed) {
                const N = group.count
                const R = Math.min(25 + N * 4, 60) // dispersion radius in meters
                return (
                  <Fragment key={`dispersed-group-${group.key}`}>
                    {group.gateways.map((m, idx) => {
                      const angle = (2 * Math.PI * idx) / N - Math.PI / 2
                      const latOffset = (R / 111320) * Math.cos(angle)
                      const lngOffset = (R / (111320 * Math.cos((group.centerLat * Math.PI) / 180))) * Math.sin(angle)
                      const dispersedPos = [group.centerLat + latOffset, group.centerLng + lngOffset]

                      return (
                        <Fragment key={`dispersed-${m.id}`}>
                          {/* Radial connector line back to the true physical location */}
                          <Polyline
                            positions={[[group.centerLat, group.centerLng], dispersedPos]}
                            pathOptions={{ color: '#3b82f6', weight: 1.5, dashArray: '4, 4', opacity: 0.6 }}
                          />
                          <Marker
                            position={dispersedPos}
                            icon={createPinIcon(m.status, idx + 1)}
                          >
                            <Tooltip direction="top" offset={[0, -2]} permanent={true}>
                              <div className="text-xs font-bold whitespace-nowrap">
                                <span className="font-mono text-blue-600 mr-1">#{idx + 1}</span>
                                {m.name}
                                <span className="text-slate-400 font-normal ml-1">({m.companyName})</span>
                              </div>
                            </Tooltip>
                            <Popup>
                              <SingleGatewayPopupContent
                                gw={m}
                                loadingGps={loadingGps}
                                handleGetGps={handleGetGps}
                              />
                            </Popup>
                          </Marker>
                        </Fragment>
                      )
                    })}
                  </Fragment>
                )
              }

              // Case 3: Multiple gateways at this location -> Unified Location Hub Marker
              return (
                <Marker
                  key={`hub-${group.key}`}
                  position={[group.centerLat, group.centerLng]}
                  icon={createHubIcon(group.count, group.hasOnline)}
                >
                  <Tooltip direction="top" offset={[0, -2]} permanent={true}>
                    <div className="text-xs font-bold whitespace-nowrap flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${group.hasOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{group.count} Gateways at this site</span>
                      <span className="text-slate-400 font-normal text-[10px]">
                        ({group.gateways.slice(0, 2).map((g) => g.name).join(', ')}{group.count > 2 ? '...' : ''})
                      </span>
                    </div>
                  </Tooltip>
                  <Popup>
                    <HubPopupContent
                      gateways={group.gateways}
                      centerLat={group.centerLat}
                      centerLng={group.centerLng}
                      loadingGps={loadingGps}
                      handleGetGps={handleGetGps}
                      setIsDispersed={setIsDispersed}
                    />
                  </Popup>
                </Marker>
              )
            })}

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
