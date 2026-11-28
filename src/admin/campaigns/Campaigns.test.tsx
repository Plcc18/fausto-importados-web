// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { toast } from "sonner"
import { Campaigns } from "./Campaigns"
import type { CampaignSummary } from "./types"
import { Admin } from "@/admin/Admin"
import { ReauthPromptHost } from "@/admin/ReauthPromptHost"
import { NoticeHost } from "@/component/NoticeHost"
import { API_URL } from "@/lib/api"
import { authClient } from "@/lib/auth"
import { dismissNotice } from "@/lib/notice"
import { ROUTES } from "@/routes"

// Pedidos e notificações do painel não interessam aqui (e abririam polls).
vi.mock("@/admin/useAdminPushNotifications", () => ({
  useAdminPushNotifications: () => ({ pendingCount: 0, poll: vi.fn() }),
}))
vi.mock("@/admin/NotificationsPanel", () => ({ NotificationsPanel: () => null }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const campaign = (id: string, extra: Partial<CampaignSummary> = {}): CampaignSummary => ({
  id,
  name: `Campanha ${id}`,
  type: "BLACK_FRIDAY",
  status: "PUBLISHED",
  phase: "ACTIVE",
  priority: 10,
  startsAt: "2026-11-27T03:00:00Z",
  endsAt: "2026-12-01T03:00:00Z",
  updatedAt: "2026-11-20T15:30:00Z",
  updatedBy: "dono@loja.com",
  collectionCount: 2,
  version: 4,
  ...extra,
})
const draft = (id: string, extra: Partial<CampaignSummary> = {}) =>
  campaign(id, { status: "DRAFT", phase: null, ...extra })

let fetchMock: ReturnType<typeof vi.fn>
/** O que a lista devolve, na ordem em que a API devolveria. */
let stored: CampaignSummary[]
/** Respostas forçadas para as próximas consultas da lista. */
let listAnswers: (() => Response)[]
/** Respostas forçadas para as próximas escritas. */
let writeAnswers: (() => Response | Promise<Response>)[]
/** As escritas sensíveis exigem o código 2FA, como na API. */
let requireReauth: boolean

interface Call { url: URL; method: string; headers: Headers; body: unknown }
const calls = (): Call[] =>
  fetchMock.mock.calls.map(([url, init = {}]) => ({
    url: new URL(String(url)),
    method: (init as RequestInit).method ?? "GET",
    headers: new Headers((init as RequestInit).headers),
    body: typeof (init as RequestInit).body === "string" ? JSON.parse((init as RequestInit).body as string) : undefined,
  }))
const listCalls = () => calls().filter((c) => c.url.pathname === "/api/admin/campaigns")
const lastQuery = () => Object.fromEntries(listCalls().at(-1)!.url.searchParams)
const writes = () => calls().filter((c) => c.url.pathname.startsWith("/api/admin/campaigns/"))

const SENSITIVE = /\/(activate-now|reactivate|archive)$/

function installApi() {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const { pathname, searchParams } = new URL(url)
    const method = init.method ?? "GET"
    if (pathname === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (pathname === "/auth/reauth") return json({ reauthToken: "prova-2fa", expiresIn: 300 })
    // chamadas do painel principal (teste de acesso)
    if (pathname === "/api/product") return json({ content: [] })
    if (pathname === "/api/orders/sales-stats") return json({ day: 0, month: 0, year: 0 })

    if (pathname === "/api/admin/campaigns") {
      const forced = listAnswers.shift()
      if (forced) return forced()
      const page = Number(searchParams.get("page"))
      const size = Number(searchParams.get("size"))
      return json({
        content: stored.slice(page * size, (page + 1) * size),
        page: { size, number: page, totalElements: stored.length, totalPages: Math.ceil(stored.length / size) },
      })
    }

    if (pathname.startsWith("/api/admin/campaigns/")) {
      const sensitive = SENSITIVE.test(pathname) || method === "DELETE"
      if (sensitive && requireReauth && new Headers(init.headers).get("X-Reauth") !== "prova-2fa") {
        return json({ code: "reauth_required" }, 403)
      }
      const forced = writeAnswers.shift()
      if (forced) return forced()
      if (method === "DELETE") {
        stored = stored.filter((c) => !pathname.endsWith(`/${c.id}`))
        return new Response(null, { status: 204 })
      }
      return json({}, pathname.endsWith("/duplicate") ? 201 : 200)
    }
    throw new Error(`rota inesperada: ${method} ${pathname}`)
  })
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[ROUTES.adminCampaigns]}>
      <NoticeHost />
      <ReauthPromptHost />
      <Routes>
        <Route path={ROUTES.adminCampaigns} element={<Campaigns />} />
        <Route path={ROUTES.admin} element={<div data-testid="admin-panel">painel</div>} />
      </Routes>
    </MemoryRouter>,
  )

