// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthClient, type AuthChannel, type AuthMessage, type LockRunner } from "./authClient"

const API = "http://api.test"

// ─── Servidor falso ───────────────────────────────────────────────────────────

const respond = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

function createServer() {
  const s = {
    seq: 0,
    valid: new Set<string>(), // access tokens que a API aceita
    sessionAlive: false, // há cookie de refresh válido? (só depois do login)
    refreshStatus: 200,
    refreshGate: null as Promise<void> | null,
    refreshCalls: 0,
    refreshInit: null as RequestInit | null,
    logoutAuth: [] as (string | null)[],
    logoutAllCalls: 0,
    dataCalls: [] as { auth: string | null }[],
    issue() {
      const token = `access-${++s.seq}`
      s.valid.add(token)
      return token
    },
    fetch: vi.fn(async (url: string, init: RequestInit = {}): Promise<Response> => {
      const auth = new Headers(init.headers).get("Authorization")
      const path = new URL(url).pathname

      if (path === "/auth/login") {
        const { password } = JSON.parse(String(init.body))
        if (password !== "secret") return respond(401, { message: "Invalid email or password" })
        s.sessionAlive = true
        return respond(200, { accessToken: s.issue(), expiresIn: 900 })
      }
      if (path === "/auth/refresh") {
        s.refreshCalls++
        s.refreshInit = init
        if (s.refreshGate) await s.refreshGate
        if (!s.sessionAlive) return respond(401)
        if (s.refreshStatus !== 200) return respond(s.refreshStatus)
        return respond(200, { accessToken: s.issue(), expiresIn: 900 })
      }
      if (path === "/auth/logout") {
        s.logoutAuth.push(auth)
        s.sessionAlive = false
        return respond(200)
      }
      if (path === "/auth/logout-all") {
        if (!auth || !s.valid.has(auth.slice(7))) return respond(401)
        s.logoutAllCalls++
        s.sessionAlive = false
        return respond(200)
      }
      if (path === "/api/data") {
        s.dataCalls.push({ auth })
        return auth && s.valid.has(auth.slice(7)) ? respond(200, { ok: true }) : respond(401)
      }
      throw new Error(`rota inesperada: ${url}`)
    }),
  }
  return s
}

// ─── "Abas": canal em memória + mutex compartilhado (equivalente ao navigator.locks) ───

class MemChannel implements AuthChannel {
  onmessage: ((event: { data: AuthMessage }) => void) | null = null
  private readonly peers: MemChannel[]
  constructor(peers: MemChannel[]) {
    this.peers = peers
    peers.push(this)
  }
  postMessage(message: AuthMessage) {
    for (const peer of this.peers) {
      if (peer !== this) queueMicrotask(() => peer.onmessage?.({ data: structuredClone(message) }))
    }
  }
  close() {
    this.peers.splice(this.peers.indexOf(this), 1)
  }
}

