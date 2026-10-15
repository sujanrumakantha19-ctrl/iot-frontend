import api from './axios'

export const usersApi = {
  // Managers
  getManagers: async (params = {}) => {
    const res = await api.get('/admin/managers', { params })
    return res.data
  },
  createManager: async (data) => {
    const res = await api.post('/admin/managers', data)
    return res.data.manager
  },
  updateManager: async (id, data) => {
    const res = await api.put(`/admin/managers/${id}`, data)
    return res.data.manager
  },
  deleteManager: async (id) => {
    const res = await api.delete(`/admin/managers/${id}`)
    return res.data
  },

  // Employees (Admin scope)
  getEmployees: async (params = {}) => {
    const res = await api.get('/admin/employees', { params })
    return res.data
  },
  createEmployee: async (data) => {
    const res = await api.post('/admin/employees', data)
    return res.data.employee
  },
  updateEmployee: async (id, data) => {
    const res = await api.put(`/admin/employees/${id}`, data)
    return res.data.employee
  },
  deleteEmployee: async (id) => {
    const res = await api.delete(`/admin/employees/${id}`)
    return res.data
  },

  // Employees (Manager scope)
  getManagerEmployees: async () => {
    const res = await api.get('/manager/employees')
    return res.data.employees
  },

  // Detail pages
  getUser: async (id) => {
    const res = await api.get(`/admin/users/${id}`)
    return res.data.user
  },
  getManagerDetail: async (id) => {
    const res = await api.get(`/admin/managers/${id}/detail`)
    return res.data
  },
  getEmployeeGatewayTags: async (id) => {
    const res = await api.get(`/admin/employees/${id}/gateway-tags`)
    return res.data.gateways
  },
  assignManagerEmployees: async (id, employeeIds) => {
    const res = await api.post(`/admin/managers/${id}/assign-employees`, { employeeIds })
    return res.data
  }
}
