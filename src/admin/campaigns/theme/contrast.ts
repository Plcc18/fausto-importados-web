/** Alerta de contraste (WCAG): quais textos ficariam difíceis de ler na loja com a paleta escolhida. */
import { previewVariables } from "@/admin/campaigns/theme/storePalette"
import type { PaletteDraft, ThemeMode } from "@/admin/campaigns/theme/themeDraft"

/** Luminância relativa de uma cor `#RRGGBB`. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** De 1 (iguais) a 21 (preto sobre branco). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** Texto comum (WCAG AA). */
const TEXT = 4.5
/** O destaque e o dourado aparecem em elementos grandes; o próprio dourado da loja fica em 2,4:1 no modo claro. */
const HIGHLIGHT = 2

/** `[onde, cor da frente, cor de trás, mínimo]`, pelas variáveis que a loja usa. */
const PAIRS: readonly [string, string, string, number][] = [
  ["Texto sobre o fundo", "--foreground", "--background", TEXT],
  ["Texto sobre os cartões", "--card-foreground", "--card", TEXT],
  ["Texto secundário sobre o fundo", "--muted-foreground", "--background", TEXT],
  ["Texto secundário sobre os cartões", "--muted-foreground", "--card", TEXT],
  ["Texto secundário sobre a cor secundária", "--muted-foreground", "--muted", TEXT],
  ["Texto dos botões de destaque", "--primary-foreground", "--primary", TEXT],
  ["Texto das etiquetas", "--campaign-badge-foreground", "--campaign-badge", TEXT],
  // a loja mantém estas cores de texto: o que dá para mudar é o fundo
  ["Texto dos botões secundários (ajuste a cor secundária)", "--secondary-foreground", "--secondary", TEXT],
  ["Texto dos menus (ajuste a cor secundária)", "--accent-foreground", "--accent", TEXT],
  ["Faixa padrão da loja (ajuste os cartões)", "--accent-foreground", "--card", TEXT],
  ["Destaque sobre o fundo", "--primary", "--background", HIGHLIGHT],
  ["Dourado sobre o fundo", "--gold-mid", "--background", HIGHLIGHT],
]

export interface ContrastWarning {
  where: string
  ratio: number
  minimum: number
}

export function contrastWarnings(mode: ThemeMode, palette: PaletteDraft | null): ContrastWarning[] {
  const variables = previewVariables(mode, palette)
  return PAIRS.flatMap(([where, front, back, minimum]) => {
    const ratio = contrastRatio(variables[front], variables[back])
    return ratio < minimum ? [{ where, ratio, minimum }] : []
  })
}

/** `2,1:1`. Arredonda para baixo, para um 4,49 não aparecer como 4,5. */
export const formatRatio = (ratio: number) => `${(Math.floor(ratio * 10) / 10).toLocaleString("pt-BR")}:1`
