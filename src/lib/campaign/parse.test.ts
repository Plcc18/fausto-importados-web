import { afterEach, describe, expect, it, vi } from "vitest"
import { isCloudinaryImageUrl, isColor, isSafeLink, parseActiveCampaignResponse, parsePublicCampaign } from "./parse"

const IMAGE = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/banner.webp"

/** Uma campanha completa e válida, no formato do contrato (§5.4). Cada teste estraga uma parte. */
function validCampaign() {
  return {
    id: "5e0c6b7a-1111-4222-8333-944455556666",
    type: "BLACK_FRIDAY",
    startsAt: "2026-11-27T03:00:00Z",
    endsAt: "2026-12-01T03:00:00Z",
    updatedAt: "2026-11-26T18:00:00Z",
    theme: {
      dark: {
        background: "#0B0B0F",
        foreground: "#F5F1E8",
        primary: "#C1121F",
        primaryForeground: "#FFFFFF",
        accent: "#1F1F27",
        surface: null,
        mutedForeground: null,
        border: null,
        badge: "#C1121F",
        badgeForeground: "#FFFFFF",
        gold: null,
      },
      light: null,
    },
    content: {
      topBar: { text: "Black Friday: até 40%", link: "/?colecao=ofertas" },
      hero: {
        title: "Black Friday Fausto",
        subtitle: null,
        imageDesktop: { url: IMAGE, alt: "Frascos com laço", width: 1920, height: 640 },
        imageMobile: null,
        buttons: [{ label: "Ver ofertas", link: "/?colecao=ofertas", style: "PRIMARY" }],
      },
      promoImages: [{ image: { url: IMAGE, alt: "Promoção", width: null, height: null }, link: null }],
      decorations: ["SPARKLES"],
    },
    collections: [
      { title: "Mais vendidos", slug: "mais-vendidos", position: 1, productIds: ["p3"] },
      { title: "Ofertas", slug: "ofertas", position: 0, productIds: ["p1", "p2"] },
    ],
  }
}

afterEach(() => vi.restoreAllMocks())

describe("parsePublicCampaign", () => {
  it("aceita uma campanha no formato do contrato", () => {
    const campaign = parsePublicCampaign(validCampaign())

    expect(campaign).not.toBeNull()
    expect(campaign?.theme.dark.primary).toBe("#C1121F")
    expect(campaign?.content.hero?.buttons[0].style).toBe("PRIMARY")
  })

  it("ordena as coleções pela posição", () => {
    const campaign = parsePublicCampaign(validCampaign())

    expect(campaign?.collections.map((c) => c.slug)).toEqual(["ofertas", "mais-vendidos"])
  })

  it("descarta o que estiver fora do contrato", () => {
    const data = { ...validCampaign(), name: "interno", priority: 10 }
    data.theme.dark = { ...data.theme.dark, extra: "url(https://evil.example)" } as typeof data.theme.dark

    const campaign = parsePublicCampaign(data)

    expect(campaign).not.toHaveProperty("name")
    expect(campaign).not.toHaveProperty("priority")
    expect(campaign?.theme.dark).not.toHaveProperty("extra")
  })

  it("trata listas ausentes de content como vazias", () => {
    const data = validCampaign()
    const content: Record<string, unknown> = { ...data.content }
    delete content.promoImages
    delete content.decorations

    const campaign = parsePublicCampaign({ ...data, content })

    expect(campaign?.content.promoImages).toEqual([])
    expect(campaign?.content.decorations).toEqual([])
  })

  it("content null vira conteúdo vazio, sem descartar o tema", () => {
    const campaign = parsePublicCampaign({ ...validCampaign(), content: null })

    expect(campaign?.theme.dark.primary).toBe("#C1121F")
    expect(campaign?.content).toEqual({ topBar: null, hero: null, promoImages: [], decorations: [] })
  })

  it("aceita coleção sem produtos e datas com fração de segundo", () => {
    const data = validCampaign()
    data.collections[0].productIds = []
    data.updatedAt = "2026-11-26T18:00:00.123456Z"

    const campaign = parsePublicCampaign(data)

    expect(campaign?.collections.find((c) => c.slug === "mais-vendidos")?.productIds).toEqual([])
  })

  it("devolve null quando não há campanha", () => {
    expect(parsePublicCampaign(null)).toBeNull()
  })

  // Cada caso estraga um campo: a campanha inteira é descartada (tema padrão), sem lançar exceção.
  const malformed: [string, (c: ReturnType<typeof validCampaign>) => unknown][] = [
    ["não é um objeto", () => "campanha"],
    ["tipo de campanha desconhecido", (c) => ({ ...c, type: "HALLOWEEN" })],
    ["sem paleta escura", (c) => ({ ...c, theme: { ...c.theme, dark: null } })],
    ["cor que tenta injetar CSS", (c) => ({ ...c, theme: { ...c.theme, dark: { ...c.theme.dark, primary: "red; background: url(x)" } } })],
    ["cor com 3 dígitos", (c) => ({ ...c, theme: { ...c.theme, dark: { ...c.theme.dark, accent: "#FFF" } } })],
    ["dourado incompleto", (c) => ({ ...c, theme: { ...c.theme, dark: { ...c.theme.dark, gold: { hi: "#FFFFFF" } } } })],
    ["link javascript:", (c) => ({ ...c, content: { ...c.content, topBar: { text: "Oi", link: "javascript:alert(1)" } } })],
    ["imagem de outro site", (c) => ({ ...c, content: { ...c.content, hero: { ...c.content.hero, imageDesktop: { ...c.content.hero.imageDesktop, url: "https://evil.example/a.png" } } } })],
    ["hero sem título", (c) => ({ ...c, content: { ...c.content, hero: { ...c.content.hero, title: "" } } })],
    ["decoração fora do catálogo", (c) => ({ ...c, content: { ...c.content, decorations: ["FIREWORKS"] } })],
    ["slug com espaço", (c) => ({ ...c, collections: [{ ...c.collections[0], slug: "minha colecao" }] })],
    ["data sem fuso", (c) => ({ ...c, endsAt: "2026-12-01T03:00:00" })],
    ["largura negativa", (c) => ({ ...c, content: { ...c.content, promoImages: [{ image: { url: IMAGE, alt: "x", width: -1, height: null }, link: null }] } })],
  ]

  it.each(malformed)("devolve null quando: %s", (_, spoil) => {
    vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(() => parsePublicCampaign(spoil(validCampaign()))).not.toThrow()
    expect(parsePublicCampaign(spoil(validCampaign()))).toBeNull()
  })
})

