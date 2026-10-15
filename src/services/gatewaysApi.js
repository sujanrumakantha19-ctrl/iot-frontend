import api from './axios'

export const gatewaysApi = {
  // Admin Gateway CRUD
  getAll: async (params = {}) => {
    const res = await api.get('/admin/gateways', { params })
    return res.data
  },
  getManagerGateways: async (params = {}) => {
    const res = await api.get('/manager/gateways', { params })
    return res.data
  },
  getById: async (gatewayId) => {
    const res = await api.get(`/gateways/${gatewayId}`)
    return res.data.gateway
  },
  create: async (data) => {
    const res = await api.post('/admin/gateways', data)
    return res.data.gateway
  },
  update: async (id, data) => {
    const res = await api.put(`/admin/gateways/${id}`, data)
    return res.data.gateway
  },
  delete: async (id) => {
    const res = await api.delete(`/admin/gateways/${id}`)
    return res.data
  },
  updateDevices: async (gatewayId, devices) => {
    const res = await api.put(`/gateways/${gatewayId}/devices`, { devices })
    return res.data
  },

  // Gateway Configurations & Commands (Admin scope)
  getConfig: async (gatewayId) => {
    const res = await api.get(`/gateways/${gatewayId}/config`)
    return res.data.config
  },
  publishConfig: async (gatewayId, groups) => {
    // groups: [{ groupNum, rows }, ...] or legacy [[...rows]]
    const res = await api.post(`/gateways/${gatewayId}/config`, { groups })
    return res.data
  },
  // Publish a single group by its stable groupNum
  publishGroup: async (gatewayId, groupNum, rows) => {
    const res = await api.post(`/gateways/${gatewayId}/config`, {
      groups: [{ groupNum, rows }]
    })
    return res.data
  },
  // Delete a specific group by stable groupNum (dbOnly = true removes from DB only without MQTT command)
  deleteGroup: async (gatewayId, groupNum, dbOnly = false) => {
    const res = await api.delete(`/gateways/${gatewayId}/config/group/${groupNum}${dbOnly ? '?dbOnly=true' : ''}`)
    return res.data
  },
  readConfig: async (gatewayId, groupCount) => {
    const res = await api.post(`/gateways/${gatewayId}/read-config`, { groupCount })
    return res.data
  },
  queryWifiStatus: async (gatewayId) => {
    const res = await api.post(`/gateways/${gatewayId}/wifi-status`)
    return res.data
  },
  testStatus: async (gatewayId) => {
    const res = await api.post(`/gateways/${gatewayId}/test-status`)
    return res.data
  },
  checkVersion: async (gatewayId) => {
    const res = await api.post(`/gateways/${gatewayId}/check-version`)
    return res.data
  },
  testAll: async (gatewayId) => {
    const res = await api.post(`/gateways/${gatewayId}/test-all`)
    return res.data
  },
  setLocationMqtt: async (gatewayId, location) => {
    const res = await api.post(`/gateways/${gatewayId}/set-location-mqtt`, { location })
    return res.data
  },
  queryLocationDetails: async (gatewayId) => {
    const res = await api.post(`/gateways/${gatewayId}/read-location-details`)
    return res.data
  },
  setDelayMqtt: async (gatewayId, delay) => {
    const res = await api.post(`/gateways/${gatewayId}/set-delay-mqtt`, { delay })
    return res.data
  },
  queryDelayDetails: async (gatewayId) => {
    const res = await api.post(`/gateways/${gatewayId}/read-delay-details`)
    return res.data
  },
  uploadFotaBinary: async (gatewayId, filename, base64Data) => {
    const res = await api.post(`/gateways/${gatewayId}/fota/upload`, { filename, base64Data })
    return res.data
  },
  triggerFotaUpdate: async (gatewayId, downloadUrl) => {
    const res = await api.post(`/gateways/${gatewayId}/fota/trigger`, { downloadUrl })
    return res.data
  },

  // Config History
  getConfigHistory: async (gatewayId) => {
    const res = await api.get(`/gateways/${gatewayId}/config-history`)
    return res.data.history
  },
  getConfigDetail: async (gatewayId, configId) => {
    const res = await api.get(`/gateways/${gatewayId}/config/${configId}`)
    return res.data.config
  },

  // GPS Location
  getGpsLocation: async (gatewayId) => {
    const res = await api.post(`/gateways/${gatewayId}/gps-location`)
    return res.data
  },

  // App Settings
  getGroupSize: async () => {
    const res = await api.get('/admin/settings/group-size')
    return res.data.groupSize
  },
  updateGroupSize: async (value) => {
    const res = await api.put('/admin/settings/group-size', { value })
    return res.data.groupSize
  },

  // Gateway Display Labels Mapping (Admin scope)
  getGatewayTags: async (gatewayId, params = {}) => {
    const res = await api.get(`/admin/gateways/${gatewayId}/tags`, { params })
    return res.data
  },
  updateGatewayLabels: async (gatewayId, labels, units = {}) => {
    const res = await api.put(`/admin/gateways/${gatewayId}/labels`, { labels, units })
    return res.data
  }
}
