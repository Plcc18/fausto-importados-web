/**
 * Cliente de autenticação: access token só em memória + refresh token em cookie HttpOnly (gerido pelo browser).
 *
 *  - O access token NUNCA vai para localStorage/sessionStorage: recarregar a página o perde, e o `bootstrap()`
 *    pede um novo ao servidor usando o cookie.
 *  - Renovação proativa ~1 min antes de expirar e também ao receber 401, em "single-flight": várias requisições
 *    com 401 ao mesmo tempo disparam UMA única chamada de refresh; as demais esperam e são refeitas.
 *  - Entre abas: Web Locks serializa o refresh e o BroadcastChannel propaga token, atividade e logout.
 *  - Se o usuário ficar sem interagir além de `idleTimeoutMs`, a sessão não é mais renovada.
 *  - Login em passos: senha → (administrador) código 2FA → sessão. O cadastro do 2FA também passa por aqui.
 *  - Operações sensíveis pedem uma "reautenticação" (código 2FA recente): ver `sensitiveFetch`.
 */

import { clearSessionHint, setSessionHint } from "./sessionHint"

export type AuthStatus = "unknown" | "authenticated" | "anonymous"

export type RefreshOutcome =
  | { kind: "ok"; token: string }
  | { kind: "denied" } // servidor recusou: sessão encerrada
  | { kind: "idle" } // usuário inativo além do prazo: nem tentamos renovar
  | { kind: "error"; httpStatus?: number } // falha de rede/5xx: não é "sem sessão"

export type Role = "ADMIN" | "USER"

/** Quem está logado, como a API informa em `/auth/me`. O front usa para decidir o que mostrar; a API revalida sempre. */
export interface Profile {
  email: string
  role: Role
}

export type ProfileResult =
  | { kind: "ok"; profile: Profile }
  | { kind: "denied" } // 401: sem sessão válida
  | { kind: "forbidden" } // 403
  | { kind: "error"; httpStatus?: number } // rede/5xx

/** Recuperar a sessão (refresh + /auth/me) ao abrir a página. */
export type RestoreResult =
  | { kind: "ok"; profile: Profile }
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { kind: "error"; httpStatus?: number }

export type LoginResult =
  | { kind: "authenticated" }
  | { kind: "mfa-required"; challenge: string } // administrador: falta o código do autenticador
  | { kind: "mfa-setup"; challenge: string; passwordChangeRequired: boolean } // conta sem 2FA ainda
  | { kind: "denied" } // credenciais recusadas (a causa não é revelada)
  | { kind: "locked"; retryAfterSeconds: number } // muitas tentativas

export type MfaVerifyResult =
  | { kind: "authenticated" }
  | { kind: "invalid-code" }
  | { kind: "challenge-expired" } // recomeçar pela senha
  | { kind: "locked"; retryAfterSeconds: number }

export interface MfaSetupInfo {
  /** Chave em Base32, para digitar no aplicativo. */
  secret: string
  /** URI `otpauth://` que vira o QR code. */
  otpauthUri: string
}

export type MfaSetupResult =
  | { kind: "ok"; info: MfaSetupInfo }
  | { kind: "challenge-expired" }
  | { kind: "locked"; retryAfterSeconds: number }
  | { kind: "error" }

export type MfaConfirmResult =
  | { kind: "authenticated"; recoveryCodes: string[] }
  | { kind: "invalid-code" }
  | { kind: "weak-password"; message: string }
  | { kind: "challenge-expired" }
  | { kind: "locked"; retryAfterSeconds: number }
  | { kind: "error" }

export type ReauthResult =
  | { kind: "ok" }
  | { kind: "invalid-code" }
  | { kind: "locked"; retryAfterSeconds: number }
  | { kind: "error" }

/** Por que o código está sendo pedido de novo ao usuário. */
export type ReauthPromptReason = "invalid" | "locked" | undefined

export type AuthMessage =
  | { type: "token"; token: string; expiresAt: number }
  | { type: "activity"; at: number }
  | { type: "logout" }

/** Subconjunto do BroadcastChannel que usamos (facilita trocar por um duplo nos testes). */
export interface AuthChannel {
  postMessage(message: AuthMessage): void
  onmessage: ((event: { data: AuthMessage }) => void) | null
  close(): void
}

