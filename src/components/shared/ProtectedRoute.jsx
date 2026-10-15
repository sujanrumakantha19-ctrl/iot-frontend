import { Navigate } from 'react-router-dom'
import { getSession } from '../../services/auth'

export default function ProtectedRoute({ children, role }) {
  const session = getSession()
  if (!session) return <Navigate to="/login" replace />
  if (role && session.role !== role) return <Navigate to={`/${session.role}/dashboard`} replace />
  return children
}
