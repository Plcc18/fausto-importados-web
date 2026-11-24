// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { AuthMenu } from "./AuthMenu"
import { authClient } from "@/lib/auth"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

let fetchMock: ReturnType<typeof vi.fn>

/** Responde por rota. `hold` segura o refresh para observar o estado "carregando". */
function api(options: { refresh?: () => Response; role?: "ADMIN" | "USER"; hold?: Promise<void> } = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/auth/refresh")) {
      if (options.hold) await options.hold
      return options.refresh?.() ?? json({ accessToken: "access-1", expiresIn: 900 })
    }
    if (url.endsWith("/auth/login")) return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (url.endsWith("/auth/me")) return json({ email: "maria@loja.com", role: options.role ?? "ADMIN" })
    if (url.endsWith("/auth/logout")) return json({})
    throw new Error(`rota inesperada: ${url}`)
  })
}

function Where() {
  const { pathname } = useLocation()
  return <div data-testid="where">{pathname}</div>
}

const renderMenu = () =>
  render(
    <MemoryRouter>
      <AuthMenu />
    </MemoryRouter>,
  )

const calledAuthRoutes = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/auth/"))

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  // o Popover (Radix) mede elementos com ResizeObserver, que o jsdom não tem
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("AuthMenu — sem sessão", () => {
  it("visitante que nunca entrou não vê NADA de conta (sem botão 'Entrar') e nenhuma requisição é feita", () => {
    const { container } = renderMenu()

    expect(container.innerHTML).toBe("")
    expect(screen.queryByRole("link", { name: /entrar/i })).toBeNull()
    expect(screen.queryByLabelText("Carregando conta")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("não oferece 'Painel' nem 'Sair' para quem não entrou", () => {
    renderMenu()

    expect(screen.queryByRole("link", { name: "Painel" })).toBeNull()
    expect(screen.queryByRole("button", { name: /sair/i })).toBeNull()
  })
})

describe("AuthMenu — conta recuperada pela sessão anterior", () => {
  it("mostra um esqueleto (sem piscar 'Entrar') enquanto recupera a sessão, depois a conta", async () => {
    localStorage.setItem("fausto:session-hint", "1")
    let release!: () => void
    api({ hold: new Promise<void>((resolve) => (release = resolve)) })

    renderMenu()

    expect(screen.getByLabelText("Carregando conta")).toBeTruthy()
    release()
    expect(await screen.findByRole("button", { name: "Minha conta" })).toBeTruthy()
    expect(screen.queryByLabelText("Carregando conta")).toBeNull()
  })

  it("administrador: menu com o e-mail, 'Administrador', 'Painel' (→ /admin) e 'Sair'", async () => {
    localStorage.setItem("fausto:session-hint", "1")
    api({ role: "ADMIN" })
    renderMenu()

    fireEvent.click(await screen.findByRole("button", { name: "Minha conta" }))

    expect(screen.getByTestId("account-email").textContent).toBe("maria@loja.com")
    expect(screen.getByText("Administrador")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Painel" }).getAttribute("href")).toBe("/admin")
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy()
  })

  it("usuário comum: menu com 'Sair', SEM o botão 'Painel'", async () => {
    localStorage.setItem("fausto:session-hint", "1")
    api({ role: "USER" })
    renderMenu()

    fireEvent.click(await screen.findByRole("button", { name: "Minha conta" }))

    expect(screen.getByText("Cliente")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Painel" })).toBeNull()
  })

  it("a sessão antiga já não vale (refresh recusado) → o esqueleto some, não aparece botão e a dica é apagada", async () => {
    localStorage.setItem("fausto:session-hint", "1")
    api({ refresh: () => json({}, 401) })

    const { container } = renderMenu()

    await waitFor(() => expect(container.innerHTML).toBe(""))
    expect(screen.queryByRole("link", { name: /entrar/i })).toBeNull()
    expect(localStorage.getItem("fausto:session-hint")).toBeNull()
    expect(calledAuthRoutes().some((u) => u.endsWith("/auth/me"))).toBe(false) // sem token, nem consulta quem é
  })

  it("'Sair' encerra a sessão no servidor e o menu de conta some do cabeçalho", async () => {
    localStorage.setItem("fausto:session-hint", "1")
    api()
    renderMenu()
    fireEvent.click(await screen.findByRole("button", { name: "Minha conta" }))

    fireEvent.click(screen.getByRole("button", { name: "Sair" }))

    await waitFor(() => expect(screen.queryByRole("button", { name: "Minha conta" })).toBeNull())
    expect(screen.queryByRole("link", { name: /entrar/i })).toBeNull()
    expect(calledAuthRoutes().some((u) => u.endsWith("/auth/logout"))).toBe(true)
    expect(authClient.getProfile()).toBeNull()
  })
})

describe("AuthMenu — sair da conta", () => {
  it("'Sair' encerra a sessão e leva para a tela de login", async () => {
    localStorage.setItem("fausto:session-hint", "1")
    api()
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthMenu />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId("where").textContent).toBe("/")
    fireEvent.click(await screen.findByRole("button", { name: "Minha conta" }))

    fireEvent.click(screen.getByRole("button", { name: "Sair" }))

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/entrar"))
    expect(calledAuthRoutes().some((u) => u.endsWith("/auth/logout"))).toBe(true)
    expect(authClient.hasSession()).toBe(false)
  })
})

describe("AuthMenu — acabou de entrar nesta aba", () => {
  it("com o perfil já conhecido não há esqueleto nem requisição extra", async () => {
    api()
    expect(await authClient.login("maria@loja.com", "x")).toEqual({ kind: "authenticated" })
    await authClient.loadProfile()
    fetchMock.mockClear()

    renderMenu()

    expect(screen.queryByLabelText("Carregando conta")).toBeNull()
    expect(screen.getByRole("button", { name: "Minha conta" })).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("logout em OUTRA aba (mensagem do canal) atualiza este cabeçalho", async () => {
    localStorage.setItem("fausto:session-hint", "1")
    api()
    renderMenu()
    await screen.findByRole("button", { name: "Minha conta" })

    // simula a outra aba avisando pelo BroadcastChannel
    authClient["onRemoteMessage"]({ type: "logout" })

    await waitFor(() => expect(screen.queryByRole("button", { name: "Minha conta" })).toBeNull())
    expect(screen.queryByRole("link", { name: /entrar/i })).toBeNull()
  })
})
