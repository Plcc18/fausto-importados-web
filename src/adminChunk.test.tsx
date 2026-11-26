// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"

/**
 * O código do painel é um chunk separado. Estes testes garantem que ele só é BAIXADO (a factory do módulo só roda
 * no `import()`) depois que a API confirma que a pessoa é administradora — quem não é nunca recebe esse código.
 * Cada teste recarrega os módulos para começar com o "carregador" zerado.
 */

const loaded: string[] = []
let fetchMock: ReturnType<typeof vi.fn>

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function Where() {
  const { pathname } = useLocation()
  return <div data-testid="where">{pathname}</div>
}

function serverFor(session: "none" | "ADMIN" | "USER") {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/auth/refresh")) {
      return session === "none" ? json({}, 401) : json({ accessToken: "access-1", expiresIn: 900 })
    }
    if (url.endsWith("/auth/me")) return json({ email: "pessoa@x.com", role: session })
    return new Promise(() => {}) // catálogo e demais chamadas ficam pendentes
  })
}

async function visit(path: string) {
  const { App } = await import("@/App")
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetModules()
  loaded.length = 0
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  Element.prototype.scrollIntoView = vi.fn()
  vi.doMock("@/admin/Admin", () => {
    loaded.push("Admin")
    return { Admin: () => <div data-testid="admin-panel">painel</div> }
  })
  vi.doMock("@/admin/SalesReport", () => {
    loaded.push("SalesReport")
    return { SalesReport: () => <div data-testid="sales-report">relatório</div> }
  })
  vi.doMock("@/admin/AdminUsers", () => {
    loaded.push("AdminUsers")
    return { AdminUsers: () => <div data-testid="admin-users">administradores</div> }
  })
  vi.doMock("@/component/Login", () => {
    loaded.push("Login")
    return { Login: () => <div data-testid="login-page">entrar</div> }
  })
})

afterEach(async () => {
  cleanup()
  const { authClient } = await import("@/lib/auth")
  authClient.dispose()
  vi.doUnmock("@/admin/Admin")
  vi.doUnmock("@/admin/SalesReport")
  vi.doUnmock("@/admin/AdminUsers")
  vi.doUnmock("@/component/Login")
  vi.unstubAllGlobals()
})

// Cada teste reimporta o app inteiro: com muitos arquivos em paralelo isso passa do prazo padrão (5 s)
describe("carregamento sob demanda do painel", { timeout: 30_000 }, () => {
  it("a loja não baixa o painel, nem o login, nem faz chamadas de autenticação", async () => {
    await visit("/")

    expect((await screen.findAllByText("Fausto")).length).toBeGreaterThan(0) // a loja renderizou
    expect(loaded).toEqual([])
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/auth/"))).toBe(false)
  })

  it("visitante anônimo em /admin: não baixa o painel e vai para entrar (que baixa só o login)", async () => {
    serverFor("none")

    await visit("/admin")

    expect(await screen.findByTestId("login-page")).toBeTruthy()
    expect(screen.getByTestId("where").textContent).toBe("/entrar")
    expect(loaded).toEqual(["Login"])
  })

  it("usuário comum em /admin: recebe 403 e o painel NUNCA é baixado", async () => {
    serverFor("USER")

    await visit("/admin")

    expect(await screen.findByRole("heading", { name: "Esta área é reservada." })).toBeTruthy()
    expect(loaded).not.toContain("Admin")
    expect(screen.queryByTestId("admin-panel")).toBeNull()
  })

  it("administrador em /admin: o painel só é baixado depois de /auth/me confirmar o papel", async () => {
    serverFor("ADMIN")

    await visit("/admin")

    expect(await screen.findByTestId("admin-panel")).toBeTruthy()
    expect(loaded).toEqual(["Admin"])
    const order = fetchMock.mock.calls.map(([u]) => String(u))
    expect(order.some((u) => u.endsWith("/auth/me"))).toBe(true)
  })

  it("a gestão de administradores é outro chunk, só para administrador; usuário comum não o baixa", async () => {
    serverFor("USER")
    await visit("/admin/administradores")
    expect(await screen.findByRole("heading", { name: "Esta área é reservada." })).toBeTruthy()
    expect(loaded).not.toContain("AdminUsers")

    cleanup()
    vi.resetModules()
    loaded.length = 0
    serverFor("ADMIN")
    await visit("/admin/administradores")
    expect(await screen.findByTestId("admin-users")).toBeTruthy()
    expect(loaded).toEqual(["AdminUsers"])
  })

  it("o relatório é outro chunk: abrir /admin/relatorio não baixa o painel principal", async () => {
    serverFor("ADMIN")

    await visit("/admin/relatorio")

    expect(await screen.findByTestId("sales-report")).toBeTruthy()
    expect(loaded).toEqual(["SalesReport"])
  })
})
