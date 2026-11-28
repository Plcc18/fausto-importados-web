// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Admin } from "./Admin"
import { authClient } from "@/lib/auth"
import { notify } from "@/lib/notice"

vi.mock("@/admin/useAdminPushNotifications", () => ({
  useAdminPushNotifications: () => ({ pendingCount: 0, poll: vi.fn() }),
}))
vi.mock("@/admin/NotificationsPanel", () => ({ NotificationsPanel: () => null }))
vi.mock("@/lib/notice", () => ({ notify: vi.fn() }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const product = {
  id: "p1", name: "Aventus", brand: "Creed", description: "Notas", price: 100, image: "http://img/x.png",
  category: "MASCULINO", size: "100", olfactiveFamily: "FLORAL", featured: false, inStock: true, stockQuantity: 7,
}

let fetchMock: ReturnType<typeof vi.fn>

const writes = () =>
  fetchMock.mock.calls
    .filter(([url, init]) => String(url).includes("/api/product") && ["POST", "PUT"].includes((init as RequestInit | undefined)?.method ?? ""))
    .map(([, init]) => {
      const body = (init as RequestInit).body
      return JSON.parse(body instanceof FormData ? String(body.get("product")) : String(body))
    })

const warned = () =>
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({ icon: "warning", title: "Família olfativa obrigatória" }),
  )

beforeEach(async () => {
  localStorage.clear()
  vi.mocked(notify).mockClear()
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    const method = init.method ?? "GET"
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/api/orders/sales-stats") return json({ day: 0, month: 0, year: 0 })
    if (path === "/api/upload") return json({ url: "http://img/novo.png" })
    if (path === "/api/product" && method === "GET") return json({ content: [{ ...product, version: 3 }] })
    if (path === "/api/product" && method === "POST") return json({ message: "ok" }, 201)
    if (path === "/api/product/p1" && method === "PUT") return json({ message: "ok" })
    throw new Error(`rota inesperada: ${method} ${path}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  URL.createObjectURL = vi.fn(() => "blob:previa")
  URL.revokeObjectURL = vi.fn()
  await authClient.login("dono@loja.com", "x")
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

// O painel inteiro, com o diálogo: com muitos arquivos em paralelo isso passa do prazo padrão (5 s)
describe("família olfativa obrigatória", { timeout: 30_000 }, () => {
  it("num produto novo, avisa o que falta em vez de enviar; marcada uma, cadastra", async () => {
    render(<MemoryRouter><Admin /></MemoryRouter>)
    fireEvent.click(await screen.findByRole("button", { name: /novo produto/i }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Família Olfativa (selecione ao menos uma)")).toBeTruthy()
    const type = (label: string, value: string) =>
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })
    type("Nome do Perfume", "Sauvage")
    type("Marca", "Dior")
    type("Descrição", "Notas")
    type("Preço (R$)", "100")
    fireEvent.change(within(dialog).getByTestId("image-input"), {
      target: { files: [new File(["x"], "frasco.png", { type: "image/png" })] },
    })
    await within(dialog).findByRole("img", { name: "Pré-visualização do produto" })
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Criar Produto" })).toBeTruthy())

    fireEvent.submit(dialog.querySelector("form")!)

    warned()
    expect(writes()).toHaveLength(0)
    expect(screen.getByRole("dialog")).toBe(dialog) // nada do que foi digitado se perde
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Floral" }))
    fireEvent.submit(dialog.querySelector("form")!)

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0].olfactiveFamily).toBe("FLORAL")
  })

  it("na edição, desmarcar todas também avisa antes de enviar", async () => {
    render(<MemoryRouter><Admin /></MemoryRouter>)
    const row = (await screen.findAllByText("Aventus"))[0].closest("tr")!
    fireEvent.click(within(row).getAllByRole("button")[0]) // lápis
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Floral" }))

    fireEvent.submit(dialog.querySelector("form")!)

    warned()
    expect(writes()).toHaveLength(0)
  })
})
