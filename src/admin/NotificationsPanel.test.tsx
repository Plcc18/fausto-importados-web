// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { NotificationsPanel } from "./NotificationsPanel"
import { authClient } from "@/lib/auth"
import { notify } from "@/lib/notice"

vi.mock("@/lib/notice", () => ({ notify: vi.fn() }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const order = {
  id: "o1", customerName: "Maria", customerWhatsapp: "85999999999", paymentMethod: "pix", total: 100,
  status: "PENDING", createdAt: "2026-03-01T12:00:00",
  items: [{ id: "i1", productName: "Aventus", productSize: "100", quantity: 1, unitPrice: 100 }],
}

let fetchMock: ReturnType<typeof vi.fn>
let answer: () => Promise<Response> | Response

const posts = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    .filter(([url]) => String(url).includes("/api/orders/"))
    .map(([url, init]) => ({ url: String(url), key: new Headers((init as RequestInit).headers).get("Idempotency-Key") }))

const askToComplete = async () => {
  render(<NotificationsPanel open onOpenChange={() => {}} />)
  fireEvent.click(await screen.findByRole("button", { name: "Concluir" }))
  const confirm = await screen.findByRole("button", { name: "Sim, concluir" })
  return confirm.closest("[role=dialog]") as HTMLElement
}
const confirmIn = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole("button", { name: "Sim, concluir" }))

beforeEach(async () => {
  localStorage.clear()
  vi.mocked(notify).mockClear()
  answer = () => json({ ...order, status: "COMPLETED" })
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/api/orders" && !init.method) return json([order])
    if (path === "/api/orders/o1/complete") return answer()
    throw new Error(`rota inesperada: ${init.method ?? "GET"} ${path}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  await authClient.login("dono@loja.com", "x")
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("concluir pedido", () => {
  it("duplo clique envia uma vez só, com Idempotency-Key, e trava os botões", async () => {
    let finish!: (res: Response) => void
    answer = () => new Promise<Response>((resolve) => { finish = resolve })
    const dialog = await askToComplete()

    const button = within(dialog).getByRole("button", { name: "Sim, concluir" })
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect((within(dialog).getByRole("button", { name: "Voltar" }) as HTMLButtonElement).disabled).toBe(true))
    expect(posts()).toHaveLength(1)
    expect(posts()[0].key).toMatch(/^[A-Za-z0-9._:-]{16,100}$/)
    finish(json(order))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull())
  })

  it("sem resposta, mantém o diálogo e a nova tentativa repete a mesma chave", async () => {
    answer = () => Promise.reject(new TypeError("sem rede"))
    const dialog = await askToComplete()

    confirmIn(dialog)
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Sim, concluir" })).toBeTruthy())
    answer = () => json(order)
    confirmIn(dialog)

    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(posts()[1].key).toBe(posts()[0].key)
  })

  it("recusa da API vira um aviso do site, em português", async () => {
    answer = () => json({ error: "Only PENDING orders can be completed" }, 409)

    confirmIn(await askToComplete())

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "Pedido não concluído", text: "Este pedido já foi concluído ou cancelado.",
    })))
  })
})
