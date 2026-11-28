// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { Campaigns } from "./Campaigns"
import { Admin } from "@/admin/Admin"
import { API_URL } from "@/lib/api"
import { authClient } from "@/lib/auth"
import { ROUTES } from "@/routes"

// Pedidos e notificações do painel não interessam aqui (e abririam polls).
vi.mock("@/admin/useAdminPushNotifications", () => ({
  useAdminPushNotifications: () => ({ pendingCount: 0, poll: vi.fn() }),
}))
vi.mock("@/admin/NotificationsPanel", () => ({ NotificationsPanel: () => null }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const listing = (totalElements: number) => json({ content: [], page: { size: 1, number: 0, totalElements, totalPages: totalElements } })

let fetchMock: ReturnType<typeof vi.fn>
/** Resposta de cada chamada à lista de campanhas, na ordem. */
let answers: (() => Response)[]

const listCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/admin/campaigns"))

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[ROUTES.adminCampaigns]}>
      <Routes>
        <Route path={ROUTES.adminCampaigns} element={<Campaigns />} />
        <Route path={ROUTES.admin} element={<div data-testid="admin-panel">painel</div>} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(async () => {
  localStorage.clear()
  answers = []
  fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/auth/login")) return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    // chamadas do painel principal (teste de acesso)
    if (url.endsWith("/api/product")) return json({ content: [] })
    if (url.endsWith("/api/orders/sales-stats")) return json({ day: 0, month: 0, year: 0 })
    const next = answers.shift()
    if (!next) throw new Error(`chamada inesperada: ${url}`)
    return next()
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  await authClient.login("dono@loja.com", "x")
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("área de campanhas", () => {
  it("consulta a lista autenticada e mostra o total", async () => {
    answers = [() => listing(3)]

    renderPage()

    expect(screen.getByRole("heading", { level: 1, name: "Campanhas" })).toBeTruthy()
    expect(screen.getByText("Carregando campanhas...")).toBeTruthy()
    expect(await screen.findByText("3 campanhas cadastradas.")).toBeTruthy()
    const [url, init] = listCalls()[0]
    expect(url).toBe(`${API_URL}/api/admin/campaigns?size=1`)
    expect(new Headers((init as RequestInit).headers).get("Authorization")).toBe("Bearer access-1")
  })

  it.each([
    [0, "Nenhuma campanha cadastrada."],
    [1, "1 campanha cadastrada."],
  ])("com %i no total, mostra “%s”", async (total, text) => {
    answers = [() => listing(total)]

    renderPage()

    expect(await screen.findByText(text)).toBeTruthy()
  })

  it.each([
    ["a API responde com erro", () => json({}, 500)],
    ["a resposta vem em outro formato", () => json({ content: [] })],
    ["a conexão cai", () => { throw new TypeError("Failed to fetch") }],
  ])("quando %s, avisa e permite tentar de novo", async (_, answer) => {
    answers = [answer, () => listing(2)]
    renderPage()
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar as campanhas.")

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    expect(await screen.findByText("2 campanhas cadastradas.")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("é aberta pelo botão “Campanhas” do painel", async () => {
    answers = [() => listing(0)]
    render(
      <MemoryRouter initialEntries={[ROUTES.admin]}>
        <Routes>
          <Route path={ROUTES.admin} element={<Admin />} />
          <Route path={ROUTES.adminCampaigns} element={<Campaigns />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Campanhas" }))

    expect(await screen.findByText("Nenhuma campanha cadastrada.")).toBeTruthy()
  })

  it("volta ao painel", async () => {
    answers = [() => listing(0)]
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao painel" }))

    expect(screen.getByTestId("admin-panel")).toBeTruthy()
  })
})