export type LockRunner = <T>(name: string, task: () => Promise<T>) => Promise<T>

export interface AuthClientOptions {
  /** Base das rotas /auth/* ("" = mesma origem). */
  authUrl: string
  /** Sem interação por mais que isto → não renova mais. Padrão: 7 dias (igual ao prazo de inatividade do servidor). */
  idleTimeoutMs?: number
  /** Quanto antes de expirar o token é renovado. Padrão: 60 s. */
  refreshLeadMs?: number
  /** `fetch` a usar. Padrão: o `fetch` global, resolvido a cada chamada. */
  fetch?: typeof fetch
  /** `null` desliga a sincronização entre abas. Padrão: BroadcastChannel, se existir. */
  channel?: AuthChannel | null
  /** Exclusão mútua entre abas. Padrão: navigator.locks, se existir. */
  lock?: LockRunner
  now?: () => number
}

const CHANNEL_NAME = "fausto-auth"
const LOCK_NAME = "fausto-auth-refresh"
const REFRESH_HEADER = { "X-Requested-With": "fausto-web" } // exigido pela API (proteção CSRF)
const REAUTH_HEADER = "X-Reauth"
const MIN_REMAINING_MS = 5_000 // um token com menos que isso não serve para "reaproveitar"
const MIN_TIMER_MS = 5_000
const RETRY_AFTER_ERROR_MS = 15_000
const ACTIVITY_BROADCAST_EVERY_MS = 30_000
const MAX_REAUTH_PROMPTS = 3
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll", "wheel"] as const
const JSON_HEADERS = { "Content-Type": "application/json" }

export const DEFAULT_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000

const defaultLock: LockRunner = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined
  return locks ? await locks.request(name, task) : await task()
}

interface SessionBody {
  accessToken: string
  expiresIn: number
}

export class AuthClient {
  private readonly authUrl: string
  private readonly idleTimeoutMs: number
  private readonly refreshLeadMs: number
  private readonly fetchImpl?: typeof fetch
  private readonly lockRunner: LockRunner
  private readonly now: () => number
  private readonly channelOption: AuthChannel | null | undefined

  private channel: AuthChannel | null = null
  private started = false
  private removeActivityListeners: (() => void) | null = null

  private token: string | null = null
  private expiresAt = 0
  private status: AuthStatus = "unknown"
  private profile: Profile | null = null
  private signedOutByUser = false
  private profileInflight: Promise<ProfileResult> | null = null
  private reauthProof: { token: string; expiresAt: number } | null = null
  private inflight: Promise<RefreshOutcome> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastActivity: number
  private lastActivityBroadcast = 0
  private readonly listeners = new Set<() => void>()

  constructor(options: AuthClientOptions) {
    this.authUrl = options.authUrl
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
    this.refreshLeadMs = options.refreshLeadMs ?? 60_000
    this.fetchImpl = options.fetch
    this.channelOption = options.channel
    this.lockRunner = options.lock ?? defaultLock
    this.now = options.now ?? (() => Date.now())
    this.lastActivity = this.now()
  }

  // ─── estado observável (useSyncExternalStore) ───────────────────────────────

  getStatus = (): AuthStatus => this.status

  /**
   * A última sessão acabou porque a PESSOA clicou em "Sair" (nesta aba ou em outra)? Diferente de uma sessão que
   * expirou ou foi derrubada pelo servidor. A interface usa isso para ir ao login "limpo", sem lembrar a tela anterior.
   */
  wasSignedOutByUser = (): boolean => this.signedOutByUser

  /** Quem está logado (depois de `loadProfile`/`restoreSession`), ou `null`. Referência estável entre mudanças. */
  getProfile = (): Profile | null => this.profile

