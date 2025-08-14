import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import WelcomePage from "./pages/welcome-page"
import LoginPage from "./pages/auth/login-page"
import StudentDashboard from "./pages/dashboard/student-dashboard"
import MyQueuePage from "./pages/queue/my-queue-page"
import JoinQueuePage from "./pages/queue/join-queue-page"
import QueueHistoryPage from "./pages/queue/queue-history-page"
import NotificationsPage from "./pages/notifications/notifications-page"
import { Toaster } from "sonner"
import { AuthProvider } from "./contexts/AuthContext"

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/my-queue" element={<MyQueuePage />} />
          <Route path="/join-queue" element={<JoinQueuePage />} />
          <Route path="/queue-history" element={<QueueHistoryPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>
        <Toaster richColors position="top-center" />
      </Router>
    </AuthProvider>
  )
}
export default App
