/**
 * O banner principal (`content.hero`, contrato §4.2) como o painel o edita: título e imagens. Subtítulo, botões e o
 * restante do conteúdo ganham editor na T31; até lá voltam como vieram.
 */
export interface ImageDraft {
  url: string
  alt: string
  width: number | null
  height: number | null
}

export interface BannerDraft {
  title: string
  desktop: ImageDraft | null
  /** `null` → o celular usa a de computador. */
  mobile: ImageDraft | null
}

export const EMPTY_BANNER: BannerDraft = { title: "", desktop: null, mobile: null }

/** Nome de cada campo, pelo caminho que a API usa nos erros. */
export const BANNER_FIELD_LABELS: Record<string, string> = {
  "content.hero": "Banner",
  "content.hero.title": "Título do banner",
  "content.hero.imageDesktop": "Imagem do banner",
  "content.hero.imageDesktop.url": "Imagem do banner",
  "content.hero.imageDesktop.alt": "Texto alternativo (computador)",
  "content.hero.imageMobile": "Imagem do banner no celular",
  "content.hero.imageMobile.url": "Imagem do banner no celular",
  "content.hero.imageMobile.alt": "Texto alternativo (celular)",
}

const asObject = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
const asText = (value: unknown) => (typeof value === "string" ? value : "")
const asSize = (value: unknown) => (typeof value === "number" ? value : null)

function imageDraft(value: unknown): ImageDraft | null {
  const image = asObject(value)
  if (!image || !asText(image.url)) return null
  return { url: asText(image.url), alt: asText(image.alt), width: asSize(image.width), height: asSize(image.height) }
}

/** O `content` recebido da API → o banner que o editor mostra. */
export function bannerDraftFrom(content: unknown): BannerDraft | null {
  const hero = asObject(asObject(content)?.hero)
  if (!hero) return null
  return { title: asText(hero.title), desktop: imageDraft(hero.imageDesktop), mobile: imageDraft(hero.imageMobile) }
}

const imageInput = (image: ImageDraft | null) => image && { ...image, alt: image.alt.trim() || null }

/** O `content` a enviar: o que veio, com o banner trocado pelo do editor. */
export function contentWithBanner(content: unknown, banner: BannerDraft | null): unknown {
  const current = asObject(content)
  const base = current ?? { topBar: null, hero: null, promoImages: [], decorations: [] }
  if (!banner) return current ? { ...base, hero: null } : null
  const hero = asObject(base.hero) ?? { subtitle: null, buttons: [] }
  return {
    ...base,
    hero: {
      ...hero,
      title: banner.title.trim() || null,
      imageDesktop: imageInput(banner.desktop),
      imageMobile: imageInput(banner.mobile),
    },
  }
}

/** O que a API exige mesmo num rascunho (§6): título no banner e descrição em cada imagem. */
export function checkBanner(banner: BannerDraft | null): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!banner) return errors
  if (!banner.title.trim()) errors["content.hero.title"] = "Informe o título do banner."
  for (const [field, image] of [["imageDesktop", banner.desktop], ["imageMobile", banner.mobile]] as const) {
    if (image && !image.alt.trim()) errors[`content.hero.${field}.alt`] = "Descreva a imagem."
  }
  return errors
}
