import api from './axios'

export const telemetryApi = {
  // Manager APIs
  getManagerDashboard: async (employeeId) => {
    const query = employeeId ? `?employeeId=${employeeId}` : ''
    const res = await api.get(`/manager/dashboard${query}`)
    return res.data.tags
  },
  getManagerTelemetry: async (employeeId, search = '', page, limit, gatewayId) => {
    const params = new URLSearchParams()
    params.append('employeeId', employeeId || 'all')
    if (search) params.append('search', search)
    if (page) params.append('page', page)
    if (limit) params.append('limit', limit)
    if (gatewayId) params.append('gatewayId', gatewayId)
    const res = await api.get(`/manager/telemetry?${params.toString()}`)
    return res.data
  },
  getManagerGateways: async (employeeId) => {
    const query = employeeId && employeeId !== 'all' ? `?employeeId=${employeeId}` : ''
    const res = await api.get(`/manager/gateways${query}`)
    return res.data.gateways
  },
  getManagerReadings: async (tagId, limit = 20, startDate, endDate) => {
    let url = `/manager/readings?tagId=${tagId}&limit=${limit}`
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`
    const res = await api.get(url)
    return res.data.readings
  },
  getManagerReport: async (employeeId, tagId, startDate, endDate, page = 1, limit = 50) => {
    const params = new URLSearchParams()
    if (employeeId) params.append('employeeId', employeeId)
    if (tagId) params.append('tagId', tagId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    params.append('page', page)
    params.append('limit', limit)
    const res = await api.get(`/manager/report?${params.toString()}`)
    return res.data
  },
  exportManagerReport: async (employeeId, filters) => {
    const res = await api.post('/manager/report/export', {
      employeeId,
      filters,
      format: filters?.format || 'csv'
    })
    return res.data
  },
  downloadManagerReport: async (employeeId, tagId, startDate, endDate, format = 'csv') => {
    const params = new URLSearchParams()
    if (employeeId) params.append('employeeId', employeeId)
    if (tagId) params.append('tagId', tagId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    params.append('format', format)
    const res = await api.get(`/manager/report/download?${params.toString()}`, {
      responseType: 'blob'
    })
    return res
  },

  // Employee APIs
  getEmployeeDashboard: async () => {
    const res = await api.get('/employee/dashboard')
    return res.data.tags
  },
  getEmployeeTelemetry: async (search = '', page, limit, gatewayId) => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (page) params.append('page', page)
    if (limit) params.append('limit', limit)
    if (gatewayId) params.append('gatewayId', gatewayId)
    const qs = params.toString()
    const res = await api.get(qs ? `/employee/telemetry?${qs}` : '/employee/telemetry')
    return res.data
  },
  getEmployeeReadings: async (tagId, limit = 20, startDate, endDate) => {
    let url = `/employee/readings?tagId=${tagId}&limit=${limit}`
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`
    const res = await api.get(url)
    return res.data.readings
  },
  getEmployeeWatchlist: async () => {
    const res = await api.get('/employee/watchlist')
    return res.data.watchlist
  },
  toggleWatchlist: async (tagId) => {
    const res = await api.post('/employee/watchlist/toggle', { tagId })
    return res.data.isWatchlisted
  },
  getEmployeeReport: async (tagId, startDate, endDate, page = 1, limit = 50) => {
    const params = new URLSearchParams()
    if (tagId) params.append('tagId', tagId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    params.append('page', page)
    params.append('limit', limit)
    const res = await api.get(`/employee/report?${params.toString()}`)
    return res.data
  },
  exportEmployeeReport: async (filters) => {
    const res = await api.post('/employee/report/export', {
      filters,
      format: filters?.format || 'csv'
    })
    return res.data
  },
  downloadEmployeeReport: async (tagId, startDate, endDate, format = 'csv') => {
    const params = new URLSearchParams()
    if (tagId) params.append('tagId', tagId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    params.append('format', format)
    const res = await api.get(`/employee/report/download?${params.toString()}`, {
      responseType: 'blob'
    })
    return res
  },
  getTelemetryTags: async () => {
    const res = await api.get('/admin/telemetry-tags')
    return res.data.tags
  },
  getEmployeeDevices: async () => {
    const res = await api.get('/employee/devices')
    return res.data.devices
  },
  
  // Manager Telemetry Tag rename
  renameTelemetryTag: async (tagId, displayName) => {
    const res = await api.put(`/manager/telemetry/${tagId}/rename`, { displayName })
    return res.data
  },
  getCompanyTags: async (page = 1, limit = 200) => {
    const res = await api.get(`/manager/telemetry?employeeId=all&page=${page}&limit=${limit}`)
    return res.data
  }
}

export const quickInsightsApi = {
  // Manager CRUD
  getManagerBars: () => api.get('/manager/quick-insights'),
  createBar: (data) => api.post('/manager/quick-insights', data),
  updateBar: (barId, data) => api.put(`/manager/quick-insights/${barId}`, data),
  deleteBar: (barId) => api.delete(`/manager/quick-insights/${barId}`),
  // Employee read-only
  getEmployeeBars: () => api.get('/employee/quick-insights'),
}


