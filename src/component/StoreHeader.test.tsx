// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { StoreHeader } from "./StoreHeader"

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderHeader(overrides: Partial<Parameters<typeof StoreHeader>[0]> = {}) {
  const props = {
    gender: "todos" as const,
    onSale: false,
    showWishlist: false,
    favoritesCount: 0,
    cartCount: 0,
    onSelectGender: vi.fn(),
    onToggleSale: vi.fn(),
    onToggleWishlist: vi.fn(),
    onOpenCart: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <StoreHeader {...props} />
    </MemoryRouter>,
  )
  return props
}

describe("StoreHeader", () => {
  it("avisa a loja ao escolher gênero, promoções, favoritos e carrinho", () => {
    const props = renderHeader()

    fireEvent.click(screen.getAllByRole("button", { name: "masculino" })[0])
    fireEvent.click(screen.getAllByRole("button", { name: "Promoções" })[0])
    fireEvent.click(screen.getByTitle("Minha lista de favoritos"))
    fireEvent.click(screen.getByRole("button", { name: /Carrinho/ }))

    expect(props.onSelectGender).toHaveBeenCalledWith("masculino")
    expect(props.onToggleSale).toHaveBeenCalledOnce()
    expect(props.onToggleWishlist).toHaveBeenCalledOnce()
    expect(props.onOpenCart).toHaveBeenCalledOnce()
  })

  it("destaca o gênero e as promoções escolhidos", () => {
    renderHeader({ gender: "feminino", onSale: true })

    expect(screen.getAllByRole("button", { name: "feminino" })[0].className).toContain("bg-primary")
    expect(screen.getAllByRole("button", { name: "masculino" })[0].className).not.toContain("bg-primary")
    expect(screen.getAllByRole("button", { name: "Promoções" })[0].className).toContain("bg-primary")
  })

  it("mostra a quantidade de favoritos e de itens no carrinho", () => {
    renderHeader({ favoritesCount: 3, cartCount: 2 })

    expect(screen.getByTitle("Minha lista de favoritos").textContent).toBe("3")
    expect(screen.getByText("itens")).toBeTruthy()
  })

  it("no celular, o menu fecha depois de uma escolha", () => {
    const props = renderHeader()

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    const menu = screen.getByRole("dialog")
    fireEvent.click(within(menu).getByRole("button", { name: "unissex" }))

    expect(props.onSelectGender).toHaveBeenCalledWith("unissex")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("mantém a faixa superior", () => {
    renderHeader()

    expect(screen.getByText("Fragrâncias 100% Originais")).toBeTruthy()
    expect(screen.getByText("Parcele em até 12x")).toBeTruthy()
  })
})
