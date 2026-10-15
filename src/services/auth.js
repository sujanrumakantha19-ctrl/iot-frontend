import api from './axios'

import { disconnectSocket } from './socketClient'

const SESSION_KEY = 'iot_session'

export function applyTheme(themeId) {
  const theme = themeId || 'default'
  document.body.className = theme === 'default' ? 'theme-default' : `theme-${theme}`
}

export async function login(email, password) {
  const response = await api.post('/auth/login', { email, password })
  if (response.data?.success && response.data?.session) {
    const session = response.data.session
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    applyTheme(session.themePreference)
    return session
  }
  return null
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('manager_selected_employee')
  applyTheme('default')
  disconnectSocket()
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return !!getSession()
}

export function hasRole(role) {
  const session = getSession()
  return session?.role === role
}

export async function getMe() {
  const response = await api.get('/auth/me')
  return response.data
}
