// @vitest-environment jsdom
/**
 * T24 na loja inteira: seções das coleções, `?colecao=`, selo e imagens de divulgação. "Pronto quando": nenhuma
 * requisição por produto, e busca, filtros e carrinho continuam funcionando.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import type { CampaignState } from "@/lib/campaign/store"
import type { PublicCampaign } from "@/lib/campaign/types"

// O hook real busca na API; aqui o estado é controlado pelo teste
const campaignState = vi.hoisted(() => ({ current: { status: "ready", campaign: null } as CampaignState }))
vi.mock("@/lib/campaign/useActiveCampaign", () => ({ useActiveCampaign: () => campaignState.current }))

const { Store } = await import("./Store")

const PROMO = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/promo.jpg"

const product = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, brand: "Marca", description: "d", price: 100, image: "/x.png", category: "MASCULINO",
  size: "100ml", inStock: true, stockQuantity: 5, olfactiveFamily: "floral", ...extra,
})
const CATALOG = [
  product("p1", "Bleu Intense"),
  product("p2", "Rose Absolue", { category: "FEMININO" }),
  product("p3", "Oud Royal"),
  product("p4", "Citrus Fresh"),
  product("p5", "Vanilla Noir"),
  product("p6", "Fora da campanha"),
]

function withCampaign(overrides: Partial<PublicCampaign> = {}) {
  campaignState.current = {
    status: "ready",
    campaign: {
      id: "c1",
      type: "BLACK_FRIDAY",
      theme: { dark: {}, light: null },
      content: { topBar: null, hero: null, promoImages: [], decorations: [] },
      collections: [
        { title: "Ofertas", slug: "ofertas", position: 0, productIds: ["p3", "p1", "p2", "p4", "p5", "removido"] },
        { title: "Vazia", slug: "vazia", position: 1, productIds: ["nao-existe"] },
      ],
      ...overrides,
    } as unknown as PublicCampaign,
  }
}

let fetchMock: ReturnType<typeof vi.fn>

/** Entradas de histórico já visitadas (cada navegação "empurrada" ganha uma `key` nova). */
let historyKeys = new Set<string>()

function Location() {
  const { search, key } = useLocation()
  historyKeys.add(key)
  return <output data-testid="search">{search}</output>
}

async function renderStore(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Store />
      <Location />
    </MemoryRouter>,
  )
  await act(async () => {}) // catálogo da API
}

/** Os cards da vitrine (a seção `#colecao`), sem os das seções da campanha. */
const catalogNames = () =>
  within(document.getElementById("colecao")!)
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent)

beforeEach(() => {
  historyKeys = new Set()
  localStorage.clear()
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: CATALOG }) }) as Response)
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  campaignState.current = { status: "ready", campaign: null }
})

describe("seções das coleções", () => {
  it("mostram os produtos do catálogo, na ordem da campanha, até 4 por seção; coleção vazia some", async () => {
    withCampaign()
    await renderStore()

    const section = screen.getByRole("region", { name: "Ofertas" })
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Oud Royal", "Bleu Intense", "Rose Absolue", "Citrus Fresh",
    ])
    expect(within(section).getByRole("button", { name: /Ver todos \(5\)/ })).toBeTruthy()
    expect(screen.queryByRole("region", { name: "Vazia" })).toBeNull()
  })

  it("nenhuma requisição por produto: só o catálogo", async () => {
    withCampaign()
    await renderStore()

    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(["/api/product"])
  })

  it("sem campanha, nenhuma seção nem selo", async () => {
    await renderStore()

    expect(screen.queryByTestId("campaign-collections")).toBeNull()
    expect(screen.queryByText("Black Friday")).toBeNull()
  })

  it("selo nos produtos participantes, também na vitrine", async () => {
    withCampaign()
    await renderStore()

    const catalog = document.getElementById("colecao")!
    const card = (name: string) => within(catalog).getByText(name).closest("[data-slot='card']")!
    expect(within(card("Oud Royal") as HTMLElement).getByText("Black Friday")).toBeTruthy()
    expect(within(card("Fora da campanha") as HTMLElement).queryByText("Black Friday")).toBeNull()
  })

  it("o carrinho funciona a partir de uma seção da campanha", async () => {
    withCampaign()
    await renderStore()

    const section = screen.getByRole("region", { name: "Ofertas" })
    fireEvent.click(within(section).getAllByRole("button", { name: /Adicionar/ })[0])

    expect(screen.getByRole("button", { name: /1\s*item/ })).toBeTruthy()
  })
})

