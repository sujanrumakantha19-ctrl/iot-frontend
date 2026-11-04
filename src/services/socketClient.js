import { io } from 'socket.io-client'
import { getSession } from './auth'
import { resolveSocketUrl } from '../utils/socketUrl'

let socket = null

export const initSocket = () => {
  if (socket) return socket

  const session = getSession()
  if (!session) return null

  const envUrl = import.meta.env.VITE_SOCKET_URL
  const socketUrl = resolveSocketUrl(window.location, envUrl)
  console.log('[Socket] Connecting to:', socketUrl)
  
  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    secure: window.location.protocol === 'https:'
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected to server, sending join...')
    socket.emit('join', {
      userId: session.userId,
      role: session.role,
      companyId: session.companyId,
      employeeId: session.role === 'employee' ? session.userId : undefined
    })
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message)
  })

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log('[Socket] Reconnect attempt:', attempt)
  })

  return socket
}

export const getSocket = () => {
  if (!socket) {
    return initSocket()
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
