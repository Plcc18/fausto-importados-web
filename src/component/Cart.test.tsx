// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Cart } from "./Cart"
import { notify } from "@/lib/notice"
import type { CartItem } from "@/lib/types"

vi.mock("@/lib/notice", () => ({ notify: vi.fn() }))

const items: CartItem[] = [{
  quantity: 2,
  product: {
    id: "p1", name: "Aventus", brand: "Creed", description: "Notas", price: 100, image: "http://img/x.png",
    category: "masculino", size: "100", olfactiveFamily: "floral", concentration: "", inStock: true,
  },
}]

let fetchMock: ReturnType<typeof vi.fn>
let openWindow: ReturnType<typeof vi.fn>
const onClear = vi.fn()
const onClose = vi.fn()

const sendOrder = () => {
  render(<Cart isOpen onClose={onClose} items={items} onUpdateQuantity={() => {}} onRemove={() => {}} onClear={onClear} />)
  fireEvent.click(screen.getByRole("button", { name: /finalizar compra/i }))
  fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Maria" } })
  fireEvent.change(screen.getByLabelText(/^WhatsApp/), { target: { value: "85999999999" } })
  fireEvent.click(screen.getByRole("button", { name: "Enviar Pedido pelo WhatsApp" }))
}

beforeEach(() => {
  vi.mocked(notify).mockClear()
  onClear.mockClear()
  onClose.mockClear()
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }))
  openWindow = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("open", openWindow)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("envio do pedido", () => {
  it("registra o pedido com Idempotency-Key, abre o WhatsApp e limpa o carrinho", async () => {
    sendOrder()

    await waitFor(() => expect(onClear).toHaveBeenCalled())
    expect(openWindow).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers)
    expect(headers.get("Idempotency-Key")).toMatch(/^[A-Za-z0-9._:-]{16,100}$/)
  })

  it("pedido recusado (400): mantém o carrinho, não abre o WhatsApp e avisa", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "indisponível" }), { status: 400 }))

    sendOrder()

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Pedido não enviado" })))
    expect(onClear).not.toHaveBeenCalled()
    expect(openWindow).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled() // reabrir o carrinho o confere com o catálogo
  })

  it.each([429, 500])("falha do servidor (%i) não impede a venda pelo WhatsApp", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }))

    sendOrder()

    await waitFor(() => expect(openWindow).toHaveBeenCalledTimes(1))
    expect(onClear).toHaveBeenCalled()
  })

  it("sem rede, o pedido também segue pelo WhatsApp", async () => {
    fetchMock.mockRejectedValue(new TypeError("sem rede"))

    sendOrder()

    await waitFor(() => expect(openWindow).toHaveBeenCalledTimes(1))
  })
})
