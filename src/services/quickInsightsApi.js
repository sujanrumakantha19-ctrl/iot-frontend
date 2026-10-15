import api from './axios'

export const quickInsightsApi = {
  // Manager — Tabs
  getTabs: (employeeId) => api.get(`/manager/quick-insights/employee/${employeeId}/tabs`),
  createTab: (employeeId, data) => api.post(`/manager/quick-insights/employee/${employeeId}/tabs`, data),
  updateTab: (tabId, data) => api.put(`/manager/quick-insights/tabs/${tabId}`, data),
  deleteTab: (tabId) => api.delete(`/manager/quick-insights/tabs/${tabId}`),

  // Manager — Widgets
  getWidgets: (tabId) => api.get(`/manager/quick-insights/tabs/${tabId}/widgets`),
  addWidget: (tabId, data) => api.post(`/manager/quick-insights/tabs/${tabId}/widgets`, data),
  updateWidget: (widgetId, data) => api.put(`/manager/quick-insights/widgets/${widgetId}`, data),
  deleteWidget: (widgetId) => api.delete(`/manager/quick-insights/widgets/${widgetId}`),
  saveLayout: (tabId, widgets) => api.put(`/manager/quick-insights/tabs/${tabId}/widgets/layout`, { widgets }),

  // Employee — Read-only
  getEmployeeTabs: () => api.get('/employee/quick-insights/tabs'),
  getEmployeeWidgets: (tabId) => api.get(`/employee/quick-insights/tabs/${tabId}/widgets`),
}