function createMutex(): LockRunner {
  let tail: Promise<unknown> = Promise.resolve()
  return async <T>(_name: string, task: () => Promise<T>): Promise<T> => {
    const previous = tail
    let release!: () => void
    tail = new Promise<void>((resolve) => (release = resolve))
    await previous
    try {
      return await task()
    } finally {
      release()
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let server: ReturnType<typeof createServer>
const clients: AuthClient[] = []

function newClient(options: Partial<ConstructorParameters<typeof AuthClient>[0]> = {}) {
  const client = new AuthClient({ authUrl: API, fetch: server.fetch as unknown as typeof fetch, channel: null, ...options })
  clients.push(client)
  return client
}

function twoTabs(options: Partial<ConstructorParameters<typeof AuthClient>[0]> = {}) {
  const bus: MemChannel[] = []
  const lock = createMutex()
  const tab = () => {
    const client = newClient({ channel: new MemChannel(bus), lock, ...options })
    client.subscribe(() => {}) // como um PrivateRoute montado: abre o canal e passa a ouvir as outras abas
    return client
  }
  return [tab(), tab()] as const
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const dataRequest = (client: AuthClient) => client.fetch(`${API}/api/data`)

beforeEach(() => {
  server = createServer()
})

afterEach(() => {
  clients.splice(0).forEach((c) => c.dispose())
  vi.useRealTimers()
  localStorage.clear()
  sessionStorage.clear()
})

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("login", () => {
  it("autentica, guarda o access token só em memória e envia o Bearer nas requisições", async () => {
    const client = newClient()

    expect(await client.login("admin@x.com", "secret")).toBe(true)

    expect(client.getStatus()).toBe("authenticated")
    expect(server.fetch).toHaveBeenCalledWith(
      `${API}/auth/login`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    )

    const res = await dataRequest(client)
    expect(res.status).toBe(200)
    expect(server.dataCalls[0].auth).toBe("Bearer access-1")

    // nada de localStorage / sessionStorage / cookie legível por JS
    const stored = [localStorage, sessionStorage].flatMap((store) =>
      Object.keys(store).flatMap((key) => [key, store.getItem(key)]),
    )
    expect(stored.join(" ")).not.toContain("access-1")
    expect(document.cookie).not.toContain("access-1")
  })

  it("credenciais erradas → false, sem sessão e sem dizer o que errou", async () => {
    const client = newClient()

    expect(await client.login("admin@x.com", "errada")).toBe(false)

    expect(client.getStatus()).toBe("unknown")
    expect(client.hasSession()).toBe(false)
    expect((await dataRequest(client)).status).toBe(401) // não há token
  })

  it("recarregar a página perde o token: o novo cliente recupera a sessão pelo cookie (refresh)", async () => {
    const before = newClient()
    await before.login("admin@x.com", "secret")
    before.dispose() // "reload": a memória some

    const after = newClient()
    expect(after.hasSession()).toBe(false)

    const outcome = await after.bootstrap()

    expect(outcome).toEqual({ kind: "ok", token: "access-2" })
    expect(after.hasSession()).toBe(true)
    expect(server.refreshCalls).toBe(1)
  })
})

describe("refresh: requisição e falhas", () => {
  it("envia o cookie (credentials: include) e o header anti-CSRF exigido pela API", async () => {
    const client = newClient()

    await client.bootstrap()

    expect(server.refreshInit).toMatchObject({ method: "POST", credentials: "include" })
    expect(new Headers(server.refreshInit?.headers).get("X-Requested-With")).toBe("fausto-web")
  })

  it("servidor recusa (401) → sessão encerrada", async () => {
    server.sessionAlive = false
    const client = newClient()

    expect(await client.bootstrap()).toEqual({ kind: "denied" })
    expect(client.getStatus()).toBe("anonymous")
  })

  it("5xx ou falha de rede NÃO encerram a sessão (não é o mesmo que 'sem sessão')", async () => {
    const client = newClient()
    await client.login("admin@x.com", "secret")

    server.valid.clear()
    server.refreshStatus = 502
    expect((await dataRequest(client)).status).toBe(401)
    expect(client.getStatus()).toBe("authenticated")

    server.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    expect(await client.refresh()).toEqual({ kind: "error" })
    expect(client.getStatus()).toBe("authenticated")
  })
})

describe("interceptor com single-flight", () => {
  it("várias requisições com 401 ao mesmo tempo disparam UM refresh; todas esperam e são refeitas", async () => {
    const client = newClient()
    await client.login("admin@x.com", "secret")
    server.valid.clear() // o access token expirou

    let openGate!: () => void
    server.refreshGate = new Promise<void>((resolve) => (openGate = resolve))

    const requests = Array.from({ length: 5 }, () => dataRequest(client))
    await vi.waitFor(() => expect(server.dataCalls).toHaveLength(5)) // as 5 já tomaram 401
    expect(server.refreshCalls).toBe(1) // e só uma chamada de refresh foi aberta
    openGate()
    const responses = await Promise.all(requests)

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(server.refreshCalls).toBe(1)
    expect(server.dataCalls).toHaveLength(10) // 5 tentativas + 5 refeitas
    expect(server.dataCalls.slice(5).every((c) => c.auth === "Bearer access-2")).toBe(true)
  })

  it("refaz a requisição UMA vez: se o novo token também for recusado, devolve o 401 (sem laço)", async () => {
    const client = newClient()
    await client.login("admin@x.com", "secret")
    server.valid.clear()
    const issue = server.issue
    server.issue = () => `${issue()}-recusado` // o servidor emite um token que a própria API não aceita
    server.valid.clear()

    const res = await dataRequest(client)

    expect(res.status).toBe(401)
    expect(server.refreshCalls).toBe(1)
    expect(server.dataCalls).toHaveLength(2)
  })

  it("refresh recusado → devolve o 401 original e a sessão acaba", async () => {
    const client = newClient()
    await client.login("admin@x.com", "secret")
    server.valid.clear()
    server.sessionAlive = false

    const res = await dataRequest(client)

    expect(res.status).toBe(401)
    expect(client.getStatus()).toBe("anonymous")
    expect(client.hasSession()).toBe(false)
  })
})

describe("renovação proativa", () => {
  beforeEach(() => vi.useFakeTimers())

  it("renova ~1 min antes de expirar (access token de 15 min → aos 14 min) e segue renovando", async () => {
    const client = newClient()
    await client.login("admin@x.com", "secret")

    await vi.advanceTimersByTimeAsync(13 * 60_000 + 59_000)
    expect(server.refreshCalls).toBe(0)

    await vi.advanceTimersByTimeAsync(1_000) // 14:00
    expect(server.refreshCalls).toBe(1)

    await vi.advanceTimersByTimeAsync(14 * 60_000)
    expect(server.refreshCalls).toBe(2)
    expect((await dataRequest(client)).status).toBe(200) // sempre com um token válido, sem nunca tomar 401
    expect(server.dataCalls.filter((_, i) => i > 0)).toHaveLength(0)
  })

  it("usuário ativo continua sendo renovado; inativo além do prazo, NÃO", async () => {
    const client = newClient({ idleTimeoutMs: 10 * 60_000 })
    await client.login("admin@x.com", "secret")

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    client.markActivity() // interagiu aos 5 min → inativo só a partir dos 15
    await vi.advanceTimersByTimeAsync(9 * 60_000) // 14 min: não está inativo
    expect(server.refreshCalls).toBe(1)

    // agora fica sem interagir: aos 28 min já passou o prazo de 10 min desde os 14
    await vi.advanceTimersByTimeAsync(14 * 60_000)
    expect(server.refreshCalls).toBe(1) // o timer disparou, viu a inatividade e não renovou
  })

  it("inativo: ao receber 401 também não renova — a sessão é encerrada localmente", async () => {
    const client = newClient({ idleTimeoutMs: 10 * 60_000 })
    await client.login("admin@x.com", "secret")

    await vi.advanceTimersByTimeAsync(16 * 60_000) // token expirou e ninguém interagiu
    server.valid.clear()
    const res = await dataRequest(client)

    expect(res.status).toBe(401)
    expect(server.refreshCalls).toBe(0)
    expect(client.getStatus()).toBe("anonymous")
  })

  it("volta a renovar quando o usuário retoma a interação", async () => {
    const client = newClient({ idleTimeoutMs: 10 * 60_000 })
    await client.login("admin@x.com", "secret")
    await vi.advanceTimersByTimeAsync(14 * 60_000) // timer dispara, usuário inativo → não renova
    expect(server.refreshCalls).toBe(0)

    client.markActivity() // voltou antes do token expirar
    await vi.advanceTimersByTimeAsync(10_000)

    expect(server.refreshCalls).toBe(1)
    expect(client.getStatus()).toBe("authenticated")
  })
})

describe("duas abas", () => {
  it("login e token renovado numa aba valem na outra (BroadcastChannel)", async () => {
    const [a, b] = twoTabs()

    await a.login("admin@x.com", "secret")
    await flush()
    expect(b.getStatus()).toBe("authenticated")

    await a.refresh()
    await flush()
    await dataRequest(b)

    expect(server.dataCalls[0].auth).toBe("Bearer access-2") // B usa o token que A renovou
    expect(server.refreshCalls).toBe(1) // B não precisou renovar
  })

  it("refresh concorrente em duas abas → UMA só chamada ao servidor e as duas terminam com o mesmo token", async () => {
    const [a, b] = twoTabs()
    await a.login("admin@x.com", "secret")
    await flush()
    server.valid.clear() // expirou nas duas abas

    const [ra, rb] = await Promise.all([dataRequest(a), dataRequest(b)])

    expect([ra.status, rb.status]).toEqual([200, 200])
    expect(server.refreshCalls).toBe(1) // o refresh token foi gasto uma única vez
    const retried = server.dataCalls.filter((c) => c.auth === "Bearer access-2")
    expect(retried).toHaveLength(2) // as duas refizeram com o token novo
  })

  it("logout numa aba encerra a sessão nas duas", async () => {
    const [a, b] = twoTabs()
    await a.login("admin@x.com", "secret")
    await flush()
    expect(b.hasSession()).toBe(true)

    await a.logout()
    await flush()

    expect(server.logoutAuth).toEqual(["Bearer access-1"])
    expect(a.getStatus()).toBe("anonymous")
    expect(b.getStatus()).toBe("anonymous")
    expect(b.hasSession()).toBe(false)
  })

  it("sessão derrubada pelo servidor (ex.: reuso detectado) numa aba derruba a outra", async () => {
    const [a, b] = twoTabs()
    await a.login("admin@x.com", "secret")
    await flush()
    server.valid.clear()
    server.sessionAlive = false

    await dataRequest(a)
    await flush()

    expect(a.getStatus()).toBe("anonymous")
    expect(b.getStatus()).toBe("anonymous")
  })

  it("a atividade numa aba mantém a outra elegível para renovar", async () => {
    vi.useFakeTimers()
    const [a, b] = twoTabs({ idleTimeoutMs: 10 * 60_000 })
    await a.login("admin@x.com", "secret")
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(8 * 60_000)
    a.markActivity() // o usuário só mexe na aba A
    await vi.advanceTimersByTimeAsync(6 * 60_000) // 14 min: o timer de B dispara

    expect(b.getStatus()).toBe("authenticated")
    expect(server.refreshCalls).toBeGreaterThanOrEqual(1) // B (ou A) renovou: ninguém ficou "inativo"
  })
})

describe("logout e revogação", () => {
  it("logout revoga no servidor (com o Bearer), limpa a memória e não deixa token para usar", async () => {
    const client = newClient()
    await client.login("admin@x.com", "secret")

    await client.logout()

    expect(server.logoutAuth).toEqual(["Bearer access-1"])
    expect(client.getStatus()).toBe("anonymous")
    expect(client.hasSession()).toBe(false)
    expect((await dataRequest(client)).status).toBe(401)
    expect(server.refreshCalls).toBe(1) // tentou recuperar, o servidor recusou (sessão revogada)
  })

  it("logout encerra a sessão local mesmo sem rede", async () => {
    const client = newClient()
    await client.login("admin@x.com", "secret")
    server.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await client.logout()

    expect(client.getStatus()).toBe("anonymous")
  })

  it("'sair de todos os dispositivos' chama /auth/logout-all e encerra a sessão", async () => {
    const [a, b] = twoTabs()
    await a.login("admin@x.com", "secret")
    await flush()

    expect(await a.logoutAll()).toBe(true)
    await flush()

    expect(server.logoutAllCalls).toBe(1)
    expect(a.getStatus()).toBe("anonymous")
    expect(b.getStatus()).toBe("anonymous")
  })
})