describe("?colecao=", () => {
  it("o link direto filtra a vitrine pela coleção, na ordem da campanha", async () => {
    withCampaign()
    await renderStore("/?colecao=ofertas")

    expect(catalogNames()).toEqual(["Oud Royal", "Bleu Intense", "Rose Absolue", "Citrus Fresh", "Vanilla Noir"])
    expect(screen.getByText("Coleção: Ofertas")).toBeTruthy()
  })

  it("\"Ver todos\" abre a coleção na vitrine e muda a URL", async () => {
    withCampaign()
    await renderStore()

    fireEvent.click(screen.getByRole("button", { name: /Ver todos \(5\)/ }))

    expect(screen.getByTestId("search").textContent).toBe("?colecao=ofertas")
    expect(catalogNames()).toHaveLength(5)
  })

  it("combina com a busca e com os outros filtros", async () => {
    withCampaign()
    await renderStore("/?colecao=ofertas")

    fireEvent.click(screen.getAllByRole("button", { name: "feminino" })[0])

    expect(catalogNames()).toEqual(["Rose Absolue"])
  })

  it("tirar a etiqueta da coleção volta à vitrine completa", async () => {
    withCampaign()
    await renderStore("/?colecao=ofertas")

    fireEvent.click(screen.getByRole("button", { name: "Remover filtro de coleção" }))

    expect(screen.getByTestId("search").textContent).toBe("")
    expect(catalogNames()).toHaveLength(6)
  })

  it("coleção que não existe (ou campanha que terminou) não filtra nada", async () => {
    withCampaign()
    await renderStore("/?colecao=natal-2025")

    expect(catalogNames()).toHaveLength(6)
    expect(screen.queryByText(/Coleção:/)).toBeNull()
  })
})

describe("?colecao= e o histórico", () => {
  it("\"Limpar filtros\" sem coleção aberta não cria entradas no histórico (o voltar continua saindo da loja)", async () => {
    withCampaign()
    await renderStore()
    fireEvent.click(screen.getAllByRole("button", { name: "masculino" })[0])
    const before = historyKeys.size

    fireEvent.click(screen.getByRole("button", { name: /Limpar/ }))

    expect(historyKeys.size).toBe(before)
  })

  it("\"Ver todos\" na coleção que já está aberta leva de novo até a vitrine", async () => {
    withCampaign()
    await renderStore("/?colecao=ofertas")
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    scroll.mockClear()

    fireEvent.click(screen.getByRole("button", { name: /Ver todos \(5\)/ }))

    expect(scroll).toHaveBeenCalled()
  })

  it("desligar um filtro rápido não tira a coleção", async () => {
    withCampaign()
    await renderStore("/?colecao=ofertas")
    const quick = screen.getByRole("button", { name: /Novidades/ })

    fireEvent.click(quick)
    fireEvent.click(quick)

    expect(screen.getByText("Coleção: Ofertas")).toBeTruthy()
  })

  it("\"Limpar filtros\" também tira a coleção", async () => {
    withCampaign()
    await renderStore("/?colecao=ofertas")

    fireEvent.click(screen.getByRole("button", { name: /Limpar/ }))

    expect(screen.getByTestId("search").textContent).toBe("")
  })

  it("se a campanha não chegar (API fora), o ?colecao= fica: quando ela chegar, a coleção abre", async () => {
    campaignState.current = { status: "ready", campaign: null }
    await renderStore("/?colecao=ofertas")
    expect(screen.getByTestId("search").textContent).toBe("?colecao=ofertas")
    expect(catalogNames()).toHaveLength(6)

    withCampaign()
    cleanup()
    await renderStore("/?colecao=ofertas")

    expect(screen.getByText("Coleção: Ofertas")).toBeTruthy()
  })

  it("\"Ver todos (N)\" mostra exatamente a coleção: a busca e os outros filtros saem", async () => {
    withCampaign()
    await renderStore()
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "oud" } })
    fireEvent.click(screen.getByTitle("Minha lista de favoritos"))

    fireEvent.click(screen.getByRole("button", { name: /Ver todos \(5\)/ }))

    expect(catalogNames()).toHaveLength(5)
    expect((screen.getByPlaceholderText("Buscar...") as HTMLInputElement).value).toBe("")
  })

  it.each([
    ["sem mexer na página, rola até a vitrine quando a coleção chega", false],
    ["depois de um gesto da pessoa, não rola", true],
  ])("coleção do endereço que só chega depois: %s", async (_, interacted) => {
    campaignState.current = { status: "loading", campaign: null }
    const tree = () => (
      <MemoryRouter initialEntries={["/?colecao=ofertas"]}>
        <Store />
      </MemoryRouter>
    )
    const view = render(tree())
    await act(async () => {})
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    scroll.mockClear()
    if (interacted) fireEvent.wheel(window)

    withCampaign()
    view.rerender(tree())
    await act(async () => {})

    expect(screen.getByText("Coleção: Ofertas")).toBeTruthy()
    expect(scroll.mock.calls.length > 0).toBe(!interacted)
  })

  it("com /#colecao, rola de novo até a vitrine quando as seções da campanha aparecem acima dela", async () => {
    window.history.replaceState(null, "", "/#colecao")
    await renderStore("/#colecao")
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    scroll.mockClear()

    withCampaign()
    // Nova renderização com a campanha (como quando ela chega da API)
    cleanup()
    await renderStore("/#colecao")

    expect(scroll).toHaveBeenCalled()
    window.history.replaceState(null, "", "/")
  })
})

