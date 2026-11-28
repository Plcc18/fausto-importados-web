import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseActiveCampaignResponse } from "@/lib/campaign/parse"
import { campaignThemeCss } from "@/lib/campaign/theme"
import { CAMPAIGN_TYPES, type CampaignTheme } from "@/lib/campaign/types"
import { contrastRatio, contrastWarnings, formatRatio } from "./contrast"
import { STORE_VARIABLES, effectiveColor, previewVariables, storePaletteDraft } from "./storePalette"
import { TEMPLATE_LABELS, templateTheme } from "./templates"
import {
  COLOR_FIELDS,
  HEX_COLOR,
  checkTheme,
  paletteDraft,
  themeDraftFrom,
  themeInput,
  themeValueAt,
} from "./themeDraft"

const required = {
  background: "#101010", foreground: "#F0F0F0", primary: "#C1121F", primaryForeground: "#FFFFFF", accent: "#222222",
}

/** As variáveis declaradas num bloco de `index.css` (`:root` ou `.dark`). */
function cssBlock(selector: string): Record<string, string> {
  const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf-8")
  const escaped = selector.replace(".", "\\.")
  const body = new RegExp(`^${escaped} \\{([^}]*)\\}`, "m").exec(css)![1]
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

describe("cores da loja usadas pelo editor", () => {
  it.each([["light", ":root"], ["dark", ".dark"]] as const)("o modo %s é igual ao de index.css", (mode, selector) => {
    const css = cssBlock(selector)

    for (const [name, value] of Object.entries(STORE_VARIABLES[mode])) expect([name, css[name]]).toEqual([name, value])
  })

  it("cobre toda variável que uma campanha pode trocar", () => {
    const everything: CampaignTheme = {
      dark: {
        ...required, surface: "#111111", mutedForeground: "#999999", border: "#333333", badge: "#C1121F",
        badgeForeground: "#FFFFFF", gold: { hi: "#FFFFFF", mid: "#EEEEEE", lo: "#DDDDDD", deep: "#CCCCCC" },
      },
      light: null,
    }
    const changed = [...campaignThemeCss(everything).matchAll(/(--[\w-]+):/g)].map((m) => m[1])
    const known = Object.keys(previewVariables("dark", null))

    expect(known).toEqual(expect.arrayContaining(changed))
  })

  it("sem cor própria, as etiquetas seguem o destaque da paleta", () => {
    const palette = paletteDraft(required)

    expect(effectiveColor("dark", palette, "badge")).toBe("#C1121F")
    expect(effectiveColor("dark", palette, "badgeForeground")).toBe("#FFFFFF")
    expect(effectiveColor("dark", paletteDraft({ ...required, badge: "#00FF00" }), "badge")).toBe("#00FF00")
  })

  it("ignora uma cor pela metade, como a loja faria", () => {
    expect(previewVariables("dark", paletteDraft({ ...required, background: "#10" }))["--background"]).toBe("#09090a")
  })
})

describe("ida e volta do tema", () => {
  it("o que a API manda volta com a mesma estrutura, com null no que está vazio", () => {
    const theme = { dark: { ...required, surface: null, gold: null }, light: null }

    expect(themeInput(themeDraftFrom(theme))).toEqual({
      dark: { ...required, surface: null, mutedForeground: null, border: null, badge: null, badgeForeground: null, gold: null },
      light: null,
    })
  })

  it("sem nenhuma paleta, não há tema", () => {
    expect(themeDraftFrom(null)).toBeNull()
    expect(themeDraftFrom("lixo")).toBeNull()
    expect(themeInput(null)).toBeNull()
    expect(themeInput({ dark: null, light: null })).toBeNull()
  })

  it("acha o valor pelo caminho que a API usa nos erros", () => {
    const draft = themeDraftFrom({ dark: { ...required, gold: { hi: "#111111", mid: "", lo: "", deep: "" } } })

    expect(themeValueAt(draft, "theme.dark.primary")).toBe("#C1121F")
    expect(themeValueAt(draft, "theme.dark.gold.hi")).toBe("#111111")
    expect(themeValueAt(draft, "theme.light.primary")).toBeUndefined()
  })

  it("um rascunho escuro pode estar incompleto; o claro e o dourado, se existirem, não", () => {
    expect(checkTheme(themeDraftFrom({ dark: { primary: "#C1121F" }, light: null }))).toEqual({})
    expect(checkTheme(themeDraftFrom({ dark: { primary: "vermelho" } }))).toEqual({
      "theme.dark.primary": "Use uma cor no formato #RRGGBB.",
    })
    const errors = checkTheme(themeDraftFrom({ light: { ...required, accent: "" }, dark: { gold: { hi: "#FFFFFF" } } }))
    expect(Object.keys(errors).sort()).toEqual([
      "theme.dark.gold.deep", "theme.dark.gold.lo", "theme.dark.gold.mid", "theme.light.accent",
    ])
  })
})

describe("alerta de contraste", () => {
  it("mede de 1 a 21, em qualquer ordem", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21)
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21)
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1)
    expect(formatRatio(4.49)).toBe("4,4:1")
  })

  it.each(["dark", "light"] as const)("as cores da própria loja não geram alerta no modo %s", (mode) => {
    expect(contrastWarnings(mode, null)).toEqual([])
    expect(contrastWarnings(mode, storePaletteDraft(mode))).toEqual([])
  })

  it("avisa onde o texto fica ilegível", () => {
    const warnings = contrastWarnings("dark", paletteDraft({ ...required, foreground: "#222222" }))

    expect(warnings.map((w) => w.where)).toContain("Texto sobre o fundo")
    expect(warnings.find((w) => w.where === "Texto sobre o fundo")!.ratio).toBeLessThan(4.5)
  })

  // o caso do C06: a loja mantém a cor do texto sobre a secundária
  it("avisa quando a cor secundária apaga os textos que a campanha não troca", () => {
    const places = contrastWarnings("dark", paletteDraft({ ...required, accent: "#F7D6E0" })).map((w) => w.where)

    expect(places).toContain("Texto dos botões secundários (ajuste a cor secundária)")
    expect(places).toContain("Texto dos menus (ajuste a cor secundária)")
  })

  it("confere as cores da loja que sobram quando um campo fica vazio", () => {
    // fundo claro no modo escuro, mas cartões e texto secundário continuam os da loja
    const places = contrastWarnings("dark", paletteDraft({ ...required, background: "#FFFFFF", foreground: "#000000" }))
      .map((w) => w.where)

    expect(places).toContain("Texto secundário sobre o fundo")
    expect(places).toContain("Texto sobre os cartões")
  })
})

