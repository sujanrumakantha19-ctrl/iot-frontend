import api from './axios'

export const assetTwinsApi = {
  getTemplates: async () => {
    const res = await api.get('/admin/asset-twins/templates')
    return res.data
  },

  getCompanyAccess: async ({ page = 1, limit = 10, search = '' } = {}) => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('limit', limit)
    if (search) params.append('search', search)
    const res = await api.get(`/admin/asset-twins/company-access?${params.toString()}`)
    return res.data
  },

  setCompanyAccess: async ({ companyId, templateId, enabled }) => {
    const res = await api.put('/admin/asset-twins/company-access', { companyId, templateId, enabled })
    return res.data
  },

  getManagerAccessStatus: async () => {
    const res = await api.get('/manager/asset-twins/access-status')
    return res.data
  },

  listInstances: async ({ page = 1, limit = 10, search = '', gatewayId = '' } = {}) => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('limit', limit)
    if (search) params.append('search', search)
    if (gatewayId) params.append('gatewayId', gatewayId)
    const res = await api.get(`/manager/asset-twins?${params.toString()}`)
    return res.data
  },

  getInstance: async (id) => {
    const res = await api.get(`/manager/asset-twins/${id}`)
    return res.data
  },

  createInstance: async (payload) => {
    const res = await api.post('/manager/asset-twins', payload)
    return res.data
  },

  updateInstance: async (id, payload) => {
    const res = await api.put(`/manager/asset-twins/${id}`, payload)
    return res.data
  },

  deleteInstance: async (id) => {
    const res = await api.delete(`/manager/asset-twins/${id}`)
    return res.data
  },

  assignEmployees: async (id, assignedEmployeeIds) => {
    const res = await api.put(`/manager/asset-twins/${id}/assign-employees`, { assignedEmployeeIds })
    return res.data
  },

  getTagOptions: async ({ page = 1, limit = 20, search = '', gatewayId = '' } = {}) => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('limit', limit)
    if (search) params.append('search', search)
    if (gatewayId) params.append('gatewayId', gatewayId)
    const res = await api.get(`/manager/asset-twins/tag-options?${params.toString()}`)
    return res.data
  },

  listAssigned: async ({ page = 1, limit = 10, search = '' } = {}) => {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('limit', limit)
    if (search) params.append('search', search)
    const res = await api.get(`/employee/asset-twins?${params.toString()}`)
    return res.data
  },

  getAssignedDetail: async (id) => {
    const res = await api.get(`/employee/asset-twins/${id}`)
    return res.data
  }
}
