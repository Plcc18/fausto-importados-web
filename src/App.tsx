import { Routes, Route, Navigate } from 'react-router-dom'
import { Store } from '@/component/Store'
import { Admin } from '@/component/Admin'
import { SalesReport } from '@/component/SalesReport'
import { AdminLogin } from '@/component/AdminLogin'
import { Toaster } from 'sonner'
import { Termos } from "./component/Termos"
import { Privacidade } from "./component/Privacidade"
import { Cookies } from "./component/Cookies"
import { useEffect, useState } from 'react'
import { API_URL } from "@/lib/api"

// Verifica com o backend se o cookie ainda é válido.
// Retorna "loading" enquanto aguarda, "ok" se autenticado, "denied" se não.
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading")

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, {
      credentials: "include",
    })
      .then((res) => {
        setStatus(res.ok ? "ok" : "denied")
      })
      .catch(() => setStatus("denied"))
  }, [])

  if (status === "loading") return null // ou um spinner se preferir
  if (status === "denied") return <Navigate to="/nexus/login" replace />
  return <>{children}</>
}

export function App() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={<Store />} />
        <Route
          path="/nexus-24"
          element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          }
        />
        <Route path="/nexus-24/login" element={<AdminLogin />} />
        <Route
          path="/nexus-24/relatorio"
          element={
            <PrivateRoute>
              <SalesReport />
            </PrivateRoute>
          }
        />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/cookies" element={<Cookies />} />
      </Routes>
    </>
  )
}