import { useSyncExternalStore } from "react"
import { AUTH_URL } from "@/lib/api"
import { AuthClient, DEFAULT_IDLE_TIMEOUT_MS, type AuthStatus, type Profile } from "./authClient"

export { AuthClient } from "./authClient"
export type {
  AuthStatus,
  LoginResult,
  MfaConfirmResult,
  MfaSetupInfo,
  MfaSetupResult,
  MfaVerifyResult,
  Profile,
  ReauthPromptReason,
  ReauthResult,
  RefreshOutcome,
  RestoreResult,
  Role,
} from "./authClient"
export { hasSessionHint } from "./sessionHint"

/**
 * Instância única da aplicação. Não abre canal nem listeners até alguém usá-la
 * (páginas públicas da loja não pagam nenhum custo).
 *
 * `VITE_IDLE_TIMEOUT_MS`: tempo sem interação após o qual a sessão deixa de ser renovada (padrão 7 dias).
 */
export const authClient = new AuthClient({
  authUrl: AUTH_URL,
  idleTimeoutMs: Number(import.meta.env.VITE_IDLE_TIMEOUT_MS) || DEFAULT_IDLE_TIMEOUT_MS,
})

/** `fetch` para rotas autenticadas: injeta o Bearer, renova em 401 (single-flight) e refaz a requisição. */
export const authFetch = (url: string, options: RequestInit = {}) => authClient.fetch(url, options)

/** Estado da sessão ("unknown" | "authenticated" | "anonymous"), reativo — inclusive a logout em outra aba. */
export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(authClient.subscribe, authClient.getStatus, authClient.getStatus)
}

/** Quem está logado (`null` até ser conhecido, ou sem sessão), reativo. */
export function useAuthProfile(): Profile | null {
  return useSyncExternalStore(authClient.subscribe, authClient.getProfile, authClient.getProfile)
}
