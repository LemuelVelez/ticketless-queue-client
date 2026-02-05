import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import LandingPage from "@/pages/landing"
import LoadingPage from "@/pages/loading"
import LoginPage from "@/pages/authentication/login"
import RegisterPage from "@/pages/authentication/register"
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
import StudentMyTicketsPage from "@/pages/student/my-tickets"
import StudentProfilePage from "@/pages/student/profile"

import AlumniHomePage from "@/pages/alumni/home"
import AlumniJoinPage from "@/pages/alumni/join"
import AlumniMyTicketsPage from "@/pages/alumni/my-tickets"
import AlumniProfilePage from "@/pages/alumni/profile"

import { SessionProvider, useSession } from "@/hooks/use-session"
import { RoleGuard } from "@/lib/roleguard"

type ShortcutTarget = "home" | "join" | "my-tickets" | "profile"

function getShortcutPath(role: string | undefined, target: ShortcutTarget) {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard"
    case "STAFF":
      if (target === "join") return "/staff/queue"
      return "/staff/dashboard"
    case "STUDENT":
      return `/student/${target}`
    case "ALUMNI":
    case "GUEST":
    default:
      return `/alumni/${target}`
  }
}

function LoadingRedirect() {
  const { user, loading } = useSession()

  if (loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />

  return <Navigate to={getShortcutPath(user.role, "home")} replace />
}

function ParticipantShortcutRedirect({ target }: { target: ShortcutTarget }) {
  const { user, loading } = useSession()

  if (loading) return <LoadingPage />

  return <Navigate to={getShortcutPath(user?.role, target)} replace />
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* ✅ Used only during redirect/session resolve */}
          <Route path="/loading" element={<LoadingRedirect />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* ✅ Student routes */}
          <Route path="/student" element={<Navigate to="/student/home" replace />} />
          <Route path="/student/home" element={<StudentHomePage />} />
          <Route path="/student/join" element={<StudentJoinPage />} />
          <Route path="/student/my-tickets" element={<StudentMyTicketsPage />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />

          {/* ✅ Guest/Alumni routes */}
          <Route path="/alumni" element={<Navigate to="/alumni/home" replace />} />
          <Route path="/alumni/home" element={<AlumniHomePage />} />
          <Route path="/alumni/join" element={<AlumniJoinPage />} />
          <Route path="/alumni/my-tickets" element={<AlumniMyTicketsPage />} />
          <Route path="/alumni/profile" element={<AlumniProfilePage />} />

          {/* ✅ Friendly shared shortcuts */}
          <Route path="/home" element={<ParticipantShortcutRedirect target="home" />} />
          <Route path="/join" element={<ParticipantShortcutRedirect target="join" />} />
          <Route path="/my-tickets" element={<ParticipantShortcutRedirect target="my-tickets" />} />
          <Route path="/profile" element={<ParticipantShortcutRedirect target="profile" />} />

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
            <Route path="/admin/audit-logs" element={<AdminAuditsPage />} />
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
