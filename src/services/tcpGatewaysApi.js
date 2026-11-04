import api from './axios'
const base = id => `/gateways/${id}/modbus-tcp`
export const tcpGatewaysApi = {
  getState: async id => (await api.get(`${base(id)}/state`)).data,
  saveDevices: async (id, devices) => (await api.put(`${base(id)}/devices`, { devices })).data,
  publish: async (id, groups, replace = false) => (await api.post(`${base(id)}/config`, { groups, replace })).data,
  deleteGroup: async (id, groupNum, dbOnly = false) => (await api.delete(`${base(id)}/config/group/${groupNum}`, { params: { dbOnly } })).data,
  read: async id => (await api.post(`${base(id)}/read-config`)).data,
  history: async id => (await api.get(`${base(id)}/config-history`)).data,
}
