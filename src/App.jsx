import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import PilotRegistryPage from './pages/PilotRegistryPage';
import PilotDetailPage from './pages/PilotDetailPage';
import MissionsPage from './pages/MissionsPage';
import MissionDetailPage from './pages/MissionDetailPage';
import FlightLogsPage from './pages/FlightLogsPage';
import FlightLogFormPage from './pages/FlightLogFormPage';
import FlightLogDetailPage from './pages/FlightLogDetailPage';
import DroneRegistryPage from './pages/DroneRegistryPage';
import DroneDetailPage from './pages/DroneDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogsPage from './pages/AuditLogsPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pilots" element={<PilotRegistryPage />} />
          <Route path="/pilots/:id" element={<PilotDetailPage />} />
          <Route path="/missions" element={<MissionsPage />} />
          <Route path="/missions/:id" element={<MissionDetailPage />} />
          <Route path="/flight-logs" element={<FlightLogsPage />} />
          <Route path="/flight-logs/new" element={<FlightLogFormPage />} />
          <Route path="/flight-logs/:id" element={<FlightLogDetailPage />} />
          <Route path="/drones" element={<DroneRegistryPage />} />
          <Route path="/drones/:id" element={<DroneDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/users" element={<UserManagementPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