describe("parseActiveCampaignResponse", () => {
  it("aceita resposta com campanha", () => {
    const response = parseActiveCampaignResponse({
      serverTime: "2026-11-27T14:00:00Z",
      nextChangeAt: "2026-12-01T03:00:00Z",
      campaign: validCampaign(),
    })

    expect(response?.campaign?.id).toBe("5e0c6b7a-1111-4222-8333-944455556666")
  })

  it("aceita resposta sem campanha ativa", () => {
    const response = parseActiveCampaignResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null })

    expect(response).toEqual({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null })
  })

  it("campanha malformada vira tema padrão, mas mantém os horários", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = parseActiveCampaignResponse({
      serverTime: "2026-11-27T14:00:00Z",
      nextChangeAt: "2026-12-01T03:00:00Z",
      campaign: { ...validCampaign(), type: 42 },
    })

    expect(response).toEqual({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: "2026-12-01T03:00:00Z", campaign: null })
  })

  it.each([
    ["texto em vez de objeto", "<html>acordando</html>"],
    ["sem serverTime", { campaign: null }],
    ["nextChangeAt inválido", { serverTime: "2026-11-27T14:00:00Z", nextChangeAt: "amanhã", campaign: null }],
  ])("devolve null quando o envelope é inválido: %s", (_, body) => {
    vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(parseActiveCampaignResponse(body)).toBeNull()
  })
})

describe("regras de segurança", () => {
  it.each(["#000000", "#C1121f"])("cor válida: %s", (value) => expect(isColor(value)).toBe(true))
  it.each(["#FFF", "#GGGGGG", "red", "#FFFFFF80", " #FFFFFF", 0])("cor inválida: %s", (value) =>
    expect(isColor(value)).toBe(false),
  )

  it.each(["/", "/?colecao=ofertas", "/#colecao", "https://instagram.com/fausto"])("link válido: %s", (value) =>
    expect(isSafeLink(value)).toBe(true),
  )
  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,oi",
    "http://site.com",
    "//site.com",
    "/\\site.com",
    "https://",
    "https://usuario@site.com",
    "/caminho com espaço",
    "/linha\nquebrada",
    "/invisível​",
    "/<script>",
    "ofertas",
    "/" + "a".repeat(300),
  ])("link inválido: %j", (value) => expect(isSafeLink(value)).toBe(false))

  it("imagem válida do Cloudinary", () => expect(isCloudinaryImageUrl(IMAGE)).toBe(true))
  it.each([
    "http://res.cloudinary.com/fausto/image/upload/a.png",
    "https://res.cloudinary.com.evil.example/fausto/image/upload/a.png",
    "https://res.cloudinary.com/fausto/image/fetch/https://evil.example/a.png",
    "https://res.cloudinary.com/fausto/image/upload/../../a.png",
    "https://res.cloudinary.com:8443/fausto/image/upload/a.png",
    "https://evil.example/fausto/image/upload/a.png",
  ])("imagem inválida: %s", (value) => expect(isCloudinaryImageUrl(value)).toBe(false))
})
