/**
 * O tema como o editor o manipula (contrato §3 e §4.1): cada cor é o texto da caixa, e vazio significa "sem valor",
 * que na API é `null` (a loja usa o padrão). Um rascunho pode estar incompleto.
 */
import type { GoldPalette, ThemePalette } from "@/lib/campaign/types"

export type ColorKey = Exclude<keyof ThemePalette, "gold">
export type GoldKey = keyof GoldPalette
export type ThemeMode = "dark" | "light"

export type GoldDraft = Record<GoldKey, string>
export type PaletteDraft = Record<ColorKey, string> & { gold: GoldDraft | null }
export interface ThemeDraft {
  dark: PaletteDraft | null
  light: PaletteDraft | null
}

export const MODE_LABELS: Record<ThemeMode, string> = { dark: "Modo escuro", light: "Modo claro" }

/** Na ordem em que o editor mostra. Os obrigatórios são os do contrato. */
export const COLOR_FIELDS: readonly { key: ColorKey; label: string; hint: string; required: boolean }[] = [
  { key: "background", label: "Fundo", hint: "Fundo das páginas.", required: true },
  { key: "foreground", label: "Texto", hint: "Texto principal.", required: true },
  { key: "primary", label: "Destaque", hint: "Botões principais, links e a faixa da campanha.", required: true },
  { key: "primaryForeground", label: "Texto sobre o destaque", hint: "Texto dentro dos botões principais.", required: true },
  { key: "accent", label: "Cor secundária", hint: "Botões secundários, filtros e áreas suaves.", required: true },
  { key: "surface", label: "Cartões", hint: "Fundo dos cartões e janelas.", required: false },
  { key: "mutedForeground", label: "Texto secundário", hint: "Marcas, legendas e textos de apoio.", required: false },
  { key: "border", label: "Bordas", hint: "Linhas de separação e contorno dos campos.", required: false },
  { key: "badge", label: "Etiquetas", hint: "\"Oferta\" e o selo da campanha. Sem valor, usa o destaque.", required: false },
  { key: "badgeForeground", label: "Texto das etiquetas", hint: "Sem valor, usa o texto sobre o destaque.", required: false },
]

export const GOLD_FIELDS: readonly { key: GoldKey; label: string }[] = [
  { key: "hi", label: "Dourado: luz" },
  { key: "mid", label: "Dourado: tom principal" },
  { key: "lo", label: "Dourado: sombra" },
  { key: "deep", label: "Dourado: fundo da sombra" },
]

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/** Nome de cada campo, pelo caminho que a API usa nos erros. */
export const THEME_FIELD_LABELS: Record<string, string> = {
  "theme.dark": "Tema escuro",
  "theme.light": "Tema claro",
  ...Object.fromEntries(
    (["dark", "light"] as const).flatMap((mode) => [
      ...COLOR_FIELDS.map(({ key, label }) => [`theme.${mode}.${key}`, `${MODE_LABELS[mode]} · ${label}`]),
      ...GOLD_FIELDS.map(({ key, label }) => [`theme.${mode}.gold.${key}`, `${MODE_LABELS[mode]} · ${label}`]),
    ]),
  ),
}

const asObject = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
const asText = (value: unknown) => (typeof value === "string" ? value : "")

/** Uma paleta completa a partir do que houver; sempre com os campos na mesma ordem (a comparação depende disso). */
export function paletteDraft(source: object = {}): PaletteDraft {
  const raw = source as Record<string, unknown>
  const gold = asObject(raw.gold)
  return {
    ...(Object.fromEntries(COLOR_FIELDS.map(({ key }) => [key, asText(raw[key])])) as Record<ColorKey, string>),
    gold: gold && (Object.fromEntries(GOLD_FIELDS.map(({ key }) => [key, asText(gold[key])])) as GoldDraft),
  }
}

/** O `theme` recebido da API → o que o editor mostra. */
export function themeDraftFrom(theme: unknown): ThemeDraft | null {
  const raw = asObject(theme)
  if (!raw) return null
  const read = (value: unknown) => {
    const palette = asObject(value)
    return palette && paletteDraft(palette)
  }
  return { dark: read(raw.dark), light: read(raw.light) }
}

const nullable = (value: string) => value.trim() || null

/** O que o editor mostra → o `theme` enviado à API. Sem nenhuma paleta, não há tema. */
export function themeInput(theme: ThemeDraft | null) {
  if (!theme || (!theme.dark && !theme.light)) return null
  const palette = (draft: PaletteDraft | null) =>
    draft && {
      ...(Object.fromEntries(COLOR_FIELDS.map(({ key }) => [key, nullable(draft[key])])) as Record<ColorKey, string | null>),
      gold: draft.gold && Object.fromEntries(GOLD_FIELDS.map(({ key }) => [key, nullable(draft.gold![key])])),
    }
  return { dark: palette(theme.dark), light: palette(theme.light) }
}

/** O que impede enviar: cor fora do formato, ou faltando onde a API exige mesmo num rascunho (§6). */
export function checkTheme(theme: ThemeDraft | null): Record<string, string> {
  const errors: Record<string, string> = {}
  const check = (path: string, value: string, required: boolean) => {
    if (value.trim() && !HEX_COLOR.test(value.trim())) errors[path] = "Use uma cor no formato #RRGGBB."
    else if (required && !value.trim()) errors[path] = "Preencha esta cor."
  }
  for (const mode of ["dark", "light"] as const) {
    const palette = theme?.[mode]
    if (!palette) continue
    // a paleta clara, se existir, precisa estar completa; a escura só é cobrada ao publicar
    for (const { key, required } of COLOR_FIELDS) check(`theme.${mode}.${key}`, palette[key], mode === "light" && required)
    if (palette.gold) for (const { key } of GOLD_FIELDS) check(`theme.${mode}.gold.${key}`, palette.gold[key], true)
  }
  return errors
}

/** O valor num caminho como `theme.dark.gold.hi`, para saber qual erro o campo alterado deixa para trás. */
export function themeValueAt(theme: ThemeDraft | null, path: string): unknown {
  return path
    .split(".")
    .slice(1)
    .reduce<unknown>((value, key) => asObject(value)?.[key], theme)
}
