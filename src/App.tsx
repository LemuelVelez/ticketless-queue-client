import { BrowserRouter, Routes, Route } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import LandingPage from "@/pages/landing"
import LoadingPage from "@/pages/loading"
import LoginPage from "@/pages/authentication/login"
import NotFoundPage from "@/pages/404"
import AdminOverviewPage from "@/pages/dashboard/admin/overview"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin */}
        <Route path="/dashboard/admin/overview" element={<AdminOverviewPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <Toaster />
    </BrowserRouter>
  )
}
