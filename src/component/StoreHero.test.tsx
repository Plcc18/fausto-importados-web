// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Sparkles } from "lucide-react"
import type { CampaignState } from "@/lib/campaign/store"
import type { CampaignHero, PublicCampaign } from "@/lib/campaign/types"
import type { QuickFilter } from "./storeTypes"

// O hook real busca na API; aqui o estado é controlado pelo teste
const campaignState = vi.hoisted(() => ({ current: { status: "ready", campaign: null } as CampaignState }))
vi.mock("@/lib/campaign/useActiveCampaign", () => ({ useActiveCampaign: () => campaignState.current }))

const { StoreHero } = await import("./StoreHero")
const { Store } = await import("./Store")

const DESKTOP = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/bf-desktop.jpg"
const MOBILE = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/bf-mobile.jpg"

const quickFilter: QuickFilter = {
  id: "lancamentos",
  label: "Novidades",
  icon: Sparkles,
  description: "Lançamentos recentes",
  apply: (filters) => filters,
  isActive: () => false,
}

function hero(overrides: Partial<CampaignHero> = {}): CampaignHero {
  return {
    title: "Black Friday Fausto",
    subtitle: "Até 40% off em perfumes importados",
    imageDesktop: { url: DESKTOP, alt: "Frascos com laço vermelho", width: 1920, height: 640 },
    imageMobile: { url: MOBILE, alt: "Frasco com laço vermelho", width: 1080, height: 1350 },
    buttons: [
      { label: "Ver ofertas", link: "/#colecao", style: "PRIMARY" },
      { label: "Regulamento", link: "/termos", style: "SECONDARY" },
    ],
    ...overrides,
  }
}

function withHero(value: CampaignHero | null) {
  campaignState.current = {
    status: "ready",
    campaign: { id: "c1", type: "BLACK_FRIDAY", collections: [], content: { topBar: null, hero: value, promoImages: [], decorations: [] } } as unknown as PublicCampaign,
  }
}

function renderHero(onQuickFilter = vi.fn(), activeQuickFilterId: string | null = null) {
  return render(
    <MemoryRouter>
      <StoreHero quickFilters={[quickFilter]} activeQuickFilterId={activeQuickFilterId} onQuickFilter={onQuickFilter} />
    </MemoryRouter>,
  )
}

const bannerImage = () => screen.getByRole("img", { name: "Frascos com laço vermelho" })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  campaignState.current = { status: "ready", campaign: null }
})

