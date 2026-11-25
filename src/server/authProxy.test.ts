// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { authPath, DEFAULT_API_ORIGIN, handleAuthProxy, type ProxyEnv } from "./authProxy"

const SECRET = "0123456789abcdef0123456789abcdef-secret"

function setup(upstream: () => Response | Promise<Response> = () => new Response("{}", { status: 200 })) {
  const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => upstream())
  const call = (request: Request, env: ProxyEnv = { PROXY_SHARED_SECRET: SECRET }) =>
    handleAuthProxy(request, env, fetcher)
  const sent = () => {
    const [url, init] = fetcher.mock.calls[0]
    return { url, init, headers: init.headers as Headers }
  }
  return { fetcher, call, sent }
}

const login = (headers: Record<string, string> = {}, path = "https://loja.test/auth/login") =>
  new Request(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: '{"a":1}' })

describe("authPath", () => {
  it("aceita /auth/* com ou sem o prefixo /api", () => {
    expect(authPath("https://x.test/auth/login")).toBe("/auth/login")
    expect(authPath("https://x.test/api/auth/password/forgot")).toBe("/auth/password/forgot")
  })

  it("recusa o que não é /auth/*, inclusive tentativas de escapar do prefixo", () => {
    expect(authPath("https://x.test/auth")).toBeNull()
    expect(authPath("https://x.test/api/product")).toBeNull()
    expect(authPath("https://x.test/authors/1")).toBeNull()
    expect(authPath("https://x.test/auth/../api/admin/users")).toBe(null)
    expect(authPath("https://x.test/auth/%2e%2e/api/admin/users")).toBe(null)
  })
})

describe("handleAuthProxy", () => {
  it("repassa para a API com o segredo e o IP que a Vercel preencheu", async () => {
    const { call, sent } = setup()

    await call(login({ "x-vercel-forwarded-for": "203.0.113.7" }))

    expect(sent().url).toBe(`${DEFAULT_API_ORIGIN}/auth/login`)
    expect(sent().headers.get("x-proxy-secret")).toBe(SECRET)
    expect(sent().headers.get("x-client-ip")).toBe("203.0.113.7")
  })

  it("usa x-real-ip quando não há x-vercel-forwarded-for, e só o primeiro item", async () => {
    const { call, sent } = setup()

    await call(login({ "x-real-ip": "203.0.113.8, 10.0.0.1" }))

    expect(sent().headers.get("x-client-ip")).toBe("203.0.113.8")
  })

  it("descarta cabeçalhos de IP e de segredo que o cliente tentou mandar", async () => {
    const { call, sent } = setup()

    await call(
      login({
        "x-client-ip": "1.2.3.4",
        "x-proxy-secret": "forjado",
        "x-forwarded-for": "5.6.7.8",
        "x-vercel-forwarded-for": "203.0.113.9",
        "x-vercel-id": "gru1::abc",
        host: "loja.test",
      }),
    )

    expect(sent().headers.get("x-client-ip")).toBe("203.0.113.9")
    expect(sent().headers.get("x-proxy-secret")).toBe(SECRET)
    expect(sent().headers.get("x-forwarded-for")).toBeNull()
    expect(sent().headers.get("x-vercel-id")).toBeNull()
    expect(sent().headers.get("host")).toBeNull()
  })

  it("nunca usa X-Forwarded-For como IP do visitante: sem o IP da Vercel, não envia X-Client-IP", async () => {
    const { call, sent } = setup()

    await call(login({ "x-forwarded-for": "5.6.7.8" }))

    expect(sent().headers.get("x-client-ip")).toBeNull()
    expect(sent().headers.get("x-proxy-secret")).toBe(SECRET)
  })

  it("sem PROXY_SHARED_SECRET não envia segredo nem IP (e nunca o que o cliente mandou)", async () => {
    const { call, sent } = setup()

    await call(login({ "x-vercel-forwarded-for": "203.0.113.7", "x-client-ip": "1.2.3.4" }), {})

    expect(sent().headers.get("x-proxy-secret")).toBeNull()
    expect(sent().headers.get("x-client-ip")).toBeNull()
  })

  it("mantém o cookie, o método, a query e o corpo", async () => {
    const { call, sent } = setup()
    const request = new Request("https://loja.test/api/auth/refresh?x=1", {
      method: "POST",
      headers: { cookie: "refresh_token=abc", "x-requested-with": "fausto" },
      body: "corpo",
    })

    await call(request)

    expect(sent().url).toBe(`${DEFAULT_API_ORIGIN}/auth/refresh?x=1`)
    expect(sent().init.method).toBe("POST")
    expect(sent().headers.get("cookie")).toBe("refresh_token=abc")
    expect(sent().headers.get("x-requested-with")).toBe("fausto")
    expect(await new Response(sent().init.body).text()).toBe("corpo")
  })

  it("não manda corpo em GET", async () => {
    const { call, sent } = setup()

    await call(new Request("https://loja.test/auth/me"))

    expect(sent().init.method).toBe("GET")
    expect(sent().init.body).toBeUndefined()
  })

  it("devolve status, corpo e cada Set-Cookie separado, sem cabeçalhos de compressão", async () => {
    const upstream = new Response('{"ok":true}', {
      status: 201,
      headers: { "content-type": "application/json", "content-encoding": "gzip", "content-length": "999" },
    })
    upstream.headers.append("set-cookie", "refresh_token=novo; Path=/auth; HttpOnly")
    upstream.headers.append("set-cookie", "outro=1; Path=/")
    const { call } = setup(() => upstream)

    const response = await call(login())

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get("content-encoding")).toBeNull()
    expect(response.headers.get("content-length")).toBeNull()
    expect(response.headers.getSetCookie()).toEqual([
      "refresh_token=novo; Path=/auth; HttpOnly",
      "outro=1; Path=/",
    ])
  })

  it("repassa erros da API (401, 429 com Retry-After) como vieram", async () => {
    const { call } = setup(
      () => new Response("{}", { status: 429, headers: { "retry-after": "30", "ratelimit-limit": "5" } }),
    )

    const response = await call(login())

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("30")
    expect(response.headers.get("ratelimit-limit")).toBe("5")
  })

  it("responde 404 fora de /auth/* sem chamar a API", async () => {
    const { call, fetcher } = setup()

    const response = await call(new Request("https://loja.test/api/product"))

    expect(response.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("usa API_ORIGIN quando definida", async () => {
    const { call, sent } = setup()

    await call(login(), { API_ORIGIN: "https://staging-api.test", PROXY_SHARED_SECRET: SECRET })

    expect(sent().url).toBe("https://staging-api.test/auth/login")
  })

  it("502 quando a API não responde, 504 quando estoura o tempo, sem vazar detalhes", async () => {
    const down = setup(() => {
      throw new TypeError("fetch failed: ECONNREFUSED 10.0.0.5")
    })
    const bad = await down.call(login())
    expect(bad.status).toBe(502)
    expect(await bad.text()).not.toContain("10.0.0.5")

    const slow = setup(() => {
      throw new DOMException("timeout", "TimeoutError")
    })
    expect((await slow.call(login())).status).toBe(504)
  })
})
