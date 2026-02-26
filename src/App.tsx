import { useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom"

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
import QueueControlCenterPage from "@/pages/dashboard/staff/QueueControlCenter"
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

import { guestApi, participantAuthStorage } from "@/api/guest"
import { SessionProvider, useSession } from "@/hooks/use-session"
import { RoleGuard } from "@/lib/roleguard"

type ShortcutTarget = "home" | "join" | "my-tickets" | "profile"
type ParticipantRole = "STUDENT" | "ALUMNI_VISITOR" | "GUEST"
type ParticipantResolveState = ParticipantRole | null | "__CHECKING__"

function normalizeParticipantRole(raw: unknown): ParticipantRole | null {
  const value = String(raw ?? "").trim().toUpperCase()
  if (value === "STUDENT") return "STUDENT"
  if (value === "ALUMNI_VISITOR" || value === "ALUMNI-VISITOR") return "ALUMNI_VISITOR"
  if (value === "GUEST" || value === "VISITOR") return "GUEST"
  return null
}

async function resolveParticipantRole(): Promise<ParticipantRole | null> {
  const token = participantAuthStorage.getToken()
  if (!token) return null

  try {
    const session = await guestApi.getSession()
    const role = normalizeParticipantRole(session?.participant?.type)
    if (!role) {
      participantAuthStorage.clearToken()
      return null
    }
    return role
  } catch {
    participantAuthStorage.clearToken()
    return null
  }
}

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

function getParticipantShortcutPath(role: ParticipantRole, target: ShortcutTarget) {
  return role === "STUDENT" ? `/student/${target}` : `/alumni/${target}`
}

function getParticipantHomePath(role: ParticipantRole) {
  return role === "STUDENT" ? "/student/home" : "/alumni/home"
}

function LoadingRedirect() {
  const { user, loading } = useSession()

  if (loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />

  return <Navigate to={getShortcutPath(user.role, "home")} replace />
}

function ParticipantAreaGuard({ allow }: { allow: "student" | "alumni" }) {
  const location = useLocation()
  const { user, loading: userLoading } = useSession()

  const [participantRole, setParticipantRole] = useState<ParticipantResolveState>("__CHECKING__")

  useEffect(() => {
    let alive = true

    // If staff/admin session exists, do not treat this as "not logged in participant".
    if (user) {
      return () => {
        alive = false
      }
    }

    ;(async () => {
      // Avoid synchronous setState in effect body
      await Promise.resolve()
      if (!alive) return
      setParticipantRole("__CHECKING__")

      const role = await resolveParticipantRole()
      if (!alive) return
      setParticipantRole(role)
    })()

    return () => {
      alive = false
    }
  }, [location.pathname, user])

  if (userLoading) return <LoadingPage />

  // Redirect authenticated staff/admin away from participant-only pages
  if (user) {
    return <Navigate to={getShortcutPath(user.role, "home")} replace />
  }

  if (participantRole === "__CHECKING__") return <LoadingPage />

  if (!participantRole) {
    return <Navigate to="/login" replace state={{ from: { pathname: location.pathname } }} />
  }

  if (allow === "student" && participantRole !== "STUDENT") {
    return <Navigate to={getParticipantHomePath(participantRole)} replace />
  }

  if (allow === "alumni" && participantRole === "STUDENT") {
    return <Navigate to="/student/home" replace />
  }

  return <Outlet />
}

function ParticipantShortcutGuestRedirect({ target }: { target: ShortcutTarget }) {
  const [participantRole, setParticipantRole] = useState<ParticipantRole | null>(null)
  const [checkingParticipant, setCheckingParticipant] = useState(true)

  useEffect(() => {
    let alive = true

    ;(async () => {
      const role = await resolveParticipantRole()
      if (!alive) return
      setParticipantRole(role)
      setCheckingParticipant(false)
    })()

    return () => {
      alive = false
    }
  }, [])

  if (checkingParticipant) return <LoadingPage />

  if (!participantRole) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getParticipantShortcutPath(participantRole, target)} replace />
}

function ParticipantShortcutRedirect({ target }: { target: ShortcutTarget }) {
  const { user, loading } = useSession()

  if (loading) return <LoadingPage />

  if (user) {
    return <Navigate to={getShortcutPath(user.role, target)} replace />
  }

  return <ParticipantShortcutGuestRedirect target={target} />
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
          <Route path="/authentication/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* ✅ Student routes (participant-auth required) */}
          <Route element={<ParticipantAreaGuard allow="student" />}>
            <Route path="/student" element={<Navigate to="/student/home" replace />} />
            <Route path="/student/home" element={<StudentHomePage />} />
            <Route path="/student/join" element={<StudentJoinPage />} />
            <Route path="/student/my-tickets" element={<StudentMyTicketsPage />} />
            <Route path="/student/profile" element={<StudentProfilePage />} />
          </Route>

          {/* ✅ Guest/Alumni routes (participant-auth required) */}
          <Route element={<ParticipantAreaGuard allow="alumni" />}>
            <Route path="/alumni" element={<Navigate to="/alumni/home" replace />} />
            <Route path="/alumni/home" element={<AlumniHomePage />} />
            <Route path="/alumni/join" element={<AlumniJoinPage />} />
            <Route path="/alumni/my-tickets" element={<AlumniMyTicketsPage />} />
            <Route path="/alumni/profile" element={<AlumniProfilePage />} />
          </Route>

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

            {/* Existing Queue route (kept for compatibility) */}
            <Route path="/staff/queue" element={<QueueControlCenterPage />} />

            {/* New route for Queue Control Center */}
            <Route path="/staff/queue-control-center" element={<QueueControlCenterPage />} />

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