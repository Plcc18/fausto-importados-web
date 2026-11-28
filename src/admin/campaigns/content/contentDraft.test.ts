import { describe, expect, it } from "vitest"
import { describeField } from "@/admin/campaigns/actions"
import { checkContent, contentFieldLabel, contentInput, contentValuesFrom, type ContentValues } from "./contentDraft"
import { LINK_RULE, linkError, linkSuggestions } from "./fields"

const image = (name: string) => ({
  url: `https://res.cloudinary.com/fausto/image/upload/v1/campaigns/${name}.webp`, alt: name, width: 1080, height: 1080,
})

const full = {
  topBar: { text: "Black Friday", link: "/?colecao=ofertas" },
  hero: {
    title: "Fausto", subtitle: null, imageDesktop: image("larga"), imageMobile: null,
    buttons: [{ label: "Ver", link: "/#colecao", style: "SECONDARY" }],
  },
  promoImages: [{ image: image("a"), link: null }, { image: image("b"), link: "https://exemplo.com" }],
  decorations: ["SNOW", "STARS"],
}

const empty: ContentValues = { topBar: null, banner: null, promoImages: [], decorations: [] }
const edit = (content: unknown, change: Partial<ContentValues>) =>
  contentInput(content, { ...contentValuesFrom(content), ...change })

describe("ida e volta do conteúdo", () => {
  it("sem mexer, volta exatamente como veio", () => {
    for (const original of [full, null, { decorations: ["SNOW"], extra: 1 }]) {
      expect(contentInput(original, contentValuesFrom(original))).toBe(original)
    }
    expect(contentInput(undefined, empty)).toBeNull()
    expect(contentValuesFrom(null)).toEqual(empty)
  })

  it("muda só a parte mexida; as outras voltam como vieram", () => {
    const sent = edit(full, { topBar: { text: "  Novo texto  ", link: "" } }) as typeof full

    expect(sent.topBar).toEqual({ text: "Novo texto", link: null })
    expect(sent.hero).toBe(full.hero)
    expect(sent.promoImages).toBe(full.promoImages)
    expect(sent.decorations).toBe(full.decorations)
  })

  it("um conteúdo novo sai completo", () => {
    expect(contentInput(undefined, { ...empty, decorations: ["HEARTS"] })).toEqual({
      topBar: null, hero: null, promoImages: [], decorations: ["HEARTS"],
    })
  })

  it("lê e devolve botões e imagens de divulgação sem os identificadores da tela", () => {
    const values = contentValuesFrom(full)
    const [first, second] = values.promoImages

    const sent = contentInput(full, {
      ...values,
      promoImages: [second, first],
      banner: { ...values.banner!, subtitle: "Até domingo" },
    }) as typeof full

    expect(sent.promoImages).toEqual([full.promoImages[1], full.promoImages[0]])
    expect(sent.hero).toEqual({ ...full.hero, subtitle: "Até domingo" })
  })

  it("remover partes envia vazio", () => {
    expect(edit(full, empty)).toEqual({ topBar: null, hero: null, promoImages: [], decorations: [] })
  })

  it("preserva o que o editor não conhece", () => {
    const original = { ...full, futuro: true, hero: { ...full.hero, outro: "x" } }
    const values = contentValuesFrom(original)

    const sent = contentInput(original, { ...values, banner: { ...values.banner!, title: "Outro" } })

    expect(sent).toMatchObject({ futuro: true, hero: { outro: "x", title: "Outro" } })
  })

  it("ignora enfeites desconhecidos na leitura, sem apagá-los se nada mudar neles", () => {
    const original = { decorations: ["SNOW", "FOGOS"] }
    expect(contentValuesFrom(original).decorations).toEqual(["SNOW"])
    expect(contentInput(original, contentValuesFrom(original))).toBe(original)
  })
})

describe("conferência antes de enviar", () => {
  it("um conteúdo completo não tem erros", () => {
    expect(checkContent(contentValuesFrom(full))).toEqual({})
  })

  it("aponta o que a API exige, mesmo num rascunho", () => {
    const errors = checkContent({
      topBar: { text: "  ", link: "http://inseguro.com" },
      banner: {
        title: "T", subtitle: "", desktop: null, mobile: null,
        buttons: [{ key: "b0", label: "", link: "", style: "PRIMARY" }],
      },
      promoImages: [
        { key: "p0", image: null, link: "" },
        { key: "p1", image: { ...image("b"), alt: " " }, link: "//outro.com" },
      ],
      decorations: [],
    })

    expect(errors).toEqual({
      "content.topBar.text": "Escreva o texto da faixa.",
      "content.topBar.link": LINK_RULE,
      "content.hero.buttons[0].label": "Escreva o texto do botão.",
      "content.hero.buttons[0].link": "Informe o link.",
      "content.promoImages[0].image": "Envie a imagem.",
      "content.promoImages[1].image.alt": "Descreva a imagem.",
      "content.promoImages[1].link": LINK_RULE,
    })
  })

  // o link que a loja recusa derrubaria a campanha inteira (C14)
  it.each(["/", "/?colecao=ofertas", "/termos", "https://exemplo.com/a?b=1"])("aceita o link %s", (link) => {
    expect(linkError(link, true)).toBeNull()
  })

  it.each([
    "exemplo.com", "//exemplo.com", "http://exemplo.com", "javascript:alert(1)", "/com espaço",
    "https://loja.com:abc/x", "https://loja.com:99999", "https://usuario@loja.com",
  ])("recusa o link %s", (link) => {
    expect(linkError(link, false)).toBe(LINK_RULE)
  })

  it("link vazio só é erro quando obrigatório", () => {
    expect(linkError("  ", false)).toBeNull()
    expect(linkError("", true)).toBe("Informe o link.")
  })
})

describe("nomes e sugestões", () => {
  it.each([
    ["content.topBar.text", "Texto da faixa"],
    ["content.hero.subtitle", "Subtítulo do banner"],
    ["content.hero.buttons[1].link", "Botão 2 · Link"],
    ["content.promoImages[0].image.alt", "Imagem de divulgação 1 · Texto alternativo"],
    ["content.promoImages[2]", "Imagem de divulgação 3"],
    ["content.decorations[0]", "Enfeite 1"],
  ])("dá nome ao campo %s", (path, label) => {
    expect(contentFieldLabel(path)).toBe(label)
    expect(describeField({ field: path, message: "Erro." })).toBe(`${label}: Erro.`)
  })

  it("campo desconhecido fica só com a mensagem", () => {
    expect(contentFieldLabel("content.outro")).toBeUndefined()
    expect(describeField({ field: "outro", message: "Erro." })).toBe("Erro.")
  })

  it("sugere a vitrine e as coleções da campanha", () => {
    expect(linkSuggestions([{ title: "Ofertas", slug: "ofertas" }, { title: "Sem identificador" }, "lixo"])).toEqual([
      { value: "/#colecao", label: "Vitrine da loja" },
      { value: "/?colecao=ofertas", label: "Coleção: Ofertas" },
    ])
    expect(linkSuggestions(undefined)).toHaveLength(1)
  })
})
