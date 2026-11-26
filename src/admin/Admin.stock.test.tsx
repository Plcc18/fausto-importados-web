// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Admin } from "./Admin"
import { authClient } from "@/lib/auth"

// Pedidos e notificações não interessam aqui (e abririam polls).
vi.mock("@/admin/useAdminPushNotifications", () => ({
  useAdminPushNotifications: () => ({ pendingCount: 0, poll: vi.fn() }),
}))
vi.mock("@/admin/NotificationsPanel", () => ({ NotificationsPanel: () => null }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const product = {
  id: "p1", name: "Aventus", brand: "Creed", description: "Notas", price: 100, image: "http://img/x.png",
  category: "MASCULINO", size: "100", olfactiveFamily: "FLORAL", featured: false, inStock: true,
}

let fetchMock: ReturnType<typeof vi.fn>
/** A API só devolve o estoque a administradores autenticados; versões antigas não o devolvem a ninguém. */
let apiSendsStock: boolean

function installApi() {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    const method = init.method ?? "GET"
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/api/orders/sales-stats") return json({ day: 0, month: 0, year: 0 })
    if (path === "/api/product" && method === "GET") {
      const isAdmin = new Headers(init.headers).get("Authorization") === "Bearer access-1"
      return json({ content: [apiSendsStock && isAdmin ? { ...product, stockQuantity: 7 } : product] })
    }
    if (path === "/api/product/p1" && method === "PUT") return json({ message: "ok" })
    throw new Error(`rota inesperada: ${method} ${path}`)
  })
}

const saved = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
    .map(([, init]) => JSON.parse(String(((init as RequestInit).body as FormData).get("product"))))

const openEditForm = async () => {
  render(<MemoryRouter><Admin /></MemoryRouter>)
  const row = (await screen.findAllByText("Aventus"))[0].closest("tr")!
  fireEvent.click(within(row).getAllByRole("button")[0]) // lápis
  const dialog = await screen.findByRole("dialog")
  return {
    row,
    stock: within(dialog).getByLabelText("Quantidade em estoque") as HTMLInputElement,
    form: dialog.querySelector("form")!,
  }
}

beforeEach(async () => {
  localStorage.clear()
  apiSendsStock = true
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  installApi()
  await authClient.login("dono@loja.com", "x")
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("estoque no painel", () => {
  it("busca os produtos autenticado e preserva o estoque ao salvar uma edição", async () => {
    const { row, stock, form } = await openEditForm()

    expect(within(row).getByText("7 un.")).toBeTruthy()
    expect(stock.value).toBe("7")

    fireEvent.submit(form)
    await waitFor(() => expect(saved()).toHaveLength(1))
    expect(saved()[0].stockQuantity).toBe(7)
  })

  it("sem o estoque na resposta, não presume zero: exige que seja digitado antes de salvar", async () => {
    apiSendsStock = false
    const { row, stock, form } = await openEditForm()

    expect(within(row).queryByText("0 un.")).toBeNull()
    expect(within(row).getByText("—")).toBeTruthy()
    expect(stock.value).toBe("")
    expect(screen.getByText(/estoque atual não foi informado/i)).toBeTruthy()

    fireEvent.submit(form)
    expect(saved()).toHaveLength(0)

    fireEvent.change(stock, { target: { value: "4" } })
    fireEvent.submit(form)
    await waitFor(() => expect(saved()).toHaveLength(1))
    expect(saved()[0].stockQuantity).toBe(4)
  })

  it("um produto novo continua começando com estoque 0", async () => {
    render(<MemoryRouter><Admin /></MemoryRouter>)
    await screen.findAllByText("Aventus")

    fireEvent.click(screen.getByRole("button", { name: /novo produto|adicionar produto/i }))
    const dialog = await screen.findByRole("dialog")

    expect((within(dialog).getByLabelText("Quantidade em estoque") as HTMLInputElement).value).toBe("0")
  })
})
