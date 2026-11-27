/**
 * Sistema central de temas (T18): o único lugar que transforma o `theme` de uma campanha em CSS Variables.
 *
 * Os componentes nunca perguntam "qual é a campanha?": eles usam os tokens de sempre (`bg-background`,
 * `text-primary`, `--gold-*`...) e este módulo troca o valor desses tokens. Trocar de campanha muda o visual
 * sem nenhum `if` nos componentes.
 *
 * O tema entra como uma tag `<style>` com uma regra para cada modo, presa a um atributo no `<html>`. Assim o
 * botão claro/escuro continua funcionando sozinho, e remover o tema é só tirar a tag e o atributo.
 */
import { ROUTES } from "@/routes"
import type { CampaignTheme, Color, ThemePalette } from "./types"

export const CAMPAIGN_THEME_STYLE_ID = "campaign-theme"
/** Presente no `<html>` enquanto um tema de campanha está aplicado. */
export const CAMPAIGN_THEME_ATTRIBUTE = "data-campaign-theme"

/** Correspondência do contrato (§4.1): cada campo da paleta → as variáveis de `src/index.css` que ele controla. */
const PALETTE_VARIABLES: Record<Exclude<keyof ThemePalette, "gold">, readonly string[]> = {
  background: ["--background"],
  foreground: ["--foreground", "--card-foreground", "--popover-foreground"],
  surface: ["--card", "--popover"],
  primary: ["--primary", "--ring"],
  primaryForeground: ["--primary-foreground"],
  accent: ["--accent", "--secondary", "--muted"],
  mutedForeground: ["--muted-foreground"],
  border: ["--border", "--input"],
  badge: ["--campaign-badge"],
  badgeForeground: ["--campaign-badge-foreground"],
}

const GOLD_VARIABLES = { hi: "--gold-hi", mid: "--gold-mid", lo: "--gold-lo", deep: "--gold-deep" } as const

/** Defesa extra: o `parse.ts` já garante o formato, mas nada além de `#RRGGBB` pode chegar ao CSS. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/**
 * As variáveis de uma paleta. Campo `null` fica de fora: vale o padrão da loja.
 * A ordem segue `PALETTE_VARIABLES`, para o CSS gerado ser sempre o mesmo.
 */
export function paletteToCssVariables(palette: ThemePalette): Record<string, Color> {
  const variables: Record<string, Color> = {}
  const set = (names: readonly string[], value: Color | null) => {
    if (value === null || !HEX_COLOR.test(value)) return
    for (const name of names) variables[name] = value
  }
  for (const [field, names] of Object.entries(PALETTE_VARIABLES)) {
    set(names, palette[field as keyof typeof PALETTE_VARIABLES])
  }
  if (palette.gold) {
    for (const [key, name] of Object.entries(GOLD_VARIABLES)) set([name], palette.gold[key as keyof typeof GOLD_VARIABLES])
  }
  return variables
}

function rule(selector: string, variables: Record<string, Color>): string {
  const body = Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")
  return `${selector} {\n${body}\n}`
}

/**
 * O CSS do tema. O seletor com o atributo pesa mais que o `:root` e o `.dark` de `index.css`, então vence sem
 * `!important`. Sem paleta clara, o modo claro fica com o tema padrão (decisão T02).
 */
export function campaignThemeCss(theme: CampaignTheme): string {
  const root = `:root[${CAMPAIGN_THEME_ATTRIBUTE}]`
  const rules = [rule(`${root}.dark`, paletteToCssVariables(theme.dark))]
  if (theme.light) rules.unshift(rule(`${root}:not(.dark)`, paletteToCssVariables(theme.light)))
  return rules.join("\n")
}

/** Aplica o tema (ou o remove, com `null`). Chamar de novo com o mesmo tema não mexe na página. */
export function applyCampaignTheme(theme: CampaignTheme | null, doc: Document = document): void {
  const html = doc.documentElement
  const existing = doc.getElementById(CAMPAIGN_THEME_STYLE_ID)
  if (!theme) {
    existing?.remove()
    html.removeAttribute(CAMPAIGN_THEME_ATTRIBUTE)
    return
  }
  const css = campaignThemeCss(theme)
  const style = existing ?? doc.head.appendChild(doc.createElement("style"))
  style.id = CAMPAIGN_THEME_STYLE_ID
  if (style.textContent !== css) style.textContent = css
  html.setAttribute(CAMPAIGN_THEME_ATTRIBUTE, "")
}

/**
 * Onde o tema vale (decisão T02): só nas páginas públicas. Painel, login e telas de erro ficam sempre no padrão,
 * para a equipe nunca trabalhar com as cores de uma campanha.
 */
const THEMED_PATHS: ReadonlySet<string> = new Set([ROUTES.home, ROUTES.terms, ROUTES.privacy, ROUTES.cookies])

export function isCampaignThemeRoute(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return THEMED_PATHS.has(normalized)
}
