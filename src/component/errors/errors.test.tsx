// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { App } from "@/App"
import { authClient } from "@/lib/auth"
import { AppErrorBoundary } from "./AppErrorBoundary"
import { ErrorView } from "./ErrorView"
import { RETRY_DELAYS_MS } from "@/lib/useProducts"

vi.mock("@/admin/Admin", () => ({ Admin: () => <div data-testid="admin-panel">painel</div> }))
vi.mock("@/admin/SalesReport", () => ({ SalesReport: () => <div data-testid="sales-report">relatório</div> }))

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

let fetchMock: ReturnType<typeof vi.fn>

function LocationProbe() {
  const { pathname, search } = useLocation()
  return (
    <>
      <div data-testid="path">{pathname}</div>
      <div data-testid="search">{search}</div>
    </>
  )
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  Element.prototype.scrollIntoView = vi.fn()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  authClient.dispose() // o cliente de auth é um singleton: zera sessão/timers entre os testes
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("404", () => {
  it("rota inexistente mostra a página 404 personalizada, com botões para rotas válidas", () => {
    renderApp("/essa-rota-nao-existe")
    expect(screen.getByRole("heading", { name: "Esta fragrância não está por aqui." })).toBeTruthy()
    expect(screen.getByText("Parece que o caminho que você procurava não existe ou foi descontinuado.")).toBeTruthy()
    expect(screen.getByText("404")).toBeTruthy() // número no mesmo padrão das demais telas
    expect(screen.getByRole("link", { name: "Voltar à loja" }).getAttribute("href")).toBe("/")
    expect(screen.getByRole("link", { name: "Explorar fragrâncias" }).getAttribute("href")).toBe("/#colecao")
    expect(fetchMock).not.toHaveBeenCalled() // não consulta a API em uma rota inexistente
  })

  it("subrota inexistente de uma rota válida também cai no 404", () => {
    renderApp("/admin/nao-existe")
    expect(screen.getByRole("heading", { name: "Esta fragrância não está por aqui." })).toBeTruthy()
  })

  it("'Voltar à loja' leva à home", () => {
    fetchMock.mockReturnValue(new Promise(() => {})) // catálogo carregando
    renderApp("/nada")
    fireEvent.click(screen.getByRole("link", { name: "Voltar à loja" }))
    expect(screen.getByTestId("path").textContent).toBe("/")
  })

  it("define título e noindex enquanto está na tela e restaura ao sair", () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    document.title = "Fausto Importados"
    renderApp("/nada")
    expect(document.title).toContain("Esta fragrância não está por aqui.")
    expect(document.querySelector('meta[name="robots"][content="noindex"]')).toBeTruthy()
    fireEvent.click(screen.getByRole("link", { name: "Voltar à loja" }))
    expect(document.title).toBe("Fausto Importados")
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })
})

describe("/erro/:codigo (acesso direto / atualização da página)", () => {
  it.each([
    ["403", "Esta área é reservada.", "Você não tem permissão para acessar este conteúdo.", "Voltar à loja"],
    ["500", "Algo não saiu como esperado.", "Estamos trabalhando para restabelecer tudo. Tente novamente em instantes.", "Tentar novamente"],
    ["502", "Estamos reorganizando nossa conexão.", "Nosso serviço encontrou uma dificuldade temporária ao se comunicar com outro servidor.", "Tentar novamente"],
    ["503", "Estamos preparando tudo para você.", "Nosso catálogo está temporariamente indisponível. Aguarde alguns instantes e tente novamente.", "Tentar novamente"],
    ["504", "Essa conexão está demorando mais que o esperado.", "Não conseguimos concluir sua solicitação a tempo. Por favor, tente novamente.", "Tentar novamente"],
    ["conexao", "Não conseguimos acessar nossas fragrâncias.", "Estamos com dificuldades para estabelecer uma conexão com nosso catálogo.", "Tentar novamente"],
  ])("/erro/%s", (codigo, title, description, button) => {
    renderApp(`/erro/${codigo}`)
    expect(screen.getByRole("heading", { name: title })).toBeTruthy()
    expect(screen.getByText(description)).toBeTruthy()
    expect(screen.getAllByText(button).length).toBeGreaterThan(0)
  })

  it("código desconhecido cai no 404", () => {
    renderApp("/erro/418")
    expect(screen.getByRole("heading", { name: "Esta fragrância não está por aqui." })).toBeTruthy()
  })

  it("'Tentar novamente' em uma página roteada volta à loja (que refaz o carregamento)", () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    renderApp("/erro/503")
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(screen.getByTestId("path").textContent).toBe("/")
    expect(fetchMock).toHaveBeenCalledTimes(1) // a loja buscou o catálogo
  })

  it("não expõe detalhes técnicos", () => {
    renderApp("/erro/500")
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/localhost|stack|Exception|undefined|HTTP \d/i)
  })
})

