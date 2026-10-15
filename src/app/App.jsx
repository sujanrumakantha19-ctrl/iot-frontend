import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import AppRouter from './router'
import { initSocket } from '../services/socketClient'
import { applyTheme, getSession } from '../services/auth'
import api from '../services/axios'

export default function App() {
  useEffect(() => {
    initSocket()
    
    // Apply saved theme preference on mount immediately
    const session = getSession()
    applyTheme(session?.themePreference)

    // Sync latest theme preference from DB in background if authenticated
    if (session?.token) {
      api.get('/auth/preferences')
        .then(res => {
          if (res.data?.success && res.data?.themePreference) {
            const dbTheme = res.data.themePreference
            const currentSession = getSession()
            if (currentSession && currentSession.themePreference !== dbTheme) {
              currentSession.themePreference = dbTheme
              localStorage.setItem('iot_session', JSON.stringify(currentSession))
              applyTheme(dbTheme)
            }
          }
        })
        .catch(err => {
          console.debug('Failed to sync background theme preference:', err.message)
        })
    }
  }, [])

  return (
    <BrowserRouter>
      <AppRouter />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="light" />
    </BrowserRouter>
  )
}