describe("modelos", () => {
  it("há um para cada tipo de campanha", () => {
    expect(Object.keys(TEMPLATE_LABELS).sort()).toEqual([...CAMPAIGN_TYPES].sort())
  })

  it.each(CAMPAIGN_TYPES)("%s está completo, no formato certo e sem alerta de contraste", (type) => {
    const theme = templateTheme(type)

    expect(checkTheme(theme)).toEqual({})
    for (const mode of ["dark", "light"] as const) {
      const palette = theme[mode]!
      for (const { key, required: mandatory } of COLOR_FIELDS) {
        if (mandatory) expect(palette[key]).toMatch(HEX_COLOR)
      }
      expect(contrastWarnings(mode, palette)).toEqual([])
    }
  })

  it.each(CAMPAIGN_TYPES)("%s é aceito pela loja quando publicado", (type) => {
    const response = parseActiveCampaignResponse({
      serverTime: "2026-11-27T14:00:00Z",
      nextChangeAt: null,
      campaign: {
        id: "c1", type, startsAt: "2026-11-27T03:00:00Z", endsAt: "2026-12-01T03:00:00Z",
        updatedAt: "2026-11-26T18:00:00Z", theme: themeInput(templateTheme(type)), content: null, collections: [],
      },
    })

    expect(response?.campaign?.theme.dark.background).toMatch(HEX_COLOR)
  })

  it("entrega uma cópia: editar o tema não muda o modelo", () => {
    templateTheme("CHRISTMAS").dark!.primary = "#000000"

    expect(templateTheme("CHRISTMAS").dark!.primary).toBe("#B3202A")
  })
})
