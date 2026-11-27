/**
 * Imagens das campanhas, servidas pelo Cloudinary (o `parse.ts` só aceita `https://res.cloudinary.com/<cloud>/
 * image/upload/...`). O próprio Cloudinary otimiza pela URL: um segmento de transformação logo depois de
 * `/image/upload/` pede o formato mais leve que o navegador aceita (`f_auto`: AVIF/WebP), a qualidade automática
 * (`q_auto`) e uma largura máxima (`w_`), sem nunca aumentar a imagem original (`c_limit`).
 */
import type { CampaignImage } from "./types"

const UPLOAD_SEGMENT = "/image/upload/"

/** Larguras oferecidas ao navegador, que escolhe a menor que serve para a tela (`srcset` + `sizes`). */
export const DESKTOP_WIDTHS = [960, 1440, 1920, 2560] as const
export const MOBILE_WIDTHS = [480, 768, 1080] as const

/** Proporções usadas enquanto a API não souber o tamanho real da imagem. */
export const DEFAULT_DESKTOP_RATIO = "3 / 1"
export const DEFAULT_MOBILE_RATIO = "4 / 5"

/**
 * Parâmetros de transformação do Cloudinary (`c_fill`, `w_800`, `e_sharpen`...). Um segmento só é tratado como
 * transformação se todas as partes começarem por um deles: uma pasta como `bf_2026/` não é confundida.
 */
const TRANSFORMATION_PARAMS = new Set([
  "a", "ac", "af", "ar", "b", "bo", "br", "c", "co", "cs", "d", "dl", "dn", "dpr", "du", "e", "eo", "f", "fl",
  "fn", "fps", "g", "h", "if", "ki", "l", "o", "p", "pg", "q", "r", "so", "sp", "t", "u", "vc", "vs", "w", "x",
  "y", "z",
])

function isTransformation(segment: string): boolean {
  return segment.split(",").every((part) => {
    const separator = part.indexOf("_")
    return separator > 0 && separator < part.length - 1 && TRANSFORMATION_PARAMS.has(part.slice(0, separator))
  })
}

/**
 * URL otimizada. O Cloudinary aplica as transformações da esquerda para a direita, então a nossa entra **depois**
 * das que a URL já tiver (um recorte `c_fill,w_1920` depois do limite aumentaria a imagem de novo).
 */
export function cloudinaryUrl(url: string, width: number): string {
  const at = url.indexOf(UPLOAD_SEGMENT)
  if (at < 0) return url
  const start = at + UPLOAD_SEGMENT.length
  const segments = url.slice(start).split("/")
  let existing = 0
  while (existing < segments.length - 1 && isTransformation(segments[existing])) existing++
  segments.splice(existing, 0, `f_auto,q_auto,c_limit,w_${width}`)
  return url.slice(0, start) + segments.join("/")
}

/**
 * `srcset` com as larguras pedidas. Se a largura real for conhecida, nada maior que ela é oferecido (seriam
 * URLs diferentes para o mesmo arquivo), e a própria largura real entra como última opção.
 */
export function cloudinarySrcSet(image: CampaignImage, widths: readonly number[]): string {
  const limit = image.width ?? Number.POSITIVE_INFINITY
  const chosen = widths.filter((width) => width < limit)
  if (Number.isFinite(limit)) chosen.push(limit)
  if (chosen.length === 0) chosen.push(widths[0])
  return chosen.map((width) => `${cloudinaryUrl(image.url, width)} ${width}w`).join(", ")
}

/**
 * Proporção para reservar o espaço antes de a imagem chegar (sem "pulo" no layout).
 *
 * `width` e `height` precisam descrever o arquivo que a URL entrega. É o caso dos uploads da loja (T15), que vêm
 * sem transformação; uma URL com recorte (`c_fill,w_800,h_800`) precisaria das dimensões do recorte.
 */
export function aspectRatio(image: CampaignImage, fallback: string): string {
  return image.width && image.height ? `${image.width} / ${image.height}` : fallback
}
