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
import { AUTH_URL } from "@/lib/api"
import { authClient, authFetch, useAuthStatus } from "@/lib/auth"
import { HttpError, errorCodeFromError, type ErrorCode } from "@/lib/httpErrors"
import { ROUTES, ERROR_ROUTE_PATTERN } from "@/routes"
import { AppErrorBoundary } from "@/component/errors/AppErrorBoundary"
import { ErrorView, ErrorRoutePage, NotFoundPage } from "@/component/errors/ErrorView"

// Verifica com o backend se a sessão ainda é válida.
// "loading" enquanto aguarda · "ok" autenticado · "denied" não autenticado (→ login)
// "forbidden" autenticado sem permissão (403) · ErrorCode = falha ao falar com o servidor.
type RouteStatus = "loading" | "ok" | "denied" | "forbidden" | { error: ErrorCode }

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<RouteStatus>("loading")
  const [attempt, setAttempt] = useState(0)
  // Reage à sessão em tempo real: logout em outra aba, sessão revogada ou inatividade → volta ao login
  const session = useAuthStatus()

  useEffect(() => {
    const controller = new AbortController()

    const verify = async () => {
      // O access token vive só em memória e some ao recarregar a página:
      // recupera a sessão pelo cookie de refresh antes de consultar /auth/me.
      if (!authClient.hasSession()) {
        const boot = await authClient.bootstrap()
        if (controller.signal.aborted) return
        if (boot.kind === "denied" || boot.kind === "idle") return setStatus("denied")
        if (boot.kind === "error") {
          // Falha de rede/5xx não significa "sem sessão": não manda o admin para o login à toa
          const code = boot.httpStatus && boot.httpStatus >= 500
            ? errorCodeFromError(new HttpError(boot.httpStatus))
            : "connection"
          return setStatus({ error: code })
        }
      }

      try {
        const res = await authFetch(`${AUTH_URL}/auth/me`, { signal: controller.signal })
        if (controller.signal.aborted) return
        if (res.ok) return setStatus("ok")
        if (res.status === 403) return setStatus("forbidden")
        if (res.status >= 500) return setStatus({ error: errorCodeFromError(new HttpError(res.status)) })
        setStatus("denied") // 401 (já tentou renovar) e demais 4xx: sessão inválida → login
      } catch {
        if (!controller.signal.aborted) setStatus({ error: "connection" })
      }
    }

    void verify()
    return () => controller.abort()
  }, [attempt])

  if (status === "loading") return null // ou um spinner se preferir
  if (status === "denied" || (status === "ok" && session === "anonymous")) {
    return <Navigate to={ROUTES.adminLogin} replace />
  }
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