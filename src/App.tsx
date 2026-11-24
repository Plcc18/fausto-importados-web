import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Store } from '@/component/Store'
import { Toaster } from 'sonner'
import { Termos } from "./component/Termos"
import { Privacidade } from "./component/Privacidade"
import { Cookies } from "./component/Cookies"
import { authClient, useAuthStatus } from "@/lib/auth"
import { HttpError, errorCodeFromError, type ErrorCode } from "@/lib/httpErrors"
import { ROUTES, ERROR_ROUTE_PATTERN } from "@/routes"
import { AppErrorBoundary } from "@/component/errors/AppErrorBoundary"
import { ErrorView, ErrorRoutePage, NotFoundPage } from "@/component/errors/ErrorView"

// O painel administrativo (e a tela de login, que traz o QR code do 2FA) ficam em chunks próprios: o código só é
// baixado quando alguém realmente chega lá — e, no caso do painel, só depois de a API confirmar que é um administrador.
const Admin = lazy(() => import('@/admin/Admin').then((m) => ({ default: m.Admin })))
const SalesReport = lazy(() => import('@/admin/SalesReport').then((m) => ({ default: m.SalesReport })))
const ReauthPromptHost = lazy(() => import('@/admin/ReauthPromptHost').then((m) => ({ default: m.ReauthPromptHost })))
const AdminUsers = lazy(() => import('@/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })))
const Login = lazy(() => import('@/component/Login').then((m) => ({ default: m.Login })))

// Resultado da verificação com o backend:
// "loading" aguardando · "ok" administrador · "login" sem sessão (→ entrar)
// "forbidden" autenticado, mas sem permissão (usuário comum, ou 403) · ErrorCode = falha ao falar com o servidor.
type GuardState = "loading" | "ok" | "login" | "forbidden" | { error: ErrorCode }

/**
 * Só deixa passar quem a API confirma como ADMIN (papel vindo de /auth/me). O filho — e portanto o chunk do painel —
 * só é montado depois disso. Isto é conveniência de interface: cada rota da API valida o papel por conta própria.
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("loading")
  const [attempt, setAttempt] = useState(0)
  // Reage à sessão em tempo real: logout em outra aba, sessão revogada ou inatividade → volta ao login
  const session = useAuthStatus()
  const { pathname, search } = useLocation()

  useEffect(() => {
    let cancelled = false

    // O access token vive só em memória e some ao recarregar a página: recupera a sessão pelo cookie de
    // refresh e descobre o papel em /auth/me.
    void authClient.restoreSession().then((result) => {
      if (cancelled) return
      switch (result.kind) {
        case "ok":
          return setState(result.profile.role === "ADMIN" ? "ok" : "forbidden")
        case "anonymous":
          return setState("login")
        case "forbidden":
          return setState("forbidden")
        default:
          // Falha de rede/5xx não significa "sem sessão": não manda o admin para o login à toa
          return setState({
            error: result.httpStatus && result.httpStatus >= 500
              ? errorCodeFromError(new HttpError(result.httpStatus))
              : "connection",
          })
      }
    })

    return () => {
      cancelled = true
    }
  }, [attempt])

  if (state === "loading") return null // ou um spinner se preferir
  if (state === "login" || (state === "ok" && session === "anonymous")) {
    return <Navigate to={`${ROUTES.login}?next=${encodeURIComponent(pathname + search)}`} replace />
  }
  if (state === "forbidden") return <ErrorView code="403" />
  if (typeof state === "object") {
    return (
      <ErrorView
        code={state.error}
        onRetry={() => {
          setState("loading")
          setAttempt((n) => n + 1)
        }}
      />
    )
  }
  return (
    <Suspense fallback={null}>
      <ReauthPromptHost />
      {children}
    </Suspense>
  )
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
          path={ROUTES.login}
          element={
            <Suspense fallback={null}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.admin}
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route
          path={ROUTES.adminReport}
          element={
            <RequireAdmin>
              <SalesReport />
            </RequireAdmin>
          }
        />
        <Route
          path={ROUTES.adminUsers}
          element={
            <RequireAdmin>
              <AdminUsers />
            </RequireAdmin>
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
