import { useEffect, useState } from "react"
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"

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
import {
  clearParticipantSession,
  getParticipantToken,
  getParticipantUser,
} from "@/lib/auth"
import { RoleGuard } from "@/lib/roleguard"
import type { UserRole } from "@/lib/rolebase"

type ShortcutTarget = "home" | "join" | "my-tickets" | "profile"
type ParticipantRole = "STUDENT" | "ALUMNI" | "ALUMNI_VISITOR" | "GUEST"
type ParticipantResolveState = ParticipantRole | null | "__CHECKING__"

function normalizeParticipantRole(raw: unknown): ParticipantRole | null {
  const value = String(raw ?? "").trim().toUpperCase()

  if (value === "STUDENT") return "STUDENT"
  if (value === "ALUMNI") return "ALUMNI"
  if (
    value === "ALUMNI_VISITOR" ||
    value === "ALUMNI-VISITOR" ||
    value === "ALUMNI VISITOR"
  ) {
    return "ALUMNI_VISITOR"
  }
  if (value === "GUEST" || value === "VISITOR") return "GUEST"

  return null
}

function resolveParticipantRole(): ParticipantRole | null {
  const token = getParticipantToken()
  if (!token) return null

  const storedParticipant = getParticipantUser()
  const role = normalizeParticipantRole(
    storedParticipant?.type ??
      (storedParticipant as { role?: unknown } | null)?.role
  )

  if (!role) {
    clearParticipantSession()
    return null
  }

  return role
}

function getShortcutPath(role: UserRole, target: ShortcutTarget) {
  if (role === "ADMIN") {
    return "/admin/dashboard"
  }

  return target === "join" ? "/staff/queue" : "/staff/dashboard"
}

function getParticipantShortcutPath(
  role: ParticipantRole,
  target: ShortcutTarget
) {
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
  const [participantRole, setParticipantRole] =
    useState<ParticipantResolveState>("__CHECKING__")

  useEffect(() => {
    if (user) return
    setParticipantRole(resolveParticipantRole())
  }, [location.pathname, user])

  if (userLoading) return <LoadingPage />

  if (user) {
    return <Navigate to={getShortcutPath(user.role, "home")} replace />
  }

  if (participantRole === "__CHECKING__") return <LoadingPage />

  if (!participantRole) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: location.pathname } }}
      />
    )
  }

  if (allow === "student" && participantRole !== "STUDENT") {
    return <Navigate to={getParticipantHomePath(participantRole)} replace />
  }

  if (allow === "alumni" && participantRole === "STUDENT") {
    return <Navigate to="/student/home" replace />
  }

  return <Outlet />
}

function ParticipantShortcutGuestRedirect({
  target,
}: {
  target: ShortcutTarget
}) {
  const [participantRole, setParticipantRole] = useState<ParticipantRole | null>(
    null
  )
  const [checkingParticipant, setCheckingParticipant] = useState(true)

  useEffect(() => {
    const role = resolveParticipantRole()
    setParticipantRole(role)
    setCheckingParticipant(false)
  }, [])

  if (checkingParticipant) return <LoadingPage />

  if (!participantRole) {
    return <Navigate to="/login" replace />
  }

  return (
    <Navigate to={getParticipantShortcutPath(participantRole, target)} replace />
  )
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

          <Route path="/loading" element={<LoadingRedirect />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/authentication/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          <Route element={<ParticipantAreaGuard allow="student" />}>
            <Route
              path="/student"
              element={<Navigate to="/student/home" replace />}
            />
            <Route path="/student/home" element={<StudentHomePage />} />
            <Route path="/student/join" element={<StudentJoinPage />} />
            <Route
              path="/student/my-tickets"
              element={<StudentMyTicketsPage />}
            />
            <Route path="/student/profile" element={<StudentProfilePage />} />
          </Route>

          <Route element={<ParticipantAreaGuard allow="alumni" />}>
            <Route
              path="/alumni"
              element={<Navigate to="/alumni/home" replace />}
            />
            <Route path="/alumni/home" element={<AlumniHomePage />} />
            <Route path="/alumni/join" element={<AlumniJoinPage />} />
            <Route
              path="/alumni/my-tickets"
              element={<AlumniMyTicketsPage />}
            />
            <Route path="/alumni/profile" element={<AlumniProfilePage />} />
          </Route>

          <Route
            path="/home"
            element={<ParticipantShortcutRedirect target="home" />}
          />
          <Route
            path="/join"
            element={<ParticipantShortcutRedirect target="join" />}
          />
          <Route
            path="/my-tickets"
            element={<ParticipantShortcutRedirect target="my-tickets" />}
          />
          <Route
            path="/profile"
            element={<ParticipantShortcutRedirect target="profile" />}
          />

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
            <Route
              path="/admin/departments"
              element={<AdminDepartmentsPage />}
            />
            <Route path="/admin/windows" element={<AdminWindowsPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Route>

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