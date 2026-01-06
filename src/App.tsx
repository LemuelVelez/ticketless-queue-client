import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import LandingPage from "@/pages/landing"
import LoadingPage from "@/pages/loading"
import LoginPage from "@/pages/authentication/login"
import NotFoundPage from "@/pages/404"

import AdminDashboardPage from "@/pages/dashboard/admin/dashboard"
import AdminAccountsPage from "@/pages/dashboard/admin/accounts"

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

          {/* ✅ Used only during redirect/session resolve */}
          <Route path="/loading" element={<LoadingRedirect />} />

          <Route path="/login" element={<LoginPage />} />

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
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <Toaster />
      </BrowserRouter>
    </SessionProvider>
  )
}
