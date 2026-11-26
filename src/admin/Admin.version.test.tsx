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
let version: number | undefined
let answerPut: () => Promise<Response> | Response

const calls = (method: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => String(url).includes("/api/product") && ((init as RequestInit | undefined)?.method ?? "GET") === method,
  )
const sent = () => calls("PUT").map(([, init]) => JSON.parse(String(((init as RequestInit).body as FormData).get("product"))))

const openEditForm = async () => {
  render(<MemoryRouter><Admin /></MemoryRouter>)
  const row = (await screen.findAllByText("Aventus"))[0].closest("tr")!
  fireEvent.click(within(row).getAllByRole("button")[0]) // lápis
  const dialog = await screen.findByRole("dialog")
  return { dialog, form: dialog.querySelector("form")! }
}

beforeEach(async () => {
  localStorage.clear()
  vi.mocked(notify).mockClear()
  version = 3
  answerPut = () => json({ message: "ok" })
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    const method = init.method ?? "GET"
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/api/orders/sales-stats") return json({ day: 0, month: 0, year: 0 })
    if (path === "/api/product" && method === "GET") return json({ content: [{ ...product, version }] })
    if (path === "/api/product/p1" && method === "PUT") return answerPut()
    throw new Error(`rota inesperada: ${method} ${path}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
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

describe("edição de produto concorrente", () => {
  it("envia a versão lida da API", async () => {
    const { form } = await openEditForm()

    fireEvent.submit(form)

    await waitFor(() => expect(sent()).toHaveLength(1))
    expect(sent()[0].version).toBe(3)
  })

  it("não envia versão quando a API não a informa (versões antigas recusariam o campo)", async () => {
    version = undefined
    const { form } = await openEditForm()

    fireEvent.submit(form)

    await waitFor(() => expect(sent()).toHaveLength(1))
    expect(sent()[0]).not.toHaveProperty("version")
  })

  it("no conflito não sobrescreve: fecha o formulário, recarrega a lista e explica", async () => {
    answerPut = () => json({ code: "version_conflict", message: "alterado" }, 409)
    const { form } = await openEditForm()
    const listed = calls("GET").length

    fireEvent.submit(form)

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(() => expect(calls("GET").length).toBeGreaterThan(listed))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Produto alterado por outra operação" }))
    expect(sent()).toHaveLength(1)
  })

  it("explica o produto repetido sem fechar o formulário", async () => {
    answerPut = () => json({ code: "duplicate_product", message: "Product already exists" }, 409)
    const { form } = await openEditForm()

    fireEvent.submit(form)

    await waitFor(() => expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Já existe um produto com esse nome, marca e tamanho." })))
    expect(screen.queryByRole("dialog")).toBeTruthy()
  })

  it("um envio de cada vez: o duplo clique em salvar manda uma requisição só", async () => {
    let finish!: (res: Response) => void
    answerPut = () => new Promise<Response>((resolve) => { finish = resolve })
    const { dialog, form } = await openEditForm()

    fireEvent.submit(form)
    fireEvent.submit(form)

    await waitFor(() => expect((within(dialog).getByRole("button", { name: "Salvando..." }) as HTMLButtonElement).disabled).toBe(true))
    expect(sent()).toHaveLength(1)
    finish(json({ message: "ok" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