  subscribe = (listener: () => void): (() => void) => {
    this.start()
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Há um access token válido em memória? (Falso logo após recarregar a página.) */
  hasSession(): boolean {
    return this.status === "authenticated" && this.token !== null
  }

  // ─── login em passos ─────────────────────────────────────────────────────────

  /**
   * Passo 1: senha. Para administradores a resposta pede o segundo fator (ou o cadastro dele) e a sessão ainda NÃO
   * existe. Falhas de rede lançam exceção.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    this.start()
    const res = await this.postJson("/auth/login", { email, password })
    if (res.status === 429) return { kind: "locked", retryAfterSeconds: retryAfter(res) }
    if (!res.ok) return { kind: "denied" }

    const body = (await res.json()) as {
      status?: string
      accessToken?: string
      expiresIn?: number
      challenge?: string
      passwordChangeRequired?: boolean
    }
    if (body.status === "MFA_REQUIRED" && body.challenge) {
      return { kind: "mfa-required", challenge: body.challenge }
    }
    if (body.status === "MFA_SETUP_REQUIRED" && body.challenge) {
      return { kind: "mfa-setup", challenge: body.challenge, passwordChangeRequired: body.passwordChangeRequired === true }
    }
    if (body.accessToken && body.expiresIn) {
      this.openSession(body as SessionBody)
      return { kind: "authenticated" }
    }
    return { kind: "denied" }
  }

  /** Passo 2: código do autenticador (6 dígitos) ou código de recuperação. */
  async verifyMfa(challenge: string, code: string): Promise<MfaVerifyResult> {
    this.start()
    const res = await this.postJson("/auth/login/mfa", { challenge, code })
    if (res.status === 429) return { kind: "locked", retryAfterSeconds: retryAfter(res) }
    if (res.ok) {
      this.openSession((await res.json()) as SessionBody)
      return { kind: "authenticated" }
    }
    return (await isChallengeProblem(res)) ? { kind: "challenge-expired" } : { kind: "invalid-code" }
  }

  /** Cadastro do 2FA, passo 1: gera o segredo (QR / chave manual). */
  async beginMfaSetup(challenge: string): Promise<MfaSetupResult> {
    this.start()
    const res = await this.postJson("/auth/mfa/setup", { challenge })
    if (res.status === 429) return { kind: "locked", retryAfterSeconds: retryAfter(res) }
    if (res.status === 401) return { kind: "challenge-expired" }
    if (!res.ok) return { kind: "error" }
    return { kind: "ok", info: (await res.json()) as MfaSetupInfo }
  }

  /**
   * Cadastro do 2FA, passo 2: confirma com o primeiro código, troca a senha temporária (se for o caso), recebe os
   * códigos de recuperação (mostrados uma única vez) e já entra na conta.
   */
  async confirmMfaSetup(challenge: string, code: string, newPassword?: string): Promise<MfaConfirmResult> {
    this.start()
    const res = await this.postJson("/auth/mfa/setup/confirm", { challenge, code, ...(newPassword ? { newPassword } : {}) })
    if (res.status === 429) return { kind: "locked", retryAfterSeconds: retryAfter(res) }
    if (res.ok) {
      const body = (await res.json()) as SessionBody & { recoveryCodes?: string[] }
      this.openSession(body)
      return { kind: "authenticated", recoveryCodes: body.recoveryCodes ?? [] }
    }
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null
      return { kind: "weak-password", message: body?.message ?? "Senha fora da política." }
    }
    if (res.status === 401) {
      return (await isChallengeProblem(res)) ? { kind: "challenge-expired" } : { kind: "invalid-code" }
    }
    return { kind: "error" }
  }

  /** Ao abrir/recarregar a página: troca o cookie de refresh por um access token, se houver sessão. */
  async bootstrap(): Promise<RefreshOutcome> {
    this.start()
    if (this.hasSession()) return { kind: "ok", token: this.token as string }
    return this.refresh(null)
  }

  /**
   * Busca (e guarda) quem está logado. Chamadas simultâneas compartilham a mesma requisição. O access token
   * precisa existir; o 401 já passa pela renovação automática de `fetch`.
   */
  loadProfile(force = false): Promise<ProfileResult> {
    this.start()
    if (this.profile && !force) return Promise.resolve({ kind: "ok", profile: this.profile })
    if (!this.profileInflight) {
      this.profileInflight = this.requestProfile().finally(() => {
        this.profileInflight = null
      })
    }
    return this.profileInflight
  }

