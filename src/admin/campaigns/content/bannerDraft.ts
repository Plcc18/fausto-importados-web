/** O banner principal (`content.hero`, contrato §4.2) como o painel o edita. */
import { BUTTON_STYLES, type ButtonStyle } from "@/lib/campaign/types"
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

export const MAX_BUTTONS = 2

export interface ButtonDraft {
  /** Só da tela: identifica o item enquanto ele é editado. */
  key: string
  label: string
  link: string
  style: ButtonStyle
}

export interface BannerDraft {
  title: string
  subtitle: string
  desktop: ImageDraft | null
  /** `null` → o celular usa a de computador. */
  mobile: ImageDraft | null
  buttons: ButtonDraft[]
}

export const EMPTY_BANNER: BannerDraft = { title: "", subtitle: "", desktop: null, mobile: null, buttons: [] }

export const BUTTON_STYLE_LABELS: Record<ButtonStyle, string> = { PRIMARY: "Principal", SECONDARY: "Secundário" }

function buttonDraft(value: unknown, index: number): ButtonDraft {
  const button = asObject(value)
  const style = BUTTON_STYLES.find((s) => s === button?.style) ?? "PRIMARY"
  return { key: `b${index}`, label: asText(button?.label), link: asText(button?.link), style }
}

/** O `content` recebido da API → o banner que o editor mostra. */
export function bannerDraftFrom(content: unknown): BannerDraft | null {
  const hero = asObject(asObject(content)?.hero)
  if (!hero) return null
  return {
    title: asText(hero.title),
    subtitle: asText(hero.subtitle),
    desktop: imageDraft(hero.imageDesktop),
    mobile: imageDraft(hero.imageMobile),
    buttons: asList(hero.buttons).map(buttonDraft),
  }
}

/** O `hero` a enviar, mantendo do que veio qualquer campo que o editor não conheça. */
export function heroInput(current: unknown, banner: BannerDraft | null) {
  return (
    banner && {
      ...asObject(current),
      title: nullable(banner.title),
      subtitle: nullable(banner.subtitle),
      imageDesktop: imageInput(banner.desktop),
      imageMobile: imageInput(banner.mobile),
      buttons: banner.buttons.map(({ label, link, style }) => ({ label: nullable(label), link: nullable(link), style })),
    }
  )
}

/** O que a API exige mesmo num rascunho (§6): título, descrição em cada imagem e botões completos. */
export function checkBanner(banner: BannerDraft | null): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!banner) return errors
  if (!banner.title.trim()) errors["content.hero.title"] = "Informe o título do banner."
  for (const [field, image] of [["imageDesktop", banner.desktop], ["imageMobile", banner.mobile]] as const) {
    if (image && !image.alt.trim()) errors[`content.hero.${field}.alt`] = "Descreva a imagem."
  }
  banner.buttons.forEach((button, index) => {
    const path = `content.hero.buttons[${index}]`
    if (!button.label.trim()) errors[`${path}.label`] = "Escreva o texto do botão."
    const link = linkError(button.link, true)
    if (link) errors[`${path}.link`] = link
  })
  return errors
}
