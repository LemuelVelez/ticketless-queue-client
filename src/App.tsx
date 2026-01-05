import { BrowserRouter, Routes, Route } from "react-router-dom"

import LandingPage from "@/pages/landing"
import LoadingPage from "@/pages/loading"
import NotFoundPage from "@/pages/404"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
