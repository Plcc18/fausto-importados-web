// @vitest-environment jsdom
/**
 * O script do `index.html` (T20) repete regras de `store.ts` e `theme.ts` em JavaScript simples, porque roda antes
 * de o bundle carregar. Este teste executa o script de verdade e confere que ele chega ao mesmo resultado.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CAMPAIGN_CACHE_KEY, createCampaignStore, readCampaignCache, writeCampaignCache } from "./store"
import { CAMPAIGN_THEME_ATTRIBUTE, CAMPAIGN_THEME_STYLE_ID, applyCampaignTheme, campaignThemeCss } from "./theme"
import type { ThemePalette } from "./types"

const NOW = Date.parse("2026-11-27T14:00:00Z")
const HOUR = 60 * 60 * 1000

/** O `<script>` clássico do `index.html` que cuida do tema da campanha. */
const PREPAINT_SCRIPT = (() => {
  const html = readFileSync(join(process.cwd(), "index.html"), "utf-8")
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  const script = scripts.find((code) => code.includes(CAMPAIGN_CACHE_KEY))
  if (!script) throw new Error("script do tema da campanha não encontrado no index.html")
  return script
})()

const runPrepaint = () => new Function(PREPAINT_SCRIPT)()

const dark: ThemePalette = {
  background: "#0B0B0F",
  foreground: "#F5F1E8",
  primary: "#E0242F",
  primaryForeground: "#FFFFFF",
  accent: "#24161A",
  surface: null,
  mutedForeground: null,
  border: "#4A1F25",
  badge: "#E0242F",
  badgeForeground: "#FFFFFF",
  gold: null,
}

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    type: "BLACK_FRIDAY",
    startsAt: "2026-11-27T03:00:00Z",
    endsAt: "2026-11-27T16:00:00Z",
    updatedAt: "2026-11-26T18:00:00Z",
    theme: { dark, light: null },
    content: null,
    collections: [],
    ...overrides,
  }
}

function saveCache({
  campaignData = campaign() as unknown,
  nextChangeAt = "2026-11-27T16:00:00Z" as string | null,
  savedAt = NOW,
  clockOffsetMs = 0,
} = {}) {
  localStorage.setItem(
    CAMPAIGN_CACHE_KEY,
    JSON.stringify({ savedAt, clockOffsetMs, response: { serverTime: new Date(NOW).toISOString(), nextChangeAt, campaign: campaignData } }),
  )
}

const appliedCss = () => document.getElementById(CAMPAIGN_THEME_STYLE_ID)?.textContent ?? null
const isThemed = () => document.documentElement.hasAttribute(CAMPAIGN_THEME_ATTRIBUTE)

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  applyCampaignTheme(null)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("script do index.html: mesmo CSS do theme.ts", () => {
  it.each([
    ["só paleta escura", { dark, light: null }],
    ["paletas escura e clara", { dark, light: { ...dark, background: "#FFF4F2", foreground: "#1A0A0A" } }],
    [
      "todos os campos opcionais e o dourado",
      {
        dark: {
          ...dark,
          surface: "#15101A",
          mutedForeground: "#C9A9A9",
          gold: { hi: "#FFE3E3", mid: "#E0A0A0", lo: "#C06060", deep: "#802020" },
        },
        light: null,
      },
    ],
  ])("%s", (_, theme) => {
    saveCache({ campaignData: campaign({ theme }) })

    runPrepaint()

    expect(isThemed()).toBe(true)
    expect(appliedCss()).toBe(campaignThemeCss(theme))
  })

  it("o React assume o tema sem removê-lo (o store já nasce com a campanha do cache)", () => {
    saveCache()
    runPrepaint()
    const style = document.getElementById(CAMPAIGN_THEME_STYLE_ID)

    const store = createCampaignStore({ storage: localStorage })
    const theme = store.getState().campaign?.theme ?? null
    applyCampaignTheme(theme)

    expect(document.getElementById(CAMPAIGN_THEME_STYLE_ID)).toBe(style)
    expect(appliedCss()).toBe(campaignThemeCss(theme!))
  })
})

describe("script do index.html: mesma validade do store.ts", () => {
  const cases: [string, () => void][] = [
    ["campanha que já terminou", () => saveCache({ campaignData: campaign({ endsAt: "2026-11-27T13:00:00Z" }), nextChangeAt: null })],
    ["horário de mudança já passou", () => saveCache({ nextChangeAt: "2026-11-27T13:30:00Z" })],
    ["campanha que ainda não começou", () => saveCache({ campaignData: campaign({ startsAt: "2026-11-27T15:00:00Z" }) })],
    ["cache com mais de 24 h", () => saveCache({ savedAt: NOW - 25 * HOUR, nextChangeAt: null, campaignData: campaign({ endsAt: "2026-12-30T00:00:00Z" }) })],
    ["relógio do servidor diz que já terminou", () => saveCache({ clockOffsetMs: 3 * HOUR })],
    ["sem campanha", () => saveCache({ campaignData: null })],
    ["cor que tenta injetar CSS", () => saveCache({ campaignData: campaign({ theme: { dark: { ...dark, primary: "red} body{display:none" }, light: null } }) })],
    ["cor obrigatória faltando", () => saveCache({ campaignData: campaign({ theme: { dark: { ...dark, background: null }, light: null } }) })],
    ["JSON corrompido", () => localStorage.setItem(CAMPAIGN_CACHE_KEY, "{não é json")],
  ]

  it.each(cases)("não aplica: %s (e o store também descarta)", (_, setup) => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    setup()

    expect(() => runPrepaint()).not.toThrow()
    expect(isThemed()).toBe(false)
    expect(readCampaignCache(localStorage)?.response.campaign ?? null).toBeNull()
  })

  it.each(["/admin", "/entrar", "/erro/500"])("não aplica fora das páginas públicas: %s", (path) => {
    saveCache()
    window.history.replaceState(null, "", path)

    runPrepaint()

    expect(isThemed()).toBe(false)
  })

  it("aplica nas demais páginas públicas", () => {
    saveCache()
    window.history.replaceState(null, "", "/termos")

    runPrepaint()

    expect(isThemed()).toBe(true)
  })

  it("lê o cache no formato que o store grava", () => {
    writeCampaignCache(localStorage, {
      savedAt: NOW,
      clockOffsetMs: 0,
      response: { serverTime: new Date(NOW).toISOString(), nextChangeAt: null, campaign: campaign() as never },
    })

    runPrepaint()

    expect(isThemed()).toBe(true)
  })
})
