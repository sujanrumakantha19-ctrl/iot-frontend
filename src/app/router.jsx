import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import LoginPage from '../features/auth/LoginPage'
import AdminLayout from '../features/admin/AdminLayout'
import AdminDashboard from '../features/admin/DashboardPage'
import CompaniesPage from '../features/admin/CompaniesPage'
import ManagersPage from '../features/admin/ManagersPage'
import EmployeesPage from '../features/admin/EmployeesPage'
import EmployeeDetailPage from '../features/admin/EmployeeDetailPage'
import ManagerDetailPage from '../features/admin/ManagerDetailPage'
import GatewaysPage from '../features/admin/GatewaysPage'
import BackupPage from '../features/admin/BackupPage'
import CompanyDetailPage from '../features/admin/CompanyDetailPage'
import GatewayDetailPage from '../features/admin/GatewayDetailPage'
import ConfigHistoryPage from '../features/admin/ConfigHistoryPage'
import ManagerLayout from '../features/manager/ManagerLayout'
import ManagerDashboard from '../features/manager/DashboardPage'
import TelemetryPage from '../features/manager/TelemetryPage'
import ReportPage from '../features/manager/ReportPage'
import GraphsPage from '../features/manager/GraphsPage'
import EmployeeLayout from '../features/employee/EmployeeLayout'
import EmployeeDashboard from '../features/employee/DashboardPage'
import UsersPage from '../features/manager/UsersPage'
import ThemePage from '../features/shared/ThemePage'
import UserSettingsPage from '../features/shared/UserSettingsPage'
import UserDetailPage from '../features/admin/UserDetailPage'
import AdminSettingsPage from '../features/admin/AdminSettingsPage'
import ThresholdsPage from '../features/shared/ThresholdsPage'
import DigitalMetersPage from '../features/admin/DigitalMetersPage'
import AdminAssetDigitalTwinPage from '../features/admin/AssetDigitalTwinPage'
import GraphsShowcasePage from '../features/admin/GraphsShowcasePage'
import LiveLocationPage from '../features/admin/LiveLocationPage'
import AssignPage from '../features/manager/AssignPage'
import DigitalMetersViewPage from '../features/employee/DigitalMetersViewPage'

import ManagerGatewaysPage from '../features/manager/GatewaysPage'
import ManagerQuickInsightsPage from '../features/manager/QuickInsightsPage'
import ManagerAssetDigitalTwinPage from '../features/manager/AssetDigitalTwinPage'
import EmployeeAssetDigitalTwinPage from '../features/employee/AssetDigitalTwinPage'
import EmployeeAssetTwinDetailPage from '../features/employee/AssetTwinDetailPage'
import EmployeeQuickInsightsPage from '../features/employee/QuickInsightsPage'

import ActivityLogsPage from '../features/admin/ActivityLogsPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="managers" element={<ManagersPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="gateways" element={<GatewaysPage />} />
        <Route path="thresholds" element={<ThresholdsPage />} />
        <Route path="activity-logs" element={<ActivityLogsPage />} />
        <Route path="digital-meters" element={<DigitalMetersPage />} />
        <Route path="asset-digital-twin" element={<AdminAssetDigitalTwinPage />} />
        <Route path="graphs" element={<GraphsShowcasePage />} />
        <Route path="companies/:companyId" element={<CompanyDetailPage />} />
        <Route path="companies/:companyId/gateways/:gatewayId" element={<GatewayDetailPage />} />
        <Route path="companies/:companyId/gateways/:gatewayId/config-history" element={<ConfigHistoryPage />} />
        <Route path="employees/:employeeId" element={<EmployeeDetailPage />} />
        <Route path="managers/:managerId" element={<ManagerDetailPage />} />
        <Route path="users/:userId" element={<UserDetailPage />} />
        <Route path="backup" element={<Navigate to="/admin/settings?tab=backup" replace />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="live-location" element={<LiveLocationPage />} />
        <Route path="theme" element={<Navigate to="/admin/settings?tab=theme" replace />} />
      </Route>

      <Route path="/manager" element={<ProtectedRoute role="manager"><ManagerLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard />} />
        <Route path="tabular-view" element={<TelemetryPage />} />
        <Route path="gateways" element={<ManagerGatewaysPage />} />
        <Route path="gateways/:gatewayId" element={<GatewayDetailPage managerMode={true} />} />
        <Route path="assign" element={<AssignPage />} />
        <Route path="asset-digital-twin" element={<ManagerAssetDigitalTwinPage />} />
        <Route path="thresholds" element={<ThresholdsPage />} />
        <Route path="graphs" element={<GraphsPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="quick-insights" element={<ManagerQuickInsightsPage />} />
        <Route path="settings" element={<UserSettingsPage />} />
        <Route path="theme" element={<Navigate to="/manager/settings?tab=theme" replace />} />
      </Route>

      <Route path="/employee" element={<ProtectedRoute role="employee"><EmployeeLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="tabular-view" element={<TelemetryPage />} />
        <Route path="digital-meters" element={<DigitalMetersViewPage />} />
        <Route path="asset-digital-twin" element={<EmployeeAssetDigitalTwinPage />} />
        <Route path="asset-digital-twin/:instanceId" element={<EmployeeAssetTwinDetailPage />} />
        <Route path="graphs" element={<GraphsPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="quick-insights" element={<EmployeeQuickInsightsPage />} />
        <Route path="settings" element={<UserSettingsPage />} />
        <Route path="theme" element={<Navigate to="/employee/settings?tab=theme" replace />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
