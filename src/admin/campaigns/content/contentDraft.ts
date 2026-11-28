/**
 * Todo o `content` da campanha (contrato §4.2) como o painel o edita: faixa superior, banner, imagens de divulgação e
 * enfeites. As coleções, que ficam fora do `content`, ganham editor na T32.
 */
import { DECORATION_TYPES, type DecorationType } from "@/lib/campaign/types"
import { bannerDraftFrom, checkBanner, heroInput, type BannerDraft } from "@/admin/campaigns/content/bannerDraft"
import {
  asList,
  asObject,
  asText,
  imageDraft,
  imageInput,
  linkError,
  nullable,
  type ImageDraft,
} from "@/admin/campaigns/content/fields"

/** No celular a loja mostra no máximo 2 linhas na faixa (T22). */
export const TOP_BAR_COMFORT = 90
export const TOP_BAR_MAX = 120
export const MAX_PROMO_IMAGES = 6
export const MAX_DECORATIONS = 3

export interface TopBarDraft {
  text: string
  link: string
}

export interface PromoDraft {
  /** Só da tela: identifica o item mesmo depois de mudar de ordem ou durante um envio. */
  key: string
  image: ImageDraft | null
  link: string
}

export interface ContentValues {
  topBar: TopBarDraft | null
  banner: BannerDraft | null
  promoImages: PromoDraft[]
  decorations: DecorationType[]
}

export const DECORATION_LABELS: Record<DecorationType, string> = {
  SNOW: "Neve",
  SPARKLES: "Brilhos",
  HEARTS: "Corações",
  RIBBONS: "Fitas",
  CONFETTI: "Confete",
  STARS: "Estrelas",
}

let sequence = 0
/** Chave para um item criado na tela (os que vêm da API usam a posição). */
export const newKey = () => `novo-${++sequence}`

/** O `content` recebido da API → o que os editores mostram. */
export function contentValuesFrom(content: unknown): ContentValues {
  const raw = asObject(content)
  const topBar = asObject(raw?.topBar)
  return {
    topBar: topBar && { text: asText(topBar.text), link: asText(topBar.link) },
    banner: bannerDraftFrom(content),
    promoImages: asList(raw?.promoImages).map((item, index) => {
      const promo = asObject(item)
      return { key: `p${index}`, image: imageDraft(promo?.image), link: asText(promo?.link) }
    }),
    decorations: asList(raw?.decorations).filter((value): value is DecorationType =>
      DECORATION_TYPES.includes(value as DecorationType),
    ),
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * O `content` a enviar. Cada parte que a pessoa não mexeu volta exatamente como veio; sem mudança nenhuma, o conteúdo
 * inteiro volta como veio (inclusive `null`).
 */
export function contentInput(original: unknown, values: ContentValues): unknown {
  const before = contentValuesFrom(original)
  const changed = (part: keyof ContentValues) => !same(values[part], before[part])
  if (!(["topBar", "banner", "promoImages", "decorations"] as const).some(changed)) return original ?? null

  const base = asObject(original) ?? { topBar: null, hero: null, promoImages: [], decorations: [] }
  return {
    ...base,
    ...(changed("topBar") && {
      topBar: values.topBar && { ...asObject(base.topBar), text: nullable(values.topBar.text), link: nullable(values.topBar.link) },
    }),
    ...(changed("banner") && { hero: heroInput(base.hero, values.banner) }),
    ...(changed("promoImages") && {
      promoImages: values.promoImages.map(({ image, link }) => ({ image: imageInput(image), link: nullable(link) })),
    }),
    ...(changed("decorations") && { decorations: values.decorations }),
  }
}

/** O que impede enviar, pelo caminho que a API usa nos erros. */
export function checkContent({ topBar, banner, promoImages }: ContentValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (topBar) {
    if (!topBar.text.trim()) errors["content.topBar.text"] = "Escreva o texto da faixa."
    const link = linkError(topBar.link, false)
    if (link) errors["content.topBar.link"] = link
  }
  Object.assign(errors, checkBanner(banner))
  promoImages.forEach((promo, index) => {
    const path = `content.promoImages[${index}]`
    if (!promo.image) errors[`${path}.image`] = "Envie a imagem."
    else if (!promo.image.alt.trim()) errors[`${path}.image.alt`] = "Descreva a imagem."
    const link = linkError(promo.link, false)
    if (link) errors[`${path}.link`] = link
  })
  return errors
}

const FIXED_LABELS: Record<string, string> = {
  content: "Conteúdo",
  "content.topBar": "Faixa superior",
  "content.topBar.text": "Texto da faixa",
  "content.topBar.link": "Link da faixa",
  "content.hero": "Banner",
  "content.hero.title": "Título do banner",
  "content.hero.subtitle": "Subtítulo do banner",
  "content.hero.imageDesktop": "Imagem do banner",
  "content.hero.imageDesktop.url": "Imagem do banner",
  "content.hero.imageDesktop.alt": "Texto alternativo (computador)",
  "content.hero.imageMobile": "Imagem do banner no celular",
  "content.hero.imageMobile.url": "Imagem do banner no celular",
  "content.hero.imageMobile.alt": "Texto alternativo (celular)",
  "content.hero.buttons": "Botões do banner",
  "content.promoImages": "Imagens de divulgação",
  "content.decorations": "Enfeites",
}

const ITEM_FIELDS: Record<string, string> = {
  label: "Texto", link: "Link", style: "Estilo", image: "Imagem", "image.url": "Imagem", "image.alt": "Texto alternativo",
}

/** O nome de um campo do conteúdo, inclusive de itens de lista (`content.hero.buttons[1].link`). */
export function contentFieldLabel(path: string): string | undefined {
  if (FIXED_LABELS[path]) return FIXED_LABELS[path]
  const item = /^content\.(hero\.buttons|promoImages|decorations)\[(\d+)\](?:\.(.+))?$/.exec(path)
  if (!item) return undefined
  const [, list, index, field] = item
  const name = { "hero.buttons": "Botão", promoImages: "Imagem de divulgação", decorations: "Enfeite" }[list as "decorations"]
  const which = `${name} ${Number(index) + 1}`
  return field && ITEM_FIELDS[field] ? `${which} · ${ITEM_FIELDS[field]}` : which
}