const row = (id: string) => screen.getByTestId(`campaign-${id}`)
const findRow = (id: string) => screen.findByTestId(`campaign-${id}`)
const rowButtons = (id: string) => within(row(id)).getAllByRole("button").map((b) => b.textContent)
const rowButton = (id: string, label: string) =>
  within(row(id)).getByRole("button", { name: `${label}: Campanha ${id}` }) as HTMLButtonElement

/** Clica na ação da linha e confirma no diálogo. */
async function act(id: string, label: string) {
  await findRow(id)
  await waitFor(() => expect(rowButton(id, label).disabled).toBe(false))
  fireEvent.click(rowButton(id, label))
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: label }))
}

async function typeCode() {
  fireEvent.change(await screen.findByLabelText("Código"), { target: { value: "123456" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
}

const choose = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(async () => {
  localStorage.clear()
  vi.clearAllMocks()
  stored = [campaign("a")]
  listAnswers = []
  writeAnswers = []
  requireReauth = false
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  installApi()
  await authClient.login("dono@loja.com", "x")
})

afterEach(() => {
  cleanup()
  dismissNotice()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("listagem de campanhas", () => {
  it("consulta a primeira página autenticada e mostra os dados de cada campanha no horário de Fortaleza", async () => {
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Campanhas" })).toBeTruthy()
    expect(screen.getByText("Carregando campanhas...")).toBeTruthy()

    const item = await findRow("a")

    expect(within(item).getByRole("heading", { name: "Campanha a" })).toBeTruthy()
    expect(within(item).getByText("No ar")).toBeTruthy()
    expect(item.textContent).toContain("Black Friday · Prioridade 10 · 2 coleções")
    expect(item.textContent).toContain("27/11/2026 às 00:00 até 01/12/2026 às 00:00")
    expect(item.textContent).toContain("Atualizada em 20/11/2026 às 12:30 por dono@loja.com")
    expect(screen.getByRole("status").textContent).toBe("1 campanha")
    const [first] = listCalls()
    expect(first.url.href).toBe(`${API_URL}/api/admin/campaigns?page=0&size=20`)
    expect(first.headers.get("Authorization")).toBe("Bearer access-1")
  })

  it("mostra um rascunho ainda sem nome, tipo e datas", async () => {
    stored = [draft("r", { name: null, type: null, startsAt: null, endsAt: null, updatedBy: null, collectionCount: 1 })]
    renderPage()

    const item = await findRow("r")

    expect(within(item).getByRole("heading", { name: "Sem nome" })).toBeTruthy()
    expect(item.textContent).toContain("Sem tipo · Prioridade 10 · 1 coleção")
    expect(item.textContent).toContain("Sem datas")
  })

  it("oferece em cada situação só as ações que a API aceita (contrato §7.3)", async () => {
    stored = [
      draft("rascunho"),
      campaign("agendada", { phase: "SCHEDULED" }),
      campaign("no-ar"),
      campaign("encerrada", { phase: "EXPIRED" }),
      campaign("desativada", { status: "DISABLED", phase: null }),
      campaign("arquivada", { status: "ARCHIVED", phase: null }),
    ]
    renderPage()
    await findRow("rascunho")

    expect(rowButtons("rascunho")).toEqual(["Ativar agora", "Duplicar", "Arquivar", "Excluir"])
    expect(rowButtons("agendada")).toEqual(["Ativar agora", "Desativar", "Duplicar"])
    expect(rowButtons("no-ar")).toEqual(["Desativar", "Duplicar"])
    expect(rowButtons("encerrada")).toEqual(["Duplicar", "Arquivar"])
    expect(rowButtons("desativada")).toEqual(["Reativar", "Duplicar", "Arquivar"])
    expect(rowButtons("arquivada")).toEqual(["Duplicar"])
    for (const [id, label] of [["rascunho", "Rascunho"], ["agendada", "Agendada"], ["encerrada", "Encerrada"], ["desativada", "Desativada"], ["arquivada", "Arquivada"]]) {
      expect(within(row(id)).getByText(label)).toBeTruthy()
    }
  })

  it("sem nenhuma campanha, diz que não há cadastro", async () => {
    stored = []
    renderPage()

    expect(await screen.findByText("Nenhuma campanha cadastrada.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull()
  })

  it.each([
    ["a API responde 500", () => json({}, 500), "Algo não saiu como esperado."],
    ["a API responde 503", () => json({}, 503), "Estamos preparando tudo para você."],
    ["a conta não tem permissão", () => json({}, 403), "Esta área é reservada."],
    ["a resposta vem em outro formato", () => json({ content: [{ id: 1 }] }), "Não conseguimos acessar nossas fragrâncias."],
    ["a conexão cai", () => { throw new TypeError("Failed to fetch") }, "Não conseguimos acessar nossas fragrâncias."],
  ])("quando %s, mostra a tela de erro correspondente", async (_, answer, title) => {
    listAnswers = [answer]
    renderPage()

    expect(await screen.findByRole("heading", { name: title })).toBeTruthy()
  })

  it("depois de um erro, “Tentar novamente” carrega a lista", async () => {
    listAnswers = [() => json({}, 500)]
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }))

    expect(await findRow("a")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("volta ao painel", () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao painel" }))

    expect(screen.getByTestId("admin-panel")).toBeTruthy()
  })

  it("é aberta pelo botão “Campanhas” do painel", async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.admin]}>
        <Routes>
          <Route path={ROUTES.admin} element={<Admin />} />
          <Route path={ROUTES.adminCampaigns} element={<Campaigns />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Campanhas" }))

    expect(await findRow("a")).toBeTruthy()
  })
})

describe("busca, filtros e páginas", () => {
  it("envia busca, situação, tipo e período à API", async () => {
    renderPage()
    await findRow("a")

    choose("Buscar", "natal")
    choose("Situação", "EXPIRED")
    choose("Tipo", "CHRISTMAS")
    choose("Período: de", "2026-12-01")
    choose("Período: até", "2026-12-25")

    await waitFor(() =>
      expect(lastQuery()).toEqual({
        q: "natal", phase: "EXPIRED", type: "CHRISTMAS",
        from: "2026-12-01T03:00:00.000Z", to: "2026-12-26T03:00:00.000Z",
        page: "0", size: "20",
      }),
    )
  })

  it("não consulta a API a cada tecla", async () => {
    renderPage()
    await findRow("a")

    for (const typed of ["n", "na", "nat", "nata", "natal"]) choose("Buscar", typed)

    await waitFor(() => expect(lastQuery().q).toBe("natal"))
    expect(listCalls()).toHaveLength(2)
  })

  it("sem resultado, avisa e permite limpar os filtros", async () => {
    renderPage()
    await findRow("a")
    listAnswers = [() => json({ content: [], page: { size: 20, number: 0, totalElements: 0, totalPages: 0 } })]
    choose("Situação", "ARCHIVED")
    expect(await screen.findByText("Nenhuma campanha encontrada com esses filtros.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))

    expect(await findRow("a")).toBeTruthy()
    expect((screen.getByLabelText("Situação") as HTMLSelectElement).value).toBe("")
    expect(lastQuery()).toEqual({ page: "0", size: "20" })
  })

  it("com o fim antes do início, explica o erro e não consulta a API", async () => {
    renderPage()
    await findRow("a")

    choose("Período: de", "2026-12-10")
    choose("Período: até", "2026-12-01")

    expect((await screen.findByRole("alert")).textContent).toContain("igual ou posterior")
    expect(screen.getByText("Corrija o período para ver as campanhas.")).toBeTruthy()
    expect(listCalls()).toHaveLength(1)
  })

  it("pagina de 20 em 20 e volta à primeira página quando o filtro muda", async () => {
    stored = Array.from({ length: 45 }, (_, i) => campaign(`n${i}`))
    renderPage()
    await findRow("n0")
    expect(screen.getByText("1–20 de 45")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "3" }))
    await findRow("n40")
    expect(lastQuery().page).toBe("2")

    choose("Situação", "ACTIVE")
    await findRow("n0")
    expect(lastQuery()).toEqual({ phase: "ACTIVE", page: "0", size: "20" })
    expect(listCalls().filter((c) => c.url.searchParams.get("phase")).map((c) => c.url.searchParams.get("page"))).toEqual(["0"])
  })

  it("ao excluir o último item da última página, volta para a anterior", async () => {
    stored = Array.from({ length: 21 }, (_, i) => draft(`n${i}`))
    renderPage()
    await findRow("n0")
    fireEvent.click(screen.getByRole("button", { name: "2" }))

    await act("n20", "Excluir")

    expect(await findRow("n0")).toBeTruthy()
    expect(screen.queryByText("Nenhuma campanha cadastrada.")).toBeNull()
  })
})

describe("ações sobre uma campanha", () => {
  it("pede confirmação e, se a pessoa cancelar, não faz nada", async () => {
    renderPage()
    await findRow("a")

    fireEvent.click(rowButton("a", "Desativar"))
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("A campanha “Campanha a” sai do ar")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(writes()).toHaveLength(0)
  })

  it.each([
    ["no ar", campaign("a"), "quem está com ela aberta só vê a mudança ao recarregar ou voltar para a aba"],
    ["agendada", campaign("a", { phase: "SCHEDULED" }), "não vai entrar no ar no horário marcado"],
  ])("ao desativar uma campanha %s, explica o efeito sem prometer prazo à loja aberta", async (_, item, effect) => {
    stored = [item]
    renderPage()
    await findRow("a")

    fireEvent.click(rowButton("a", "Desativar"))

    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain(effect)
    expect(dialog.textContent).not.toContain("minuto")
  })

  it("desativa sem pedir código 2FA, enviando a versão, e atualiza a lista", async () => {
    renderPage()

    await act("a", "Desativar")

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Campanha desativada."))
    const [write] = writes()
    expect([write.method, write.url.pathname, write.body]).toEqual(["POST", "/api/admin/campaigns/a/disable", { version: 4 }])
    expect(write.headers.has("X-Reauth")).toBe(false)
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(screen.queryByLabelText("Código")).toBeNull()
  })

  it.each([
    ["Ativar agora", draft("a"), "POST", "/api/admin/campaigns/a/activate-now", "Campanha ativada."],
    ["Reativar", campaign("a", { status: "DISABLED", phase: null }), "POST", "/api/admin/campaigns/a/reactivate", "Campanha reativada."],
    ["Arquivar", campaign("a", { phase: "EXPIRED" }), "POST", "/api/admin/campaigns/a/archive", "Campanha arquivada."],
    ["Excluir", draft("a"), "DELETE", "/api/admin/campaigns/a", "Rascunho excluído."],
  ])("“%s” pede o código 2FA e repete a chamada com a confirmação", async (label, item, method, path, done) => {
    stored = [item]
    requireReauth = true
    renderPage()

    await act("a", label)
    await typeCode()

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(done))
    const [refused, accepted] = writes()
    expect(refused.headers.has("X-Reauth")).toBe(false)
    expect([accepted.method, accepted.url.pathname, accepted.headers.get("X-Reauth")]).toEqual([method, path, "prova-2fa"])
    // a versão vai no corpo das ações e na URL da exclusão
    if (method === "DELETE") expect(accepted.url.search).toBe("?version=4")
    else expect(accepted.body).toEqual({ version: 4 })
  })

  it("se a pessoa desistir do código, avisa que nada mudou", async () => {
    stored = [draft("a")]
    requireReauth = true
    renderPage()

    await act("a", "Excluir")
    await screen.findByLabelText("Código")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(await screen.findByText("A confirmação de identidade não foi concluída. Nada foi alterado.")).toBeTruthy()
    expect(toast.success).not.toHaveBeenCalled()
    expect(writes()).toHaveLength(1)
  })

  it("duplica com Idempotency-Key: a mesma ao repetir depois de uma falha, outra numa nova cópia", async () => {
    writeAnswers = [() => { throw new TypeError("Failed to fetch") }]
    renderPage()

    await act("a", "Duplicar")
    expect(await screen.findByText(/Confira na lista se a ação foi feita/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "OK" }))
    await act("a", "Duplicar")
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cópia criada como rascunho, sem datas."))
    await act("a", "Duplicar")
    await waitFor(() => expect(writes()).toHaveLength(3))

    const keys = writes().map((w) => w.headers.get("Idempotency-Key"))
    expect(writes()[0].url.pathname).toBe("/api/admin/campaigns/a/duplicate")
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[1])
  })

  it("bloqueia os botões enquanto a ação não termina", async () => {
    let finish!: (res: Response) => void
    writeAnswers = [() => new Promise<Response>((resolve) => { finish = resolve })]
    stored = [campaign("a"), campaign("b")]
    renderPage()

    await act("a", "Desativar")

    await waitFor(() => expect(rowButton("b", "Duplicar").disabled).toBe(true))
    expect(rowButton("a", "Desativar").disabled).toBe(true)
    finish(json({}))
    await waitFor(() => expect(rowButton("b", "Duplicar").disabled).toBe(false))
  })

  it.each([
    [409, { code: "version_conflict" }, "A campanha foi alterada por outra operação, e nada foi feito."],
    [409, { code: "invalid_transition", message: "Não é possível desativar uma campanha encerrada." }, "Não é possível desativar uma campanha encerrada. A lista foi atualizada."],
    [409, { code: "campaign_conflict", message: "O período se sobrepõe ao da campanha \"Natal\"." }, "O período se sobrepõe ao da campanha \"Natal\"."],
    [409, { code: "concurrent_operation", message: "Operação concorrente em andamento. Tente novamente." }, "Operação concorrente em andamento."],
    [404, { code: "not_found" }, "Essa campanha não existe mais."],
    [429, {}, "Muitas tentativas."],
    [500, {}, "O servidor não concluiu a operação."],
  ])("recusa %i %o: explica o motivo e atualiza a lista", async (status, body, text) => {
    writeAnswers = [() => json(body, status)]
    renderPage()

    await act("a", "Desativar")

    const notice = await screen.findByRole("dialog")
    expect(within(notice).getByRole("heading", { name: "Não foi possível desativar" })).toBeTruthy()
    expect(notice.textContent).toContain(text)
    expect(toast.success).not.toHaveBeenCalled()
    await waitFor(() => expect(listCalls()).toHaveLength(2))
  })

  it("ao ativar um rascunho incompleto, diz o que falta", async () => {
    stored = [draft("a")]
    writeAnswers = [() => json({
      code: "publish_requirements",
      fields: [
        { field: "endsAt", message: "Informe o fim." },
        { field: "theme.dark", message: "Defina as cores do tema escuro." },
      ],
    }, 422)]
    renderPage()

    await act("a", "Ativar agora")

    expect(await screen.findByText(
      "Complete a campanha antes. Fim: Informe o fim. Tema escuro: Defina as cores do tema escuro.",
    )).toBeTruthy()
  })
})
