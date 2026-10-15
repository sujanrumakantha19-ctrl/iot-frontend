import api from './axios'

export const backupApi = {
  getGlobalBackup: async () => {
    const res = await api.get('/admin/backup/export')
    return res.data.export
  },
  getCompanyBackup: async (companyId) => {
    const res = await api.get(`/admin/backup/export/${companyId}`)
    return res.data.export
  },
  getStorageStats: async () => {
    const res = await api.get('/admin/backup/storage-stats')
    return res.data.stats || []
  },
  getLocalMongoUri: async () => {
    const res = await api.get('/admin/settings/local-mongo-uri')
    return res.data.localMongoUri
  },
  saveLocalMongoUri: async (localMongoUri) => {
    const res = await api.put('/admin/settings/local-mongo-uri', { localMongoUri })
    return res.data.localMongoUri
  },
  getSyncStatus: async () => {
    const res = await api.get('/admin/backup/sync/status')
    return res.data.syncStatus
  },
  startSync: async (localMongoUri) => {
    const res = await api.post('/admin/backup/sync/start', { localMongoUri })
    return res.data.syncStatus
  },
  testConnection: async (localMongoUri) => {
    const res = await api.post('/admin/backup/sync/test-connection', { localMongoUri })
    return res.data
  },
  pauseSync: async () => {
    const res = await api.post('/admin/backup/sync/pause')
    return res.data.syncStatus
  },
  resumeSync: async () => {
    const res = await api.post('/admin/backup/sync/resume')
    return res.data.syncStatus
  },
  stopSync: async () => {
    const res = await api.post('/admin/backup/sync/stop')
    return res.data.syncStatus
  }
}
