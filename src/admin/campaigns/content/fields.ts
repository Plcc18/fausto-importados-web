/** O que os editores de conteúdo têm em comum: leitura do que veio da API, imagens e links. */
import { isSafeLink } from "@/lib/campaign/parse"
import type { UploadedImage } from "@/admin/images/upload"

export const asObject = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
export const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
export const asText = (value: unknown) => (typeof value === "string" ? value : "")
const asSize = (value: unknown) => (typeof value === "number" ? value : null)

/** Texto da caixa → valor da API: sem espaços nas pontas, e vazio vira `null`. */
export const nullable = (value: string) => value.trim() || null

/** Imagem no formato do editor. Os campos são sempre montados nesta ordem (a comparação de mudanças depende disso). */
export interface ImageDraft {
  url: string
  alt: string
  width: number | null
  height: number | null
}

export function imageDraft(value: unknown): ImageDraft | null {
  const image = asObject(value)
  if (!image || !asText(image.url)) return null
  return { url: asText(image.url), alt: asText(image.alt), width: asSize(image.width), height: asSize(image.height) }
}

/** A imagem recém-enviada, com a descrição que já estava no campo (a pessoa revisa se precisar). */
export const uploadedDraft = ({ url, width, height }: UploadedImage, alt: string): ImageDraft => ({ url, alt, width, height })

export const imageInput = (image: ImageDraft | null) => image && { ...image, alt: nullable(image.alt) }

export const LINK_RULE = "Use um caminho da loja (começando com /) ou um endereço https://."

/**
 * O problema de um link, ou `null`. Vale a mesma regra com que a loja confere o que recebe: um link que a loja
 * recusa derrubaria a campanha inteira (C14).
 */
export function linkError(value: string, required: boolean): string | null {
  const link = value.trim()
  if (!link) return required ? "Informe o link." : null
  return isSafeLink(link) ? null : LINK_RULE
}

/** Formato do identificador de uma coleção (contrato §4.3). */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Um destino que o editor sugere nas caixas de link. */
export interface LinkSuggestion {
  value: string
  label: string
}

/** A vitrine e as coleções desta campanha, inclusive as que ainda estão sendo editadas. */
export function linkSuggestions(collections: unknown): LinkSuggestion[] {
  // um endereço por sugestão: durante a edição duas coleções podem repetir o identificador (vale a primeira)
  const labels = new Map([["/#colecao", "Vitrine da loja"]])
  for (const item of asList(collections)) {
    const collection = asObject(item)
    const slug = asText(collection?.slug)
    const value = `/?colecao=${slug}`
    // um identificador pela metade não vira sugestão de link
    if (SLUG.test(slug) && !labels.has(value)) labels.set(value, `Coleção: ${asText(collection?.title) || slug}`)
  }
  return [...labels].map(([value, label]) => ({ value, label }))
}
