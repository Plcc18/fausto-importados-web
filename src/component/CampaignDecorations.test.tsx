// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { CampaignState } from "@/lib/campaign/store"
import { DECORATION_TYPES, type DecorationType, type PublicCampaign } from "@/lib/campaign/types"
import { DECORATION_KINDS } from "@/lib/campaign/decorations"

// O hook real busca na API; aqui o estado é controlado pelo teste
const campaignState = vi.hoisted(() => ({ current: { status: "ready", campaign: null } as CampaignState }))
vi.mock("@/lib/campaign/useActiveCampaign", () => ({ useActiveCampaign: () => campaignState.current }))

const { CampaignDecorations } = await import("./CampaignDecorations")
const { Store } = await import("./Store")

const layer = () => screen.queryByTestId("campaign-decorations")
const particles = (type?: DecorationType) =>
  [...document.querySelectorAll<SVGElement>(type ? `[data-decoration="${type}"]` : "[data-decoration]")]

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  campaignState.current = { status: "ready", campaign: null }
})

describe("CampaignDecorations", () => {
  it("sem enfeites ligados, não desenha nada", () => {
    render(<CampaignDecorations decorations={[]} />)

    expect(layer()).toBeNull()
  })

  it.each(DECORATION_TYPES)("%s pode ser ligado sozinho", (type) => {
    render(<CampaignDecorations decorations={[type]} />)

    expect(particles(type)).toHaveLength(DECORATION_KINDS[type].count)
    expect(particles()).toHaveLength(DECORATION_KINDS[type].count)
  })

  it("liga e desliga cada um sem afetar os outros", () => {
    const view = render(<CampaignDecorations decorations={["SNOW", "STARS"]} />)
    expect(particles("SNOW").length).toBeGreaterThan(0)
    expect(particles("STARS").length).toBeGreaterThan(0)

    view.rerender(<CampaignDecorations decorations={["STARS"]} />)
    expect(particles("SNOW")).toHaveLength(0)
    expect(particles("STARS")).toHaveLength(DECORATION_KINDS.STARS.count)

    view.rerender(<CampaignDecorations decorations={[]} />)
    expect(layer()).toBeNull()
  })

  it("não recebe cliques, leitores de tela a ignoram e some na impressão", () => {
    render(<CampaignDecorations decorations={["HEARTS"]} />)

    const classes = layer()!.className.split(" ")
    expect(layer()!.getAttribute("aria-hidden")).toBe("true")
    expect(classes).toEqual(expect.arrayContaining(["pointer-events-none", "fixed", "inset-0", "print:hidden"]))
    for (const svg of particles()) expect(svg.getAttribute("focusable")).toBe("false")
  })


  it.each(DECORATION_TYPES)("%s no celular: metade das partículas, espalhadas pela largura toda", (type) => {
    render(<CampaignDecorations decorations={[type]} />)

    const mobile = particles().filter((svg) => !svg.getAttribute("class")!.includes("hidden md:block"))
    const lefts = mobile.map((svg) => parseFloat(svg.style.left))
    expect(mobile).toHaveLength(DECORATION_KINDS[type].mobileCount)
    expect(Math.min(...lefts)).toBeLessThan(25)
    expect(Math.max(...lefts)).toBeGreaterThan(75)
  })

  it("cada partícula leva o movimento do tipo e as variáveis da animação", () => {
    render(<CampaignDecorations decorations={["SNOW", "HEARTS", "SPARKLES", "RIBBONS"]} />)

    expect(particles("SNOW")[0].getAttribute("class")).toContain("campaign-decor-fall")
    expect(particles("HEARTS")[0].getAttribute("class")).toContain("campaign-decor-rise")
    expect(particles("SPARKLES")[0].getAttribute("class")).toContain("campaign-decor-twinkle")
    expect(particles("RIBBONS")[0].getAttribute("class")).toContain("campaign-decor-sway")
    const style = particles("SNOW")[0].style
    for (const name of ["--decor-top", "--decor-duration", "--decor-delay", "--decor-drift", "--decor-opacity"]) {
      expect(style.getPropertyValue(name)).not.toBe("")
    }
  })
})

describe("redução de movimento (index.css)", () => {
  const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf-8")

  it("com \"reduzir movimento\", os enfeites ficam parados na posição de repouso", () => {
    const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1])

    expect(reduced.some((block) => /\.campaign-decor \{ animation: none; top: var\(--decor-top\);/.test(block))).toBe(true)
  })

  it("só anima transform e opacity (o navegador não precisa recalcular o layout)", () => {
    const keyframes = [...css.matchAll(/@keyframes campaign-[\w-]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1])

    expect(keyframes).toHaveLength(4)
    for (const block of keyframes) {
      const properties = [...block.matchAll(/([a-z-]+):/g)].map((m) => m[1])
      expect(properties.every((property) => property === "transform" || property === "opacity")).toBe(true)
    }
  })
})

describe("na loja", () => {
  beforeEach(() => {
    localStorage.clear()
    const products = [{
      id: "p1", name: "Bleu Intense", brand: "Marca", description: "d", price: 100, image: "/x.png",
      category: "MASCULINO", size: "100ml", inStock: true, stockQuantity: 5, olfactiveFamily: "floral",
    }]
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: products }) }) as Response))
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false, media: query, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
    }))
  })

  async function renderStore() {
    render(
      <MemoryRouter>
        <Store />
      </MemoryRouter>,
    )
    await act(async () => {})
  }

  it("com enfeites ligados, a loja continua funcionando (carrinho incluso)", async () => {
    campaignState.current = {
      status: "ready",
      campaign: {
        id: "c1", type: "CHRISTMAS", collections: [],
        content: { topBar: null, hero: null, promoImages: [], decorations: ["SNOW", "STARS"] },
      } as unknown as PublicCampaign,
    }
    await renderStore()

    expect(layer()).not.toBeNull()
    // Abaixo do cabeçalho: menu e carrinho sempre limpos
    const zIndex = (className: string) => Number(/\bz-(\d+)\b/.exec(className)?.[1])
    expect(zIndex(layer()!.className)).toBeLessThan(zIndex(document.querySelector("header")!.className))
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }))
    expect(screen.getByRole("button", { name: /1\s*item/ })).toBeTruthy()
  })

  it("sem campanha, nenhum enfeite", async () => {
    await renderStore()

    expect(layer()).toBeNull()
  })
})