  /** Recupera a sessão (refresh pelo cookie, se preciso) e descobre quem é. É o que as telas protegidas chamam. */
  async restoreSession(): Promise<RestoreResult> {
    if (!this.hasSession()) {
      const boot = await this.bootstrap()
      if (boot.kind === "denied" || boot.kind === "idle") return { kind: "anonymous" }
      if (boot.kind === "error") return { kind: "error", httpStatus: boot.httpStatus }
    }
    const result = await this.loadProfile()
    if (result.kind === "ok") return { kind: "ok", profile: result.profile }
    if (result.kind === "denied") return { kind: "anonymous" }
    return result
  }

  /**
   * Renova o access token. Chamadas simultâneas compartilham a MESMA promessa (single-flight).
   * @param rejected token que acabou de ser recusado (401); se outra aba/requisição já o trocou, não renova de novo.
   */
  refresh(rejected: string | null = this.token): Promise<RefreshOutcome> {
    this.start()
    if (!this.inflight) {
      this.inflight = this.runRefresh(rejected).finally(() => {
        this.inflight = null
      })
    }
    return this.inflight
  }

  /** Encerra a sessão no servidor (revoga) e em todas as abas. */
  async logout(): Promise<void> {
    this.start()
    const token = this.token
    try {
      await this.rawFetch(`${this.authUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      /* sem rede: o logout local acontece mesmo assim */
    }
    this.signedOutByUser = true
    this.endSession(true)
  }

  /** "Sair de todos os dispositivos". */
  async logoutAll(): Promise<boolean> {
    const res = await this.fetch(`${this.authUrl}/auth/logout-all`, { method: "POST", credentials: "include" })
    if (res.ok || res.status === 401) {
      this.signedOutByUser = true
      this.endSession(true)
    }
    return res.ok
  }

  /**
   * `fetch` autenticado: envia `Authorization: Bearer`; ao receber 401, renova o token (single-flight)
   * e refaz a requisição UMA vez.
   */
  fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    this.start()
    const usedToken = this.token
    const first = await this.send(input, init, usedToken)
    if (first.status !== 401) return first

    const outcome = await this.refresh(usedToken)
    if (outcome.kind !== "ok") return first
    return this.send(input, init, outcome.token)
  }

  // ─── reautenticação (operações sensíveis) ────────────────────────────────────

  /** Confirma a identidade com um código 2FA (ou de recuperação). A prova fica só em memória, por poucos minutos. */
  async reauth(code: string): Promise<ReauthResult> {
    const res = await this.fetch(`${this.authUrl}/auth/reauth`, {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ code }),
    })
    if (res.status === 429) return { kind: "locked", retryAfterSeconds: retryAfter(res) }
    if (res.status === 403) return { kind: "invalid-code" }
    if (!res.ok) return { kind: "error" }

    const body = (await res.json()) as { reauthToken: string; expiresIn: number }
    this.reauthProof = { token: body.reauthToken, expiresAt: this.now() + body.expiresIn * 1000 }
    return { kind: "ok" }
  }

  /**
   * `fetch` para uma operação sensível. Envia a prova de reautenticação se houver; se a API responder
   * `403 reauth_required`, pede um código ao usuário (`askCode`), reautentica e refaz a requisição.
   * `askCode` devolve `null` se o usuário desistir — nesse caso a resposta 403 original é devolvida.
   */
  async sensitiveFetch(
    input: string,
    init: RequestInit,
    askCode: (reason: ReauthPromptReason) => Promise<string | null>,
  ): Promise<Response> {
    let reason: ReauthPromptReason
    let response!: Response

    for (let prompt = 0; prompt <= MAX_REAUTH_PROMPTS; prompt++) {
      const headers = new Headers(init.headers)
      const proof = this.validReauthProof()
      if (proof) headers.set(REAUTH_HEADER, proof)

      response = await this.fetch(input, { ...init, headers })
      if (!(await isReauthRequired(response))) return response

      this.reauthProof = null // ausente, vencida ou recusada
      if (prompt === MAX_REAUTH_PROMPTS) break

      const code = await askCode(reason)
      if (!code) return response

      const result = await this.reauth(code)
      if (result.kind === "ok") {
        reason = undefined
        continue
      }
      if (result.kind === "locked") {
        await askCode("locked") // só mostra o aviso de bloqueio
        return response
      }
      reason = result.kind === "invalid-code" ? "invalid" : undefined
    }
    return response
  }

  // ─── atividade e ciclo de vida ────────────────────────────────────────────────

  /** Registra uma interação do usuário (os listeners de `window` chamam isto). */
  markActivity(): void {
    const now = this.now()
    this.lastActivity = now
    if (this.channel && now - this.lastActivityBroadcast > ACTIVITY_BROADCAST_EVERY_MS) {
      this.lastActivityBroadcast = now
      this.channel.postMessage({ type: "activity", at: now })
    }
    // Estava parado (timer não reagendado por inatividade) e o usuário voltou: retoma a renovação.
    if (this.status === "authenticated" && this.timer === null) this.schedule()
  }

  /** Desmonta tudo (timers, listeners, canal) e volta ao estado inicial, sem tocar o servidor. Usado em testes. */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.removeActivityListeners?.()
    this.removeActivityListeners = null
    this.channel?.close()
    this.channel = null
    this.started = false
    this.listeners.clear()
    this.token = null
    this.expiresAt = 0
    this.status = "unknown"
    this.profile = null
    this.signedOutByUser = false
    this.profileInflight = null
    this.reauthProof = null
    this.inflight = null
    this.lastActivity = this.now()
    this.lastActivityBroadcast = 0
  }

  // ─── internos ────────────────────────────────────────────────────────────────

  private isIdle(): boolean {
    return this.now() - this.lastActivity > this.idleTimeoutMs
  }

  private rawFetch(input: string, init: RequestInit): Promise<Response> {
    return (this.fetchImpl ?? globalThis.fetch)(input, init)
  }

  /** POST JSON nas rotas /auth/* que usam o cookie de refresh (credentials: include). */
  private postJson(path: string, body: unknown): Promise<Response> {
    return this.rawFetch(`${this.authUrl}${path}`, {
      method: "POST",
      credentials: "include", // para o browser guardar o cookie de refresh
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
  }

  private send(input: string, init: RequestInit, token: string | null): Promise<Response> {
    const headers = new Headers(init.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)
    return this.rawFetch(input, { ...init, headers })
  }

  /** Sessão aberta (login completo, em qualquer dos caminhos). */
  private openSession(body: SessionBody): void {
    this.markActivity()
    this.profile = null // quem é será (re)consultado: pode ser outra conta
    this.setToken(body.accessToken, body.expiresIn, true)
  }

  private async requestProfile(): Promise<ProfileResult> {
    try {
      const res = await this.fetch(`${this.authUrl}/auth/me`, { credentials: "include" })
      if (res.ok) {
        const body = (await res.json()) as { email?: string; role?: string }
        const role: Role = body.role === "ADMIN" ? "ADMIN" : "USER"
        const profile: Profile = { email: body.email ?? "", role }
        this.profile = profile
        this.notify()
        return { kind: "ok", profile }
      }
      if (res.status === 403) return { kind: "forbidden" }
      if (res.status >= 500) return { kind: "error", httpStatus: res.status }
      return { kind: "denied" } // 401 (já tentou renovar) e demais 4xx
    } catch {
      return { kind: "error" }
    }
  }

  private validReauthProof(): string | null {
    const proof = this.reauthProof
    return proof && proof.expiresAt - this.now() > MIN_REMAINING_MS ? proof.token : null
  }

  private async runRefresh(rejected: string | null): Promise<RefreshOutcome> {
    // Usuário parado além do prazo: não renova (nem mantém a sessão viva com polls automáticos).
    if (this.isIdle()) {
      this.endSession(false)
      return { kind: "idle" }
    }

    return this.lockRunner(LOCK_NAME, async (): Promise<RefreshOutcome> => {
      // Outra aba pode ter renovado enquanto esperávamos o lock: usa o token dela em vez de gastar o refresh token.
      if (this.token && this.token !== rejected && this.expiresAt - this.now() > MIN_REMAINING_MS) {
        return { kind: "ok", token: this.token }
      }

      try {
        const res = await this.rawFetch(`${this.authUrl}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: REFRESH_HEADER,
        })
        if (res.status === 401 || res.status === 403) {
          this.endSession(this.status === "authenticated")
          return { kind: "denied" }
        }
        if (!res.ok) return { kind: "error", httpStatus: res.status }

        const body = (await res.json()) as SessionBody
        this.setToken(body.accessToken, body.expiresIn, true)
        return { kind: "ok", token: body.accessToken }
      } catch {
        return { kind: "error" }
      }
    })
  }

  private setToken(token: string, expiresInSeconds: number, broadcast: boolean): void {
    this.token = token
    this.expiresAt = this.now() + expiresInSeconds * 1000
    this.status = "authenticated"
    this.signedOutByUser = false
    setSessionHint()
    this.schedule()
    if (broadcast) this.channel?.postMessage({ type: "token", token, expiresAt: this.expiresAt })
    this.notify()
  }

  private endSession(broadcast: boolean): void {
    const wasAuthenticated = this.status === "authenticated"
    this.token = null
    this.expiresAt = 0
    this.status = "anonymous"
    this.profile = null
    this.reauthProof = null
    clearSessionHint()
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (broadcast) this.channel?.postMessage({ type: "logout" })
    if (wasAuthenticated || this.listeners.size > 0) this.notify()
  }

  /** Agenda a renovação proativa para `refreshLeadMs` antes de expirar. */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    const delay = Math.max(this.expiresAt - this.now() - this.refreshLeadMs, MIN_TIMER_MS)
    this.timer = setTimeout(() => void this.onTimer(), delay)
  }

  private async onTimer(): Promise<void> {
    this.timer = null
    if (this.status !== "authenticated") return
    // Sem interação além do prazo: deixa o token expirar. Se o usuário voltar, markActivity() reagenda.
    if (this.isIdle()) return

    const outcome = await this.refresh(this.token)
    if (outcome.kind === "error" && this.status === "authenticated" && this.timer === null) {
      this.timer = setTimeout(() => void this.onTimer(), RETRY_AFTER_ERROR_MS)
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }

  /** Abre o canal entre abas e os listeners de atividade — só quando alguém realmente usa a auth. */
  private start(): void {
    if (this.started) return
    this.started = true

    this.channel = this.channelOption !== undefined ? this.channelOption : openBroadcastChannel()
    if (this.channel) {
      this.channel.onmessage = (event) => this.onRemoteMessage(event.data)
    }

    if (typeof window !== "undefined") {
      const onActivity = () => this.markActivity()
      ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true, capture: true }))
      this.removeActivityListeners = () =>
        ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity, { capture: true }))
    }
  }

  private onRemoteMessage(message: AuthMessage): void {
    switch (message.type) {
      case "token": {
        this.token = message.token
        this.expiresAt = message.expiresAt
        this.status = "authenticated"
        setSessionHint()
        this.schedule()
        this.notify()
        break
      }
      case "activity":
        this.lastActivity = Math.max(this.lastActivity, message.at)
        if (this.status === "authenticated" && this.timer === null) this.schedule()
        break
      case "logout":
        this.signedOutByUser = true // a pessoa saiu em outra aba
        this.endSession(false)
        break
    }
  }
}

function openBroadcastChannel(): AuthChannel | null {
  if (typeof BroadcastChannel === "undefined") return null
  return new BroadcastChannel(CHANNEL_NAME) as unknown as AuthChannel
}

/** Segundos de espera pedidos pela API em `Retry-After` (mínimo 1). */
function retryAfter(res: Response): number {
  const seconds = Number(res.headers?.get?.("Retry-After"))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60
}

/**
 * A API responde 401 tanto para "código errado" quanto para "desafio inválido/expirado" (recomeçar pela senha).
 * A diferença está na mensagem fixa da API ("Invalid or expired challenge").
 */
async function isChallengeProblem(res: Response): Promise<boolean> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null
  return /challenge/i.test(body?.message ?? "")
}

/** 403 com `code: "reauth_required"`: falta (ou venceu) a confirmação da identidade. */
async function isReauthRequired(res: Response): Promise<boolean> {
  if (res.status !== 403) return false
  const body = (await res.clone().json().catch(() => null)) as { code?: string } | null
  return body?.code === "reauth_required"
}
