import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import LandingPage from './pages/LandingPage'
import StudentInterface from './pages/StudentInterface'
import ServiceStaffInterface from './pages/ServiceStaffInterface'
import AdminDashboard from './pages/AdminDashboard'
import QueueDisplay from './pages/QueueDisplay'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { QueueProvider } from './contexts/QueueContext'
import './App.css'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading JRMSU Queue System...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/student" element={<StudentInterface />} />
      <Route path="/staff" element={
        user?.role === 'staff' || user?.role === 'manager' || user?.role === 'admin' ?
          <ServiceStaffInterface /> :
          <Navigate to="/login" />
      } />
      <Route path="/admin" element={
        user?.role === 'admin' ?
          <AdminDashboard /> :
          <Navigate to="/login" />
      } />
      <Route path="/display/:servicePoint" element={<QueueDisplay />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <QueueProvider>
        <Router>
          <div className="App">
            <AppRoutes />
            <Toaster position="top-right" />
          </div>
        </Router>
      </QueueProvider>
    </AuthProvider>
  )
}

export default App
