import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import WelcomePage from "./pages/welcome-page"
import LoginPage from "./pages/auth/login-page"
import RegisterPage from "./pages/auth/register-page"
import ForgotPasswordPage from "./pages/auth/forgot-password-page"
import ResetPasswordPage from "./pages/auth/reset-password-page"
import StudentDashboard from "./pages/dashboard/student/student-dashboard"
import MyQueuePage from "./pages/dashboard/student/queue/my-queue-page"
import JoinQueuePage from "./pages/dashboard/student/queue/join-queue-page"
import QueueHistoryPage from "./pages/dashboard/student/queue/queue-history-page"
import NotificationsPage from "./pages/dashboard/student/notifications/notifications-page"
import AccountSettingsPage from "./pages/dashboard/student/settings/account-settings-page"
import HelpSupportPage from "./pages/dashboard/student/help/help-support-page"
import { Toaster } from "sonner"
import { AuthProvider } from "./contexts/AuthContext"

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Student side (only dashboard currently implemented) */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/my-queue" element={<MyQueuePage />} />
          <Route path="/join-queue" element={<JoinQueuePage />} />
          <Route path="/queue-history" element={<QueueHistoryPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Settings & Help */}
          <Route path="/settings" element={<AccountSettingsPage />} />
          <Route path="/help" element={<HelpSupportPage />} />
        </Routes>
        <Toaster richColors position="top-center" />
      </Router>
    </AuthProvider>
  )
}
export default App
