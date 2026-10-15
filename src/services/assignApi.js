import api from './axios'

export const assignApi = {
  // Manager: Get employees list with assigned parameters count
  getAssignEmployees: async () => {
    const res = await api.get('/manager/assign/employees')
    return res.data.employees
  },

  // Manager: Get parameters list filtered by employee, search, page
  getAssignTags: async (employeeId = 'all', page = 1, limit = 10, search = '') => {
    const params = new URLSearchParams()
    params.append('employeeId', employeeId)
    params.append('page', page)
    params.append('limit', limit)
    if (search) params.append('search', search)
    const res = await api.get(`/manager/assign/tags?${params.toString()}`)
    return res.data
  },

  // Manager: Assign or clear visualization for a tag
  assignVisualization: async (tagId, type, value, meterMin = null, meterMax = null, meterColor = '#22c55e', meterIdle = 0) => {
    const res = await api.post('/manager/assign', {
      tagId,
      type,
      value,
      meterMin,
      meterMax,
      meterIdle,
      meterColor
    })
    return res.data
  },

  // Employee: Get assigned digital meters
  getEmployeeDigitalMeters: async (page = 1, limit = 10) => {
    const res = await api.get(`/employee/digital-meters?page=${page}&limit=${limit}`)
    return res.data
  }
}