describe("área restrita (refresh da sessão + /auth/me + papel)", () => {
  // O access token vive só em memória: ao abrir /admin o app primeiro troca o cookie de refresh por um
  // token (/auth/refresh), consulta /auth/me e só então (se for ADMIN) carrega o painel. O mock responde por URL.
  const accessToken = () => json({ accessToken: "access-1", expiresIn: 900 })
  const me = (role: "ADMIN" | "USER" = "ADMIN") => json({ email: "pessoa@x.com", role })
  const route = (handlers: { refresh: () => Response | Promise<Response>; me?: () => Response | Promise<Response> }) =>
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/refresh")) return Promise.resolve(handlers.refresh())
      if (url.endsWith("/auth/me")) return Promise.resolve(handlers.me?.() ?? me())
      if (url.endsWith("/auth/logout")) return Promise.resolve(json({}))
      return new Promise(() => {}) // qualquer outra chamada fica pendente
    })

  it("administrador autenticado vê o painel", async () => {
    route({ refresh: accessToken })
    renderApp("/admin")
    expect(await screen.findByTestId("admin-panel")).toBeTruthy()
    expect(screen.getByTestId("path").textContent).toBe("/admin")
  })

  it("usuário comum (role USER) → 'Esta área é reservada.' e o painel NUNCA é montado", async () => {
    route({ refresh: accessToken, me: () => me("USER") })
    renderApp("/admin")
    expect(await screen.findByRole("heading", { name: "Esta área é reservada." })).toBeTruthy()
    expect(screen.queryByTestId("admin-panel")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe("/admin") // não vai para o login: está logado, só não pode
  })

  it("403 em /auth/me → página 'Esta área é reservada.'", async () => {
    route({ refresh: accessToken, me: () => json({}, 403) })
    renderApp("/admin")
    expect(await screen.findByRole("heading", { name: "Esta área é reservada." })).toBeTruthy()
  })

  it("sem sessão (refresh 401) → entrar, lembrando para onde voltar; /auth/me nem é consultado", async () => {
    route({ refresh: () => json({}, 401) })
    renderApp("/admin/relatorio")
    await vi.waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/entrar"))
    expect(screen.getByTestId("search").textContent).toBe("?next=%2Fadmin%2Frelatorio")
    expect(fetchMock.mock.calls.map(([u]) => u as string).filter((u) => u.endsWith("/auth/me"))).toHaveLength(0)
    expect(screen.queryByTestId("sales-report")).toBeNull()
  })

  it("401 em /auth/me mesmo após renovar → entrar", async () => {
    route({ refresh: accessToken, me: () => json({}, 401) })
    renderApp("/admin")
    await vi.waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/entrar"))
  })

  it("5xx → tela de erro com 'Tentar novamente' que repete a verificação", async () => {
    route({ refresh: () => json({}, 502) })
    renderApp("/admin")
    expect(await screen.findByRole("heading", { name: "Estamos reorganizando nossa conexão." })).toBeTruthy()
    expect(screen.getByTestId("path").textContent).toBe("/admin") // 5xx não é "sem sessão"

    route({ refresh: () => json({}, 401) })
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    await vi.waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/entrar"))
  })

  it("falha de rede → tela de conexão (e não o login)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    renderApp("/admin")
    expect(await screen.findByRole("heading", { name: "Não conseguimos acessar nossas fragrâncias." })).toBeTruthy()
    expect(screen.getByTestId("path").textContent).toBe("/admin")
  })

  it("sessão encerrada enquanto o painel está aberto → volta para entrar", async () => {
    route({ refresh: accessToken })
    renderApp("/admin")
    await screen.findByTestId("admin-panel")

    await act(async () => { await authClient.logout() })

    await vi.waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/entrar"))
    expect(screen.getByTestId("search").textContent).toBe("") // saiu de propósito: login limpo, sem "voltar para /admin"
    expect(screen.queryByTestId("admin-panel")).toBeNull()
  })

  it("sessão derrubada pelo servidor com o painel aberto → entrar, e depois do login volta para a tela em que estava", async () => {
    route({ refresh: accessToken })
    renderApp("/admin")
    await screen.findByTestId("admin-panel")

    route({ refresh: () => json({}, 401) }) // o servidor revogou a sessão
    await act(async () => { await authClient.refresh() })

    await vi.waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/entrar"))
    expect(screen.getByTestId("search").textContent).toBe("?next=%2Fadmin")
  })

  it("o endereço antigo do painel não existe mais (404)", () => {
    renderApp("/nexus-24")
    expect(screen.getByRole("heading", { name: "Esta fragrância não está por aqui." })).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("erro de renderização", () => {
  it("mostra a tela 500 (sem detalhes técnicos) e 'Tentar novamente' recupera", () => {
    let shouldThrow = true
    function Bomb() {
      if (shouldThrow) throw new Error("segredo interno /var/app/stack")
      return <p>tudo certo</p>
    }
    render(
      <MemoryRouter>
        <AppErrorBoundary>
          <Bomb />
        </AppErrorBoundary>
      </MemoryRouter>
    )
    expect(screen.getByRole("heading", { name: "Algo não saiu como esperado." })).toBeTruthy()
    expect(document.body.textContent).not.toContain("segredo interno")

    shouldThrow = false
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(screen.getByText("tudo certo")).toBeTruthy()
  })
})

describe("ErrorView embutido", () => {
  it("usa o callback de retry recebido", () => {
    const onRetry = vi.fn()
    render(
      <MemoryRouter>
        <ErrorView code="connection" layout="embedded" onRetry={onRetry} />
      </MemoryRouter>
    )
    expect(screen.getByRole("alert")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe("catálogo (vitrine)", () => {
  const products = [{
    id: "1", name: "Perfume 1", brand: "Marca", description: "", price: 100, image: "",
    category: "unissex", size: "100", inStock: true, concentration: "edp", olfactiveFamily: "floral",
  }]

  it("503 só aparece após as retentativas (antes disso, skeleton); retry recupera o catálogo", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(json({}, 503))
    renderApp("/")

    await act(async () => {})
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy() // ainda carregando
    expect(screen.queryByText("Estamos preparando tudo para você.")).toBeNull()
    expect(screen.queryByText("Nenhuma fragrância encontrada")).toBeNull()

    for (const delay of RETRY_DELAYS_MS) await act(async () => { await vi.advanceTimersByTimeAsync(delay) })
    expect(screen.getByRole("heading", { name: "Estamos preparando tudo para você." })).toBeTruthy()
    expect(screen.queryByText("Nenhuma fragrância encontrada")).toBeNull()

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(json({ content: products }))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" })) })
    expect(screen.getByText("Perfume 1")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("falha de conexão mostra 'Não conseguimos acessar nossas fragrâncias.'", async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    renderApp("/")
    await act(async () => {})
    for (const delay of RETRY_DELAYS_MS) await act(async () => { await vi.advanceTimersByTimeAsync(delay) })
    expect(screen.getByRole("heading", { name: "Não conseguimos acessar nossas fragrâncias." })).toBeTruthy()
  })
})
