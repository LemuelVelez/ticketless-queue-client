import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import LandingPage from "@/pages/landing"
import LoadingPage from "@/pages/loading"
import LoginPage from "@/pages/authentication/login"
import NotFoundPage from "@/pages/404"

import ForgotPasswordPage from "@/pages/authentication/password/forgot"
import ResetPasswordPage from "@/pages/authentication/password/reset"

import AdminDashboardPage from "@/pages/dashboard/admin/dashboard"
import AdminAccountsPage from "@/pages/dashboard/admin/accounts"
import AdminDepartmentsPage from "@/pages/dashboard/admin/departments"
import AdminWindowsPage from "@/pages/dashboard/admin/windows"
import AdminReportsPage from "@/pages/dashboard/admin/reports"
import AdminAuditsPage from "@/pages/dashboard/admin/audits"
import AdminSettingsPage from "@/pages/dashboard/admin/settings"

import StaffDashboardPage from "@/pages/dashboard/staff/dashboard"
import StaffQueuePage from "@/pages/dashboard/staff/queue"
import StaffServingPage from "@/pages/dashboard/staff/serving"
import StaffDisplayPage from "@/pages/dashboard/staff/display"
import StaffReportsPage from "@/pages/dashboard/staff/reports"
import StaffSettingsPage from "@/pages/dashboard/staff/settings"

import StudentHomePage from "@/pages/student/home"
import StudentJoinPage from "@/pages/student/join"
import StudentDisplayPage from "@/pages/student/display"

import { SessionProvider, useSession } from "@/hooks/use-session"
import { RoleGuard } from "@/lib/roleguard"

function LoadingRedirect() {
  const { user, loading } = useSession()

  // Show loading screen ONLY while resolving session / redirecting
  if (loading) return <LoadingPage />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const to = user.role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"
  return <Navigate to={to} replace />
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* ✅ Public student routes */}
          <Route path="/student" element={<StudentHomePage />} />
          <Route path="/join" element={<StudentJoinPage />} />
          <Route path="/display" element={<StudentDisplayPage />} />

          {/* ✅ Used only during redirect/session resolve */}
          <Route path="/loading" element={<LoadingRedirect />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Supports both:
              /reset-password?token=...
              /reset-password/:token
          */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Admin Routes */}
          <Route
            element={
              <RoleGuard
                allow="ADMIN"
                redirectTo="/login"
                unauthorizedTo="/login"
                loadingFallback={<LoadingPage />}
              >
                <Outlet />
              </RoleGuard>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/accounts" element={<AdminAccountsPage />} />
            <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
            <Route path="/admin/windows" element={<AdminWindowsPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />

            {/* ✅ Audit Logs */}
            <Route path="/admin/audit-logs" element={<AdminAuditsPage />} />

            {/* ✅ Settings */}
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Staff Routes */}
          <Route
            element={
              <RoleGuard
                allow="STAFF"
                redirectTo="/login"
                unauthorizedTo="/login"
                loadingFallback={<LoadingPage />}
              >
                <Outlet />
              </RoleGuard>
            }
          >
            <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
            <Route path="/staff/queue" element={<StaffQueuePage />} />
            <Route path="/staff/now-serving" element={<StaffServingPage />} />
            <Route path="/staff/display" element={<StaffDisplayPage />} />
            <Route path="/staff/reports" element={<StaffReportsPage />} />
            <Route path="/staff/settings" element={<StaffSettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <Toaster />
      </BrowserRouter>
    </SessionProvider>
  )
}