describe("selo no card", () => {
  it("fica no canto de cima (embaixo ficam favorito e compartilhar), usa a largura do card e é cortado se for longo", async () => {
    withCampaign({ type: "VALENTINES_DAY" } as Partial<PublicCampaign>)
    await renderStore()

    const badge = within(document.getElementById("colecao")!).getAllByTitle("Dia dos Namorados")[0]
    expect(badge.className).toContain("top-3")
    expect(badge.className).toContain("max-w-[calc(100%-1.5rem)]")
    expect(badge.querySelector(".truncate")?.textContent).toBe("Dia dos Namorados")
  })

  it.each([
    ["Destaque", { featured: true }],
    ["Oferta", { originalPrice: 999 }],
  ])("com \"%s\" no card, vai para a linha de baixo", async (label, change) => {
    // O "p3" é o primeiro da coleção; a troca vale só para este teste
    const original = CATALOG[2]
    CATALOG[2] = { ...original, ...change }
    try {
      withCampaign()
      await renderStore("/?colecao=ofertas")

      const tag = within(document.getElementById("colecao")!).getByText(label)
      const badge = within(tag.parentElement!).getByTitle("Black Friday")
      expect(badge.className).toContain("top-11")
    } finally {
      CATALOG[2] = original
    }
  })
})

describe("rolagem até a vitrine", () => {
  it("deixa espaço para o cabeçalho fixo não cobrir o título", async () => {
    await renderStore()

    expect(document.getElementById("colecao")!.className.split(" ")).toEqual(
      expect.arrayContaining(["scroll-mt-16", "md:scroll-mt-10"]),
    )
  })
})

