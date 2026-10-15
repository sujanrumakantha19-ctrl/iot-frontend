import { getSession } from './auth'

class DownloadManager {
  constructor() {
    this.listeners = new Set()
    this.state = this.loadInitialState()
    this.abortController = null
  }

  loadInitialState() {
    try {
      const saved = localStorage.getItem('admin_active_download')
      if (saved) {
        const parsed = JSON.parse(saved)
        // If it was left as downloading when page was killed, mark completed or idle
        if (parsed.status === 'downloading') {
          parsed.status = 'idle'
          parsed.percent = 0
        }
        return parsed
      }
    } catch (e) {
      console.error('Failed to parse saved download state:', e)
    }
    return {
      active: false,
      filename: '',
      percent: 0,
      receivedBytes: 0,
      totalBytes: 0,
      speed: '0 KB/s',
      eta: '0s',
      status: 'idle',
      error: null
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  notify() {
    localStorage.setItem('admin_active_download', JSON.stringify(this.state))
    this.listeners.forEach(listener => listener(this.state))
  }

  getState() {
    return this.state
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s'
    if (bytesPerSec >= 1048576) {
      return (bytesPerSec / 1048576).toFixed(1) + ' MB/s'
    }
    return Math.round(bytesPerSec / 1024) + ' KB/s'
  }

  formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0s'
    if (seconds < 60) return `${Math.ceil(seconds)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.ceil(seconds % 60)
    return `${mins}m ${secs}s`
  }

  cancelDownload() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.state = {
      active: false,
      filename: '',
      percent: 0,
      receivedBytes: 0,
      totalBytes: 0,
      speed: '0 KB/s',
      eta: '0s',
      status: 'idle',
      error: 'Download canceled by user'
    }
    this.notify()
  }

  async startDownload(scope, companyId = null, format = 'json', companyName = '') {
    if (this.state.active && this.state.status === 'downloading') {
      return
    }

    const session = getSession()
    const token = session?.token
    const baseUrl = '/api/admin'
    const endpoint = scope === 'company'
      ? `${baseUrl}/backup/stream-export/${companyId}?format=${format}`
      : `${baseUrl}/backup/stream-export?format=${format}`

    const filename = scope === 'company'
      ? `company-${(companyName || 'export').toLowerCase().replace(/\s+/g, '-')}-backup.${format}`
      : `full-system-backup.${format}`

    this.abortController = new AbortController()

    this.state = {
      active: true,
      filename,
      percent: 0,
      receivedBytes: 0,
      totalBytes: 0,
      speed: '0 KB/s',
      eta: 'Estimating...',
      status: 'downloading',
      error: null
    }
    this.notify()

    const startTime = Date.now()
    let lastSampleTime = startTime
    let lastSampleBytes = 0

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: this.abortController.signal
      })

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`)
      }

      const contentLengthStr = response.headers.get('x-total-bytes') || response.headers.get('content-length')
      const totalBytes = contentLengthStr ? parseInt(contentLengthStr, 10) : 0
      this.state.totalBytes = totalBytes
      this.notify()

      const reader = response.body.getReader()
      const chunks = []
      let receivedBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        receivedBytes += value.length

        const now = Date.now()
        const elapsedSec = (now - startTime) / 1000
        const sampleTimeDiff = (now - lastSampleTime) / 1000

        // Calculate speed over moving window
        let speedBytesPerSec = 0
        if (sampleTimeDiff >= 0.15) {
          speedBytesPerSec = (receivedBytes - lastSampleBytes) / sampleTimeDiff
          lastSampleTime = now
          lastSampleBytes = receivedBytes
        } else {
          speedBytesPerSec = receivedBytes / (elapsedSec || 1)
        }

        let percent = 0
        let etaSec = 0

        if (totalBytes > 0) {
          percent = Math.min(99, Math.max(1, Math.round((receivedBytes / totalBytes) * 100)))
          const remainingBytes = Math.max(0, totalBytes - receivedBytes)
          etaSec = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0
        } else {
          percent = Math.min(95, Math.max(1, Math.round((receivedBytes / (500 * 1024)) * 10)))
          const averageSpeed = receivedBytes / (elapsedSec || 1)
          etaSec = averageSpeed > 0 ? Math.max(1, Math.ceil((5 * 1024 * 1024 - receivedBytes) / averageSpeed)) : 0
        }

        this.state = {
          active: true,
          filename,
          percent,
          receivedBytes,
          totalBytes,
          speed: this.formatSpeed(speedBytesPerSec),
          eta: this.formatTime(etaSec),
          status: 'downloading',
          error: null
        }
        this.notify()
      }

      // Assemble file download
      const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;'
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      this.state = {
        active: true,
        filename,
        percent: 100,
        receivedBytes,
        totalBytes: receivedBytes,
        speed: 'Done',
        eta: 'Completed',
        status: 'completed',
        error: null
      }
      this.notify()

      // Reset to idle after 5 seconds
      setTimeout(() => {
        if (this.state.status === 'completed') {
          this.state.active = false
          this.state.status = 'idle'
          this.notify()
        }
      }, 5000)

    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Download stream error:', err)
      this.state = {
        active: true,
        filename,
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        speed: '0 KB/s',
        eta: '0s',
        status: 'error',
        error: err.message || 'Stream download failed'
      }
      this.notify()
    } finally {
      this.abortController = null
    }
  }
}

export const downloadManager = new DownloadManager()
