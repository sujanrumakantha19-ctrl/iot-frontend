import api from './axios'

export const companiesApi = {
  getAll: async (params = {}) => {
    const res = await api.get('/admin/companies', { params })
    return res.data
  },
  create: async (data) => {
    const res = await api.post('/admin/companies', data)
    return res.data.company
  },
  update: async (id, data) => {
    const res = await api.put(`/admin/companies/${id}`, data)
    return res.data.company
  },
  delete: async (id) => {
    const res = await api.delete(`/admin/companies/${id}`)
    return res.data
  },
  getDetail: async (id, params = {}) => {
    const res = await api.get(`/admin/companies/${id}/detail`, { params })
    return res.data
  },
  getMyCompany: async () => {
    const res = await api.get('/auth/company')
    return res.data
  }
}
