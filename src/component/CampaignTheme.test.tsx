// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom"
import type { CampaignState } from "@/lib/campaign/store"
import type { PublicCampaign } from "@/lib/campaign/types"
import { CAMPAIGN_THEME_ATTRIBUTE } from "@/lib/campaign/theme"

// O hook real busca na API; aqui o estado é controlado pelo teste
const campaignState = vi.hoisted(() => ({ current: { status: "ready", campaign: null } as CampaignState }))
vi.mock("@/lib/campaign/useActiveCampaign", () => ({ useActiveCampaign: () => campaignState.current }))

const { CampaignThemeHost } = await import("./CampaignTheme")

const blackFriday = {
  id: "c1",
  theme: {
    dark: {
      background: "#0B0B0F", foreground: "#F5F1E8", primary: "#C1121F", primaryForeground: "#FFFFFF", accent: "#1F1F27",
      surface: null, mutedForeground: null, border: null, badge: null, badgeForeground: null, gold: null,
    },
    light: null,
  },
} as unknown as PublicCampaign

const christmas = {
  ...blackFriday,
  id: "c2",
  theme: { ...blackFriday.theme, dark: { ...blackFriday.theme.dark, primary: "#0A7A3B" } },
} as PublicCampaign

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CampaignThemeHost />
    </MemoryRouter>,
  )
}

const isThemed = () => document.documentElement.hasAttribute(CAMPAIGN_THEME_ATTRIBUTE)
const themeCss = () => document.getElementById("campaign-theme")?.textContent ?? ""

beforeEach(() => {
  campaignState.current = { status: "ready", campaign: blackFriday }
})

afterEach(() => cleanup())

describe("CampaignThemeHost", () => {
  it("aplica o tema da campanha na loja", () => {
    renderAt("/")

    expect(isThemed()).toBe(true)
    expect(themeCss()).toContain("--primary: #C1121F;")
  })

  it("sem campanha, tema padrão", () => {
    campaignState.current = { status: "ready", campaign: null }
    renderAt("/")

    expect(isThemed()).toBe(false)
  })

  it.each(["/admin", "/entrar", "/erro/500"])("não aplica em %s", (path) => {
    renderAt(path)

    expect(isThemed()).toBe(false)
  })

  it("remove o tema ao sair da loja para o painel", () => {
    const router = createMemoryRouter([{ path: "*", element: <CampaignThemeHost /> }], { initialEntries: ["/"] })
    render(<RouterProvider router={router} />)
    expect(isThemed()).toBe(true)

    act(() => void router.navigate("/admin"))

    expect(isThemed()).toBe(false)
  })

  it("trocar de campanha muda o visual; encerrar volta ao padrão", () => {
    const view = renderAt("/")

    campaignState.current = { status: "ready", campaign: christmas }
    view.rerender(
      <MemoryRouter initialEntries={["/"]}>
        <CampaignThemeHost />
      </MemoryRouter>,
    )
    expect(themeCss()).toContain("--primary: #0A7A3B;")

    campaignState.current = { status: "ready", campaign: null }
    view.rerender(
      <MemoryRouter initialEntries={["/"]}>
        <CampaignThemeHost />
      </MemoryRouter>,
    )
    expect(isThemed()).toBe(false)
  })
})
