import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/shared/Sidebar'
import TopBar from '../../components/shared/TopBar'

export default function EmployeeLayout() {
  return (
    <div
      style={{ backgroundColor: 'var(--bg-app, #f3f4f6)', color: 'var(--text-primary, #1e293b)' }}
      className="h-screen p-3 sm:p-4 lg:p-5 flex gap-4 overflow-hidden font-sans select-none"
    >
      <Sidebar />
      <div
        style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
        className="flex-1 flex flex-col min-w-0 rounded-2xl border shadow-xs overflow-hidden min-h-0"
      >
        <TopBar title="Employee Dashboard" />
        <main className="flex-1 overflow-y-auto scrollbar-none p-3 sm:p-4 lg:p-6 min-h-0 select-text">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
