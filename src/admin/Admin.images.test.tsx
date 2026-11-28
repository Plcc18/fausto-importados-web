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
const IMAGE = "https://res.cloudinary.com/fausto/image/upload/v1/produtos/frasco.webp"

let fetchMock: ReturnType<typeof vi.fn>
let uploadAnswers: (() => Promise<Response>)[]

const created = () =>
  fetchMock.mock.calls
    .filter(([url, init]) => String(url).endsWith("/api/product") && (init as RequestInit | undefined)?.method === "POST")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)))

beforeEach(async () => {
  localStorage.clear()
  uploadAnswers = []
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/api/orders/sales-stats") return json({ day: 0, month: 0, year: 0 })
    if (path === "/api/upload") return uploadAnswers.shift()?.() ?? json({ url: IMAGE })
    if (path === "/api/product" && init.method === "POST") return json({ message: "ok" }, 201)
    if (path === "/api/product") return json({ content: [] })
    throw new Error(`rota inesperada: ${init.method ?? "GET"} ${path}`)
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

async function openNewProduct() {
  fireEvent.click(await screen.findByRole("button", { name: /novo produto/i }))
  return screen.findByRole("dialog")
}

const send = (dialog: HTMLElement) =>
  fireEvent.change(within(dialog).getByTestId("image-input"), {
    target: { files: [new File(["x"], "frasco.webp", { type: "image/webp" })] },
  })

const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: /criar produto|enviando imagem/i }) as HTMLButtonElement

// O painel inteiro, com o diálogo de cadastro: com muitos arquivos em paralelo isso passa do prazo padrão (5 s)
describe("imagem do produto", { timeout: 30_000 }, () => {
  it("é enviada pelo mesmo campo das campanhas e vai no cadastro", async () => {
    render(<MemoryRouter><Admin /></MemoryRouter>)
    const dialog = await openNewProduct()
    const type = (label: string, value: string) =>
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })
    type("Nome do Perfume", "Aventus")
    type("Marca", "Creed")
    type("Descrição", "Notas")
    type("Preço (R$)", "100")

    send(dialog)
    await waitFor(() =>
      expect(within(dialog).getByRole("img", { name: "Pré-visualização do produto" }).getAttribute("src")).toBe(IMAGE),
    )
    fireEvent.submit(dialog.querySelector("form")!)

    await waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0].image).toBe(IMAGE)
    const upload = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/upload"))!
    expect(((upload[1] as RequestInit).body as FormData).get("image")).toBeInstanceOf(File)
  })

  it("fechar o cadastro no meio do envio não leva a imagem para o próximo produto", async () => {
    let finish!: (res: Response) => void
    uploadAnswers = [() => new Promise<Response>((resolve) => { finish = resolve })]
    render(<MemoryRouter><Admin /></MemoryRouter>)
    const first = await openNewProduct()
    send(first)
    await waitFor(() => expect(submit(first).disabled).toBe(true))

    fireEvent.click(within(first).getByRole("button", { name: "Cancelar" }))
    const second = await openNewProduct()
    // o envio abandonado não deixa o botão preso em "Enviando imagem..."
    expect(submit(second).disabled).toBe(false)
    finish(json({ url: IMAGE }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(within(second).queryByRole("img", { name: "Pré-visualização do produto" })).toBeNull()
    expect(submit(second).disabled).toBe(false)
  })
})
