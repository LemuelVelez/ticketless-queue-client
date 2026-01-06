import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import LandingPage from "@/pages/landing"
import LoadingPage from "@/pages/loading"
import LoginPage from "@/pages/authentication/login"
import NotFoundPage from "@/pages/404"

import AdminDashboardPage from "@/pages/dashboard/admin/dashboard"

import { SessionProvider } from "@/hooks/use-session"
import { RoleGuard } from "@/lib/roleguard"

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Routes */}
          <Route
            element={
              <RoleGuard allow="ADMIN" redirectTo="/login" unauthorizedTo="/login">
                <Outlet />
              </RoleGuard>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <Toaster />
      </BrowserRouter>
    </SessionProvider>
  )
}
