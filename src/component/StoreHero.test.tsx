// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Sparkles } from "lucide-react"
import { Store } from "./Store"
import { StoreHero } from "./StoreHero"
import type { QuickFilter } from "./storeTypes"

const quickFilter: QuickFilter = {
  id: "lancamentos",
  label: "Novidades",
  icon: Sparkles,
  description: "Lançamentos recentes",
  apply: (filters) => filters,
  isActive: () => false,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("StoreHero", () => {
  it("o hero tem um h1", () => {
    render(<StoreHero quickFilters={[quickFilter]} activeQuickFilterId={null} onQuickFilter={vi.fn()} />)

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  it("avisa a loja ao escolher um filtro rápido e destaca o ativo", () => {
    const onQuickFilter = vi.fn()
    render(<StoreHero quickFilters={[quickFilter]} activeQuickFilterId="lancamentos" onQuickFilter={onQuickFilter} />)
    const button = screen.getByRole("button", { name: /Novidades/ })

    fireEvent.click(button)

    expect(onQuickFilter).toHaveBeenCalledWith(quickFilter)
    expect(button.className).toContain("bg-primary")
  })
})

describe("loja inteira", () => {
  // Guarda para a T23: com ou sem banner de campanha, a página tem um único h1
  it("tem um único h1", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false, media: query, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
    }))

    render(
      <MemoryRouter>
        <Store />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })
})
