/**
 * Cliente de autenticação: access token só em memória + refresh token em cookie HttpOnly (gerido pelo browser).
 *
 *  - O access token NUNCA vai para localStorage/sessionStorage: recarregar a página o perde, e o `bootstrap()`
 *    pede um novo ao servidor usando o cookie.
 *  - Renovação proativa ~1 min antes de expirar e também ao receber 401, em "single-flight": várias requisições
 *    com 401 ao mesmo tempo disparam UMA única chamada de refresh; as demais esperam e são refeitas.
 *  - Entre abas: Web Locks serializa o refresh e o BroadcastChannel propaga token, atividade e logout.
 *  - Se o usuário ficar sem interagir além de `idleTimeoutMs`, a sessão não é mais renovada.
 */

export type AuthStatus = "unknown" | "authenticated" | "anonymous"

export type RefreshOutcome =
  | { kind: "ok"; token: string }
  | { kind: "denied" } // servidor recusou: sessão encerrada
  | { kind: "idle" } // usuário inativo além do prazo: nem tentamos renovar
  | { kind: "error"; httpStatus?: number } // falha de rede/5xx: não é "sem sessão"

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
const MIN_REMAINING_MS = 5_000 // um token com menos que isso não serve para "reaproveitar"
const MIN_TIMER_MS = 5_000
const RETRY_AFTER_ERROR_MS = 15_000
const ACTIVITY_BROADCAST_EVERY_MS = 30_000
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll", "wheel"] as const

export const DEFAULT_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000

const defaultLock: LockRunner = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined
  return locks ? await locks.request(name, task) : await task()
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

  subscribe = (listener: () => void): (() => void) => {
    this.start()
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Há um access token válido em memória? (Falso logo após recarregar a página.) */
  hasSession(): boolean {
    return this.status === "authenticated" && this.token !== null
  }

  // ─── ações ───────────────────────────────────────────────────────────────────

  /** @returns `false` se as credenciais foram recusadas. Falhas de rede lançam exceção. */
  async login(email: string, password: string): Promise<boolean> {
    this.start()
    const res = await this.rawFetch(`${this.authUrl}/auth/login`, {
      method: "POST",
      credentials: "include", // para o browser guardar o cookie de refresh
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) return false

    const body = (await res.json()) as { accessToken: string; expiresIn: number }
    this.markActivity()
    this.setToken(body.accessToken, body.expiresIn, true)
    return true
  }

  /** Ao abrir/recarregar a página: troca o cookie de refresh por um access token, se houver sessão. */
  async bootstrap(): Promise<RefreshOutcome> {
    this.start()
    if (this.hasSession()) return { kind: "ok", token: this.token as string }
    return this.refresh(null)
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
    this.endSession(true)
  }

  /** "Sair de todos os dispositivos". */
  async logoutAll(): Promise<boolean> {
    const res = await this.fetch(`${this.authUrl}/auth/logout-all`, { method: "POST", credentials: "include" })
    if (res.ok || res.status === 401) this.endSession(true)
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

  private send(input: string, init: RequestInit, token: string | null): Promise<Response> {
    const headers = new Headers(init.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)
    return this.rawFetch(input, { ...init, headers })
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

        const body = (await res.json()) as { accessToken: string; expiresIn: number }
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
    this.schedule()
    if (broadcast) this.channel?.postMessage({ type: "token", token, expiresAt: this.expiresAt })
    this.notify()
  }

  private endSession(broadcast: boolean): void {
    const wasAuthenticated = this.status === "authenticated"
    this.token = null
    this.expiresAt = 0
    this.status = "anonymous"
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
        this.schedule()
        this.notify()
        break
      }
      case "activity":
        this.lastActivity = Math.max(this.lastActivity, message.at)
        if (this.status === "authenticated" && this.timer === null) this.schedule()
        break
      case "logout":
        this.endSession(false)
        break
    }
  }
}

function openBroadcastChannel(): AuthChannel | null {
  if (typeof BroadcastChannel === "undefined") return null
  return new BroadcastChannel(CHANNEL_NAME) as unknown as AuthChannel
}
