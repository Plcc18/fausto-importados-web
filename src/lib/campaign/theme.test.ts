// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import {
  CAMPAIGN_THEME_ATTRIBUTE,
  CAMPAIGN_THEME_STYLE_ID,
  applyCampaignTheme,
  campaignThemeCss,
  isCampaignThemeRoute,
  paletteToCssVariables,
} from "./theme"
import type { CampaignTheme, ThemePalette } from "./types"

const dark: ThemePalette = {
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
}

const light: ThemePalette = { ...dark, background: "#FFF5F5", foreground: "#1A0A0A" }

afterEach(() => {
  applyCampaignTheme(null)
  document.documentElement.classList.remove("dark")
})

/** Lê o valor final de uma variável, como o navegador calcularia. */
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

describe("paletteToCssVariables", () => {
  it("segue a correspondência do contrato (§4.1)", () => {
    expect(paletteToCssVariables(dark)).toEqual({
      "--background": "#0B0B0F",
      "--foreground": "#F5F1E8",
      "--card-foreground": "#F5F1E8",
      "--popover-foreground": "#F5F1E8",
      "--primary": "#C1121F",
      "--ring": "#C1121F",
      "--primary-foreground": "#FFFFFF",
      "--accent": "#1F1F27",
      "--secondary": "#1F1F27",
      "--muted": "#1F1F27",
      "--campaign-badge": "#C1121F",
      "--campaign-badge-foreground": "#FFFFFF",
    })
  })

  it("campos null ficam de fora (vale o padrão da loja)", () => {
    const variables = paletteToCssVariables(dark)

    expect(variables).not.toHaveProperty("--card")
    expect(variables).not.toHaveProperty("--border")
    expect(variables).not.toHaveProperty("--gold-hi")
  })

  it("inclui os tokens dourados e as superfícies quando informados", () => {
    const variables = paletteToCssVariables({
      ...dark,
      surface: "#15151B",
      border: "#33333D",
      gold: { hi: "#FFE3E3", mid: "#E0A0A0", lo: "#C06060", deep: "#802020" },
    })

    expect(variables).toMatchObject({
      "--card": "#15151B",
      "--popover": "#15151B",
      "--border": "#33333D",
      "--input": "#33333D",
      "--gold-hi": "#FFE3E3",
      "--gold-deep": "#802020",
    })
  })

  it("nunca deixa passar algo que não seja #RRGGBB (defesa extra além do parse)", () => {
    const variables = paletteToCssVariables({ ...dark, primary: "red; } body { display: none" })

    expect(variables).not.toHaveProperty("--primary")
  })
})

describe("campaignThemeCss", () => {
  it("só paleta escura: o modo claro fica no padrão", () => {
    const css = campaignThemeCss({ dark, light: null })

    expect(css).toContain(`:root[${CAMPAIGN_THEME_ATTRIBUTE}].dark {`)
    expect(css).not.toContain(":not(.dark)")
  })

  it("com paleta clara: uma regra para cada modo", () => {
    const css = campaignThemeCss({ dark, light })

    expect(css).toContain(`:root[${CAMPAIGN_THEME_ATTRIBUTE}]:not(.dark) {\n  --background: #FFF5F5;`)
    expect(css).toContain(`:root[${CAMPAIGN_THEME_ATTRIBUTE}].dark {\n  --background: #0B0B0F;`)
  })
})

describe("applyCampaignTheme", () => {
  const theme: CampaignTheme = { dark, light }

  it("aplica o tema no modo escuro e no claro", () => {
    applyCampaignTheme(theme)

    expect(cssVar("--background")).toBe("#FFF5F5")
    document.documentElement.classList.add("dark")
    expect(cssVar("--background")).toBe("#0B0B0F")
  })

  it("remove o tema com null", () => {
    applyCampaignTheme(theme)
    applyCampaignTheme(null)

    expect(document.getElementById(CAMPAIGN_THEME_STYLE_ID)).toBeNull()
    expect(document.documentElement.hasAttribute(CAMPAIGN_THEME_ATTRIBUTE)).toBe(false)
  })

  it("trocar de campanha reaproveita a mesma tag", () => {
    applyCampaignTheme(theme)
    applyCampaignTheme({ dark: { ...dark, primary: "#0A7A3B" }, light: null })

    expect(document.querySelectorAll(`#${CAMPAIGN_THEME_STYLE_ID}`)).toHaveLength(1)
    expect(document.getElementById(CAMPAIGN_THEME_STYLE_ID)?.textContent).toContain("--primary: #0A7A3B;")
  })
})

describe("isCampaignThemeRoute", () => {
  it.each(["/", "/termos", "/privacidade", "/cookies", "/termos/"])("vale em %s", (path) =>
    expect(isCampaignThemeRoute(path)).toBe(true),
  )
  it.each(["/admin", "/admin/relatorio", "/entrar", "/erro/500", "/qualquer-coisa"])("não vale em %s", (path) =>
    expect(isCampaignThemeRoute(path)).toBe(false),
  )
})
