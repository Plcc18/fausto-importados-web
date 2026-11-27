// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import type { CampaignState } from "@/lib/campaign/store"
import type { CampaignTopBar, PublicCampaign } from "@/lib/campaign/types"

// O hook real busca na API; aqui o estado é controlado pelo teste
const campaignState = vi.hoisted(() => ({ current: { status: "ready", campaign: null } as CampaignState }))
vi.mock("@/lib/campaign/useActiveCampaign", () => ({ useActiveCampaign: () => campaignState.current }))

const { StoreTopBar } = await import("./StoreTopBar")

function withTopBar(topBar: CampaignTopBar | null) {
  campaignState.current = {
    status: "ready",
    campaign: { id: "c1", content: { topBar, hero: null, promoImages: [], decorations: [] } } as unknown as PublicCampaign,
  }
}

function Location() {
  const { pathname, search } = useLocation()
  return <output data-testid="location">{pathname + search}</output>
}

function renderBar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <StoreTopBar />
      <Location />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  campaignState.current = { status: "ready", campaign: null }
})

describe("StoreTopBar", () => {
  it("sem campanha: a faixa de sempre, só no computador", () => {
    renderBar()

    const text = screen.getByText("Fragrâncias 100% Originais")
    expect(screen.getByText("Parcele em até 12x")).toBeTruthy()
    expect(text.closest("div.hidden")?.className).toContain("md:block")
    expect(screen.queryByTestId("campaign-top-bar")).toBeNull()
  })

  it("campanha sem faixa (topBar null): mantém a faixa de sempre", () => {
    withTopBar(null)
    renderBar()

    expect(screen.getByText("Fragrâncias 100% Originais")).toBeTruthy()
  })

  it("com faixa: o texto da campanha, visível também no celular", () => {
    withTopBar({ text: "Black Friday: até 40% off", link: null })
    renderBar()

    const bar = screen.getByTestId("campaign-top-bar")
    expect(bar.textContent).toBe("Black Friday: até 40% off")
    expect(bar.className).not.toMatch(/\bhidden\b/)
    expect(screen.queryByText("Fragrâncias 100% Originais")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("com barra no final, a página do site é reconhecida e navega sem recarregar", () => {
    withTopBar({ text: "Veja os termos", link: "/termos/" })
    renderBar()

    fireEvent.click(screen.getByRole("link", { name: "Veja os termos" }))

    expect(screen.getByTestId("location").textContent).toBe("/termos")
  })

  it("link para outra página do site navega sem recarregar", () => {
    withTopBar({ text: "Veja os termos", link: "/termos" })
    renderBar()
    const link = screen.getByRole("link", { name: "Veja os termos" })

    expect(link.getAttribute("target")).toBeNull()
    fireEvent.click(link)
    expect(screen.getByTestId("location").textContent).toBe("/termos")
  })

  it.each(["/?colecao=ofertas", "/#colecao", "/?produto=123", "/auth/algo"])(
    "link para a própria loja ou para o servidor (%s) usa a navegação normal do navegador",
    (href) => {
      withTopBar({ text: "Ver ofertas", link: href })
      renderBar()
      const link = screen.getByRole("link", { name: "Ver ofertas" })
      // Sem o React Router, o clique não muda a rota por dentro: quem navega é o navegador (e a loja lê a URL).
      // Depois de conferir que ninguém impediu o clique, impede aqui: o jsdom não sabe navegar e reclamaria.
      let preventedByApp: boolean | null = null
      const record = (event: Event) => {
        preventedByApp = event.defaultPrevented
        event.preventDefault()
      }
      document.addEventListener("click", record)
      fireEvent.click(link)
      document.removeEventListener("click", record)

      expect(link.getAttribute("href")).toBe(href)
      expect(link.getAttribute("target")).toBeNull()
      expect(preventedByApp).toBe(false)
      expect(screen.getByTestId("location").textContent).toBe("/")
    },
  )

  it("no celular, a faixa da campanha tem no máximo 2 linhas", () => {
    withTopBar({ text: "x".repeat(120), link: null })
    renderBar()

    const classes = screen.getByText("x".repeat(120)).className.split(" ")
    expect(classes).toEqual(expect.arrayContaining(["line-clamp-2", "md:line-clamp-none"]))
  })

  it("link externo abre em outra aba, com noopener e aviso para leitores de tela", () => {
    withTopBar({ text: "Siga no Instagram", link: "https://instagram.com/fausto" })
    renderBar()
    const link = screen.getByRole("link", { name: "Siga no Instagram (abre em nova aba)" })

    expect(link.getAttribute("href")).toBe("https://instagram.com/fausto")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("texto com HTML aparece como texto comum (nunca vira HTML)", () => {
    withTopBar({ text: "<img src=x onerror=alert(1)>", link: null })
    renderBar()

    expect(screen.getByTestId("campaign-top-bar").textContent).toBe("<img src=x onerror=alert(1)>")
    expect(document.querySelector("img")).toBeNull()
  })
})
