import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import { HttpError, errorCodeFromError, type ErrorCode } from "@/lib/httpErrors"
import { ROUTES, ERROR_ROUTE_PATTERN } from "@/routes"
import { AppErrorBoundary } from "@/component/errors/AppErrorBoundary"
import { ErrorView, ErrorRoutePage, NotFoundPage } from "@/component/errors/ErrorView"

// Verifica com o backend se o cookie ainda é válido.
// "loading" enquanto aguarda · "ok" autenticado · "denied" não autenticado (→ login)
// "forbidden" autenticado sem permissão (403) · ErrorCode = falha ao falar com o servidor.
type AuthStatus = "loading" | "ok" | "denied" | "forbidden" | { error: ErrorCode }

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/auth/me`, { credentials: "include", signal: controller.signal })
      .then((res) => {
        if (res.ok) return setStatus("ok")
        if (res.status === 403) return setStatus("forbidden")
        if (res.status >= 500) return setStatus({ error: errorCodeFromError(new HttpError(res.status)) })
        setStatus("denied") // 401 e demais 4xx: sessão inválida → login
      })
      .catch(() => {
        // Falha de rede não significa "sem sessão": não manda o admin para o login à toa
        if (!controller.signal.aborted) setStatus({ error: "connection" })
      })
    return () => controller.abort()
  }, [attempt])

  if (status === "loading") return null // ou um spinner se preferir
  if (status === "denied") return <Navigate to={ROUTES.adminLogin} replace />
  if (status === "forbidden") return <ErrorView code="403" />
  if (typeof status === "object") {
    return (
      <ErrorView
        code={status.error}
        onRetry={() => {
          setStatus("loading")
          setAttempt((n) => n + 1)
        }}
      />
    )
  }
  return <>{children}</>
}

export function App() {
  const { pathname } = useLocation()
  return (
    <>
      <Toaster
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties
        }
      />
      <AppErrorBoundary resetKey={pathname}>
      <Routes>
        <Route path={ROUTES.home} element={<Store />} />
        <Route
          path={ROUTES.admin}
          element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          }
        />
        <Route path={ROUTES.adminLogin} element={<AdminLogin />} />
        <Route
          path={ROUTES.adminReport}
          element={
            <PrivateRoute>
              <SalesReport />
            </PrivateRoute>
          }
        />
        <Route path={ROUTES.terms} element={<Termos />} />
        <Route path={ROUTES.privacy} element={<Privacidade />} />
        <Route path={ROUTES.cookies} element={<Cookies />} />
        <Route path={ERROR_ROUTE_PATTERN} element={<ErrorRoutePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </AppErrorBoundary>
    </>
  )
}