describe("StoreHero sem campanha", () => {
  it("o hero tem um h1", () => {
    renderHero()

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  it("avisa a loja ao escolher um filtro rápido e destaca o ativo", () => {
    const onQuickFilter = vi.fn()
    renderHero(onQuickFilter, "lancamentos")
    const button = screen.getByRole("button", { name: /Novidades/ })

    fireEvent.click(button)

    expect(onQuickFilter).toHaveBeenCalledWith(quickFilter)
    expect(button.className).toContain("bg-primary")
  })

  it("campanha sem hero (hero: null): o hero de sempre", () => {
    withHero(null)
    renderHero()

    expect(screen.queryByTestId("campaign-banner")).toBeNull()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("perfumaria")
  })
})

describe("StoreHero com banner da campanha (T23)", () => {
  it("o título da campanha é o único h1, no lugar do hero de sempre", () => {
    withHero(hero())
    renderHero()

    const headings = screen.getAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toBe("Black Friday Fausto")
    expect(screen.queryByText("perfumaria")).toBeNull()
    expect(screen.getByText("Até 40% off em perfumes importados")).toBeTruthy()
  })

  it("imagem de computador e de celular, otimizadas pelo Cloudinary", () => {
    withHero(hero())
    renderHero()

    const source = document.querySelector("picture source")
    expect(bannerImage().getAttribute("src")).toBe(
      "https://res.cloudinary.com/fausto/image/upload/f_auto,q_auto,c_limit,w_1920/v1/campaigns/bf-desktop.jpg",
    )
    expect(bannerImage().getAttribute("srcset")).toContain("w_960/v1/campaigns/bf-desktop.jpg 960w")
    expect(bannerImage().getAttribute("fetchpriority")).toBe("high")
    expect(source?.getAttribute("media")).toBe("not all and (min-width: 48rem)")
    expect(source?.getAttribute("srcset")).toContain("w_480/v1/campaigns/bf-mobile.jpg 480w")
  })

  it("reserva o espaço pela proporção real de cada imagem", () => {
    withHero(hero())
    renderHero()

    const banner = screen.getByTestId("campaign-banner")
    expect(banner.style.getPropertyValue("--banner-ratio-desktop")).toBe("1920 / 640")
    expect(banner.style.getPropertyValue("--banner-ratio-mobile")).toBe("1080 / 1350")
    expect(screen.getByTestId("banner-ratio").className).toBe("aspect-(--banner-ratio-mobile) md:aspect-(--banner-ratio-desktop)")
  })

  it("o texto fica na mesma célula da imagem no computador: se for mais alto, a imagem cresce junto (nunca vaza)", () => {
    withHero(hero())
    renderHero()

    const imageArea = screen.getByTestId("banner-ratio").parentElement!
    const textArea = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!
    expect(imageArea.className).toContain("col-start-1 row-start-1")
    expect(textArea.className).toContain("md:row-start-1")
    expect(bannerImage().className).toContain("absolute inset-0 h-full w-full object-cover")
  })

  it("no celular, o texto alternativo é o da imagem de celular", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "not all and (min-width: 48rem)", media: query, addEventListener() {}, removeEventListener() {},
    }))
    withHero(hero())
    renderHero()

    expect(screen.getByRole("img", { name: "Frasco com laço vermelho" })).toBeTruthy()
  })

  it("sem imagem de celular, usa a de computador também no celular", () => {
    withHero(hero({ imageMobile: null }))
    renderHero()

    expect(document.querySelector("picture source")).toBeNull()
    expect(screen.getByTestId("campaign-banner").style.getPropertyValue("--banner-ratio-mobile")).toBe("1920 / 640")
  })

  it("sem dimensões conhecidas, usa as proporções padrão", () => {
    withHero(
      hero({
        imageDesktop: { url: DESKTOP, alt: "Banner", width: null, height: null },
        imageMobile: { url: MOBILE, alt: "Banner", width: null, height: null },
      }),
    )
    renderHero()

    const banner = screen.getByTestId("campaign-banner")
    expect(screen.getByRole("img", { name: "Banner" })).toBeTruthy()
    expect(banner.style.getPropertyValue("--banner-ratio-desktop")).toBe("3 / 1")
    expect(banner.style.getPropertyValue("--banner-ratio-mobile")).toBe("4 / 5")
  })

  it("se a imagem falhar, volta ao hero de sempre", () => {
    withHero(hero())
    renderHero()

    fireEvent.error(bannerImage())

    expect(screen.queryByTestId("campaign-banner")).toBeNull()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("perfumaria")
  })

  it("reordenar os botões mantém cada um como o mesmo elemento (chave estável)", () => {
    withHero(hero())
    const view = renderHero()
    const first = screen.getByRole("link", { name: "Ver ofertas" })

    withHero(hero({ buttons: [...hero().buttons].reverse() }))
    view.rerender(
      <MemoryRouter>
        <StoreHero quickFilters={[quickFilter]} activeQuickFilterId={null} onQuickFilter={vi.fn()} />
      </MemoryRouter>,
    )

    // O mesmo botão continua sendo o mesmo elemento, agora na segunda posição
    expect(screen.getAllByRole("link")[1]).toBe(first)
  })

  it("no máximo 2 botões, e repetidos não quebram a renderização", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const same = { label: "Ver ofertas", link: "/#colecao", style: "PRIMARY" as const }
    withHero(hero({ buttons: [same, same, same] }))
    renderHero()

    expect(screen.getAllByRole("link", { name: "Ver ofertas" })).toHaveLength(2)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it("botões com o estilo de cada um e os links da campanha", () => {
    withHero(hero())
    renderHero()

    const primary = screen.getByRole("link", { name: "Ver ofertas" })
    const secondary = screen.getByRole("link", { name: "Regulamento" })
    expect(primary.getAttribute("href")).toBe("/#colecao")
    expect(primary.className).toContain("bg-primary")
    expect(secondary.getAttribute("href")).toBe("/termos")
    expect(secondary.className).toContain("bg-secondary")
  })

  it("sem subtítulo nem botões, mostra só o título", () => {
    withHero(hero({ subtitle: null, buttons: [] }))
    renderHero()

    expect(screen.getByTestId("campaign-banner").querySelectorAll("p, a")).toHaveLength(0)
  })

  it("os filtros rápidos e os selos continuam abaixo do banner", () => {
    withHero(hero())
    const onQuickFilter = vi.fn()
    renderHero(onQuickFilter)

    fireEvent.click(screen.getByRole("button", { name: /Novidades/ }))

    expect(onQuickFilter).toHaveBeenCalledWith(quickFilter)
    expect(screen.getByText("100% Original")).toBeTruthy()
  })
})

describe("loja inteira", () => {
  // Com ou sem banner de campanha, a página tem um único h1
  it.each([
    ["sem campanha", false],
    ["com banner", true],
  ])("tem um único h1 (%s)", (_, withBanner) => {
    if (withBanner) withHero(hero())
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