describe("imagens de divulgação", () => {
  const promo = (name: string) => ({
    image: { url: `${PROMO.replace("promo", name)}`, alt: name, width: 800, height: 800 },
    link: null,
  })
  const withPromos = (count: number) =>
    withCampaign({
      content: {
        topBar: null,
        hero: null,
        decorations: [],
        promoImages: Array.from({ length: count }, (_, i) => promo(`promo-${i}`)),
      },
    } as Partial<PublicCampaign>)

  it("ficam antes das coleções e da vitrine", async () => {
    withPromos(1)
    await renderStore()

    const promos = screen.getByTestId("campaign-promo-images")
    const collections = screen.getByTestId("campaign-collections")
    const catalog = document.getElementById("colecao")!
    expect(promos.compareDocumentPosition(collections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(collections.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  const itemClasses = () => screen.getAllByTestId("campaign-promo-item").map((item) => item.className)

  it.each([
    [1, "max-w-3xl", "w-full"],
    [2, "max-w-7xl", "sm:w-[calc(50%-0.5rem)]"],
    [3, "max-w-7xl", "lg:w-[calc((100%-2rem)/3)]"],
    [4, "max-w-7xl", "lg:w-[calc((100%-2rem)/3)]"],
  ])("com %i imagem(ns), o formato acompanha a quantidade e a linha que sobra fica centralizada", async (count, container, item) => {
    withPromos(count)
    await renderStore()

    const grid = screen.getByTestId("campaign-promo-grid")
    expect(grid.className.split(" ")).toEqual(expect.arrayContaining(["flex", "flex-wrap", "justify-center", container]))
    expect(itemClasses()).toHaveLength(count)
    for (const classes of itemClasses()) expect(classes).toContain(item)
  })

  it("se uma imagem falhar, as outras não mudam de tamanho nem de lugar", async () => {
    withPromos(2)
    await renderStore()
    const before = itemClasses()[0]

    fireEvent.error(screen.getByRole("img", { name: "promo-1" }))

    expect(itemClasses()).toEqual([before])
  })

  it.each([
    [1, "(min-width: 50rem) 48rem, calc(100vw - 2rem)"],
    [2, "(min-width: 82rem) 39.5rem, (min-width: 40rem) calc(50vw - 1.5rem), calc(100vw - 2rem)"],
    [3, "(min-width: 82rem) 26rem, (min-width: 64rem) calc(33vw - 1.33rem), (min-width: 40rem) calc(50vw - 1.5rem), calc(100vw - 2rem)"],
  ])("com %i imagem(ns), o navegador baixa o tamanho em que ela aparece (com o limite da largura máxima)", async (count, sizes) => {
    withPromos(count)
    await renderStore()

    expect(screen.getByRole("img", { name: "promo-0" }).getAttribute("sizes")).toBe(sizes)
  })

  it("só a primeira carrega já; as demais, ao chegar perto (mesmo se a primeira falhar)", async () => {
    withPromos(3)
    await renderStore()
    const loading = () => [1, 2].map((i) => screen.getByRole("img", { name: `promo-${i}` }).getAttribute("loading"))

    expect(screen.getByRole("img", { name: "promo-0" }).getAttribute("loading")).toBe("eager")
    expect(loading()).toEqual(["lazy", "lazy"])

    fireEvent.error(screen.getByRole("img", { name: "promo-0" }))

    expect(loading()).toEqual(["lazy", "lazy"])
  })

  it("uma campanha nova não herda as falhas da anterior", async () => {
    withPromos(1)
    const tree = () => (
      <MemoryRouter>
        <Store />
      </MemoryRouter>
    )
    const view = render(tree())
    await act(async () => {})
    fireEvent.error(screen.getByRole("img", { name: "promo-0" }))
    expect(screen.queryByTestId("campaign-promo-images")).toBeNull()

    withCampaign({
      content: { topBar: null, hero: null, decorations: [], promoImages: [promo("nova")] },
    } as Partial<PublicCampaign>)
    view.rerender(tree())

    expect(screen.getByRole("img", { name: "nova" })).toBeTruthy()
  })

  it("se uma falhar, as seguintes não são recriadas, e outra com a mesma URL não some junto", async () => {
    withCampaign({
      content: {
        topBar: null,
        hero: null,
        decorations: [],
        promoImages: [
          { image: { url: PROMO, alt: "primeira", width: 800, height: 800 }, link: null },
          { image: { url: PROMO.replace("promo", "outra"), alt: "segunda", width: 800, height: 800 }, link: null },
          { image: { url: PROMO, alt: "mesma URL da primeira", width: 800, height: 800 }, link: "/termos" },
        ],
      },
    } as Partial<PublicCampaign>)
    await renderStore()
    const second = screen.getByRole("img", { name: "segunda" })

    fireEvent.error(screen.getByRole("img", { name: "primeira" }))

    expect(screen.getByRole("img", { name: "segunda" })).toBe(second)
    expect(screen.getByRole("img", { name: "mesma URL da primeira" })).toBeTruthy()
  })

  it("com o banner da campanha, ficam entre os filtros rápidos e as coleções", async () => {
    const IMG = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/banner.jpg"
    withCampaign({
      content: {
        topBar: null,
        decorations: [],
        promoImages: [promo("promo-0")],
        hero: {
          title: "Black Friday",
          subtitle: null,
          imageDesktop: { url: IMG, alt: "Banner", width: 1920, height: 640 },
          imageMobile: null,
          buttons: [],
        },
      },
    } as Partial<PublicCampaign>)
    await renderStore()

    const quickFilter = screen.getByRole("button", { name: /Novidades/ })
    const promos = screen.getByTestId("campaign-promo-images")
    const collections = screen.getByTestId("campaign-collections")
    expect(quickFilter.compareDocumentPosition(promos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(promos.compareDocumentPosition(collections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("aparecem com link (quando há); a que falha some", async () => {
    withCampaign({
      content: {
        topBar: null,
        hero: null,
        decorations: [],
        promoImages: [
          { image: { url: PROMO, alt: "Kits de presente", width: 800, height: 800 }, link: "/?colecao=ofertas" },
          { image: { url: PROMO.replace("promo", "outra"), alt: "Frete grátis", width: null, height: null }, link: null },
        ],
      },
    })
    await renderStore()

    const kits = screen.getByRole("img", { name: "Kits de presente" })
    expect(kits.closest("a")?.getAttribute("href")).toBe("/?colecao=ofertas")
    expect(screen.getByRole("img", { name: "Frete grátis" }).closest("a")).toBeNull()

    fireEvent.error(kits)

    expect(screen.queryByRole("img", { name: "Kits de presente" })).toBeNull()
    expect(screen.getByRole("img", { name: "Frete grátis" })).toBeTruthy()
  })

  it("sem imagens, a seção não aparece", async () => {
    withCampaign()
    await renderStore()

    expect(screen.queryByTestId("campaign-promo-images")).toBeNull()
  })
})
