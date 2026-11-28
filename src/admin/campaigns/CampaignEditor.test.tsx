// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Campaigns } from "./Campaigns"
import type { CampaignDetail } from "./types"
import { ReauthPromptHost } from "@/admin/ReauthPromptHost"
import { NoticeHost } from "@/component/NoticeHost"
import { authClient } from "@/lib/auth"
import { ROUTES } from "@/routes"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const theme = { dark: { background: "#000000", foreground: "#FFFFFF", primary: "#C1121F", primaryForeground: "#FFFFFF", accent: "#111111" }, light: null }
const content = { topBar: { text: "Ofertas", link: null }, hero: null, promoImages: [], decorations: ["SNOW"] }
const collections = [{ id: "col-1", title: "Ofertas", slug: "ofertas", position: 0, products: [{ productId: "p1", position: 0, discount: null }] }]

const detail = (extra: Partial<CampaignDetail> = {}): CampaignDetail => ({
  id: "c1",
  name: "Black Friday 2026",
  description: "Anotação",
  type: "BLACK_FRIDAY",
  priority: 10,
  // com segundos e microssegundos, como depois de "ativar agora"
  startsAt: "2026-11-27T03:00:42.123456Z",
  endsAt: "2026-12-01T03:00:00Z",
  theme,
  content,
  collections,
  status: "DRAFT",
  phase: null,
  version: 4,
  ...extra,
})

let fetchMock: ReturnType<typeof vi.fn>
let server: CampaignDetail
/** Respostas forçadas para as próximas leituras do detalhe e para as próximas escritas. */
let readAnswers: (() => Response)[]
let writeAnswers: (() => Response | Promise<Response>)[]
let requireReauth: boolean

const calls = () =>
  fetchMock.mock.calls.map(([url, init = {}]) => {
    const request = init as RequestInit
    return {
      url: new URL(String(url)),
      method: request.method ?? "GET",
      headers: new Headers(request.headers),
      body: typeof request.body === "string" ? JSON.parse(request.body) : undefined,
    }
  })
const writes = () => calls().filter((c) => c.method !== "GET" && c.url.pathname.startsWith("/api/admin/campaigns"))
const written = () => writes().map((c) => `${c.method} ${c.url.pathname}`)
const detailReads = () => calls().filter((c) => c.method === "GET" && /\/api\/admin\/campaigns\/[^/]+$/.test(c.url.pathname))

function installApi() {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const { pathname } = new URL(url)
    const method = init.method ?? "GET"
    if (pathname === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (pathname === "/auth/reauth") return json({ reauthToken: "prova-2fa", expiresIn: 300 })

    if (method === "GET") {
      if (pathname === "/api/admin/campaigns") {
        return json({
          content: [{ ...server, collectionCount: server.collections.length, updatedAt: "2026-11-20T15:30:00Z", updatedBy: null }],
          page: { size: 20, number: 0, totalElements: 1, totalPages: 1 },
        })
      }
      return readAnswers.shift()?.() ?? json(server)
    }

    const sensitive = pathname.endsWith("/publish") || (method === "PUT" && server.status === "PUBLISHED")
    if (sensitive && requireReauth && new Headers(init.headers).get("X-Reauth") !== "prova-2fa") {
      return json({ code: "reauth_required" }, 403)
    }
    const forced = writeAnswers.shift()
    if (forced) return forced()
    if (pathname.endsWith("/publish")) {
      server = { ...server, status: "PUBLISHED", phase: "SCHEDULED", version: server.version + 1 }
      return json(server)
    }
    const body = JSON.parse(String(init.body))
    server = method === "POST"
      ? { ...body, id: "novo", status: "DRAFT", phase: null, version: 0 }
      : { ...server, ...body, version: server.version + 1 }
    return json(server, method === "POST" ? 201 : 200)
  })
}

/** O endereço atual e o botão voltar do navegador. */
function Browser() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return (
    <>
      <output data-testid="search">{search}</output>
      <button type="button" onClick={() => navigate(-1)}>voltar do navegador</button>
    </>
  )
}

const renderAt = (search = "") =>
  render(
    <MemoryRouter initialEntries={[`${ROUTES.adminCampaigns}${search}`]}>
      <NoticeHost />
      <ReauthPromptHost />
      <Campaigns />
      <Browser />
    </MemoryRouter>,
  )

const address = () => screen.getByTestId("search").textContent
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement
const click = (name: string) => fireEvent.click(button(name))
const heading = () => screen.getByRole("heading", { level: 1 }).textContent
const browserBack = () => fireEvent.click(screen.getByText("voltar do navegador"))
const inDialog = async (name: string) => within(await screen.findByRole("dialog")).getByRole("button", { name })

/** Abre a edição pela lista, como a pessoa faz. */
async function openFromList() {
  renderAt()
  fireEvent.click(await screen.findByRole("button", { name: "Editar: Black Friday 2026" }))
  await screen.findByLabelText("Nome")
}

async function openForm(search = "?editar=c1") {
  renderAt(search)
  await screen.findByLabelText("Nome")
}

async function confirmPublish() {
  click("Publicar")
  fireEvent.click(await inDialog("Publicar"))
}

/** O aviso aparece antes de o React aplicar o fim do salvamento: espera a tela assentar. */
const settled = () => waitFor(() => expect(screen.queryByRole("button", { name: /^(Salvando|Publicando)/ })).toBeNull())
const nothingPending = () => waitFor(() => expect(screen.queryByText("Alterações não salvas")).toBeNull())

const originalTimeZone = process.env.TZ

beforeEach(async () => {
  localStorage.clear()
  vi.clearAllMocks()
  server = detail()
  readAnswers = []
  writeAnswers = []
  requireReauth = false
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  installApi()
  await authClient.login("dono@loja.com", "x")
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

describe("datas com o computador em outro fuso", () => {
  // diferença do computador para o UTC, em minutos, no sentido do `getTimezoneOffset`
  it.each([
    ["Asia/Tokyo", -540],
    ["America/New_York", 300],
    ["Pacific/Kiritimati", -840],
    ["UTC", 0],
  ])("em %s, mostra e grava o horário de Fortaleza", async (zone, offset) => {
    process.env.TZ = zone
    expect(new Date("2026-11-27T03:00:00Z").getTimezoneOffset()).toBe(offset) // o fuso mudou mesmo

    await openForm()
    expect(field("Início").value).toBe("2026-11-27T00:00")
    expect(field("Fim").value).toBe("2026-12-01T00:00")

    type("Fim", "2026-12-31T23:30")
    click("Salvar rascunho")

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0].body.endsAt).toBe("2027-01-01T02:30:00.000Z")
  })
})

describe("campanha nova", () => {
  it("abre vazia pelo botão da lista", async () => {
    renderAt()

    click("Nova campanha")

    expect(heading()).toBe("Nova campanha")
    expect(address()).toBe("?nova=")
    expect(field("Nome").value).toBe("")
    expect(field("Prioridade").value).toBe("0")
    expect(screen.getByText("Rascunho novo")).toBeTruthy()
    expect(detailReads()).toHaveLength(0)
  })

  it("salva o rascunho com Idempotency-Key e continua no formulário, agora editando", async () => {
    await openForm("?nova")
    type("Nome", "  Natal 2026  ")
    type("Descrição", "Fim de ano")
    type("Tipo", "CHRISTMAS")
    type("Prioridade", "20")
    type("Início", "2026-12-01T08:00")

    click("Salvar rascunho")

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rascunho salvo."))
    const [create] = writes()
    expect([create.method, create.url.pathname]).toEqual(["POST", "/api/admin/campaigns"])
    expect(create.headers.get("Idempotency-Key")).toBeTruthy()
    expect(create.body).toEqual({
      name: "Natal 2026", description: "Fim de ano", type: "CHRISTMAS", priority: 20,
      startsAt: "2026-12-01T11:00:00.000Z", endsAt: null, theme: null, content: null, collections: [],
    })
    await waitFor(() => expect(address()).toBe("?editar=novo"))
    expect(heading()).toBe("Editar campanha")
    await nothingPending()
    await settled()
    expect(field("Nome").value).toBe("Natal 2026")
    expect(detailReads()).toHaveLength(0) // a resposta da criação basta

    // o próximo salvamento é uma edição, com a versão recebida
    type("Nome", "Natal Fausto")
    click("Salvar rascunho")
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect([writes()[1].method, writes()[1].url.pathname, writes()[1].body.version]).toEqual(["PUT", "/api/admin/campaigns/novo", 0])
  })

  it("repetir depois de uma falha de rede usa a mesma Idempotency-Key", async () => {
    writeAnswers = [() => { throw new TypeError("Failed to fetch") }]
    await openForm("?nova")
    type("Nome", "Natal")

    click("Salvar rascunho")
    expect((await screen.findByRole("alert")).textContent).toContain("Não conseguimos confirmar o salvamento")
    expect(field("Nome").value).toBe("Natal")
    await settled()
    click("Salvar rascunho")

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    const [first, second] = writes().map((c) => c.headers.get("Idempotency-Key"))
    expect(second).toBe(first)
  })

  it("publicar salva o rascunho, publica com a versão recebida e volta à lista", async () => {
    requireReauth = true
    renderAt()
    click("Nova campanha")
    type("Nome", "Natal")

    await confirmPublish()
    fireEvent.change(await screen.findByLabelText("Código"), { target: { value: "123456" } })
    click("Confirmar")

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Campanha publicada."))
    expect(written()).toEqual([
      "POST /api/admin/campaigns",
      "POST /api/admin/campaigns/novo/publish", // recusada: falta o código
      "POST /api/admin/campaigns/novo/publish",
    ])
    expect(writes()[2].body).toEqual({ version: 0 })
    expect(writes()[2].headers.get("X-Reauth")).toBe("prova-2fa")
    await waitFor(() => expect(address()).toBe(""))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("sem nada preenchido, não salva nem publica", async () => {
    await openForm("?nova")

    click("Salvar rascunho")
    expect(toast.info).toHaveBeenCalledWith("Nenhuma alteração para salvar.")
    click("Publicar")

    expect(screen.getByRole("alert").textContent).toContain("Preencha os dados da campanha")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(writes()).toHaveLength(0)
  })
})

describe("edição", () => {
  it("preenche os campos e salva sem perder tema, conteúdo, coleções nem os segundos de uma data não mexida", async () => {
    await openFromList()
    expect(heading()).toBe("Editar campanha")
    expect(field("Nome").value).toBe("Black Friday 2026")
    expect(field("Descrição").value).toBe("Anotação")
    expect(field("Tipo").value).toBe("BLACK_FRIDAY")
    expect(field("Prioridade").value).toBe("10")

    type("Nome", "Black Friday Fausto")
    expect(screen.getByText("Alterações não salvas")).toBeTruthy()
    click("Salvar rascunho")

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Alterações salvas."))
    const [update] = writes()
    expect([update.method, update.url.pathname]).toEqual(["PUT", "/api/admin/campaigns/c1"])
    expect(update.body).toEqual({
      name: "Black Friday Fausto", description: "Anotação", type: "BLACK_FRIDAY", priority: 10,
      startsAt: "2026-11-27T03:00:42.123456Z", endsAt: "2026-12-01T03:00:00Z",
      theme, content, collections, version: 4,
    })
    await nothingPending()
  })

  it("apagar um campo envia vazio", async () => {
    await openForm()
    type("Nome", "")
    type("Tipo", "")
    type("Início", "")

    click("Salvar rascunho")

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0].body).toMatchObject({ name: null, type: null, startsAt: null })
  })

  it("numa campanha publicada, avisa, pede o código 2FA e não oferece publicar", async () => {
    server = detail({ status: "PUBLISHED", phase: "ACTIVE" })
    requireReauth = true
    await openForm()
    expect(screen.getByText("No ar")).toBeTruthy()
    expect(screen.getByText(/salvar pede o código do autenticador/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull()

    type("Prioridade", "50")
    click("Salvar alterações")
    fireEvent.change(await screen.findByLabelText("Código"), { target: { value: "123456" } })
    click("Confirmar")

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Alterações salvas."))
    expect(writes().at(-1)!.headers.get("X-Reauth")).toBe("prova-2fa")
  })

  it("publicar um rascunho sem alterações só publica", async () => {
    await openFromList()

    await confirmPublish()

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Campanha publicada."))
    expect(written()).toEqual(["POST /api/admin/campaigns/c1/publish"])
    expect(writes()[0].body).toEqual({ version: 4 })
  })

  it("ao publicar sem os requisitos, diz que o rascunho foi salvo e mostra o que falta", async () => {
    await openForm()
    type("Nome", "Novo nome")
    writeAnswers = [
      () => json({ ...server, name: "Novo nome", version: 5 }),
      () => json({
        code: "publish_requirements",
        fields: [
          { field: "endsAt", message: "O fim precisa ser no futuro." },
          { field: "theme.dark", message: "Defina as cores do tema escuro." },
        ],
      }, 422),
    ]

    await confirmPublish()

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("O rascunho foi salvo, mas a campanha não foi publicada. Faltam dados para publicar.")
    expect(alert.textContent).toContain("Tema escuro: Defina as cores do tema escuro.")
    expect(field("Fim").getAttribute("aria-invalid")).toBe("true")
    expect(screen.getByText("O fim precisa ser no futuro.")).toBeTruthy()
    expect(writes()[1].body).toEqual({ version: 5 })
    expect(address()).toBe("?editar=c1")
  })

  it("mostra os erros da API junto de cada campo e os limpa quando o campo muda", async () => {
    writeAnswers = [() => json({
      code: "validation_failed",
      fields: [
        { field: "name", message: "Use pelo menos 3 caracteres." },
        { field: "endsAt", message: "O fim precisa ser depois do início." },
      ],
    }, 400)]
    await openForm()
    type("Nome", "ab")

    click("Salvar rascunho")

    expect((await screen.findByRole("alert")).textContent).toContain("Há campos inválidos.")
    expect(field("Nome").getAttribute("aria-invalid")).toBe("true")
    expect(document.getElementById(field("Nome").getAttribute("aria-describedby")!)!.textContent).toBe("Use pelo menos 3 caracteres.")
    expect(screen.getByText("O fim precisa ser depois do início.")).toBeTruthy()
    type("Nome", "abc")
    expect(field("Nome").getAttribute("aria-invalid")).toBe("false")
    expect(screen.queryByText("Use pelo menos 3 caracteres.")).toBeNull()
  })

  it.each([
    ["Prioridade", "150", "Use um número inteiro de 0 a 100."],
    ["Prioridade", "1.5", "Use um número inteiro de 0 a 100."],
    // a caixa numérica devolve vazio para um texto como este: salvar 0 mudaria a prioridade sem avisar
    ["Prioridade", "50e", "Use um número inteiro de 0 a 100."],
    ["Prioridade", "", "Use um número inteiro de 0 a 100."],
    ["Fim", "2101-01-01T00:00", "Use uma data entre os anos 2000 e 2099."],
  ])("confere %s = %s antes de enviar", async (label, value, message) => {
    await openForm()
    type(label, value)

    click("Salvar rascunho")

    expect(screen.getByText(message)).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it("mostra o conflito de período com a mensagem da API e mantém o que foi digitado", async () => {
    writeAnswers = [() => json({ code: "campaign_conflict", message: "O período se sobrepõe ao da campanha \"Natal\"." }, 409)]
    await openForm()
    type("Nome", "Outro")

    click("Salvar rascunho")

    expect((await screen.findByRole("alert")).textContent).toContain("sobrepõe ao da campanha \"Natal\"")
    await settled()
    expect(field("Nome").value).toBe("Outro")
    expect(button("Salvar rascunho").disabled).toBe(false)
  })

  it("em edição concorrente, não sobrescreve: bloqueia o salvamento até carregar a versão atual", async () => {
    writeAnswers = [() => json({ code: "version_conflict" }, 409)]
    await openForm()
    type("Nome", "Meu nome")

    click("Salvar rascunho")

    expect((await screen.findByRole("alert")).textContent).toContain("alterada por outra operação")
    await settled()
    expect(field("Nome").value).toBe("Meu nome")
    expect(button("Salvar rascunho").disabled).toBe(true)
    expect(button("Publicar").disabled).toBe(true)
    server = detail({ name: "Nome de outra pessoa", version: 9 })
    click("Carregar a versão atual (descarta o que você digitou)")

    await waitFor(() => expect(field("Nome").value).toBe("Nome de outra pessoa"))
    expect(screen.queryByRole("alert")).toBeNull()
    type("Nome", "Agora sim")
    click("Salvar rascunho")
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()[1].body.version).toBe(9)
  })

  it.each([
    ["encerrada", { status: "PUBLISHED", phase: "EXPIRED" }],
    ["arquivada", { status: "ARCHIVED", phase: null }],
  ] as const)("uma campanha %s aberta pelo endereço não pode ser editada", async (word, state) => {
    server = detail(state)
    renderAt("?editar=c1")

    expect(await screen.findByText(`Uma campanha ${word} não pode ser editada. Para repeti-la, duplique na lista.`)).toBeTruthy()
    expect(screen.queryByLabelText("Nome")).toBeNull()
    expect(writes()).toHaveLength(0)
  })

  it("campanha que não existe: avisa e volta à lista", async () => {
    readAnswers = [() => json({ code: "not_found" }, 404)]
    renderAt("?editar=sumiu")
    await screen.findByText("Essa campanha não existe mais.")

    fireEvent.click(screen.getAllByRole("button", { name: "Voltar à lista" }).at(-1)!)

    expect(await screen.findByRole("button", { name: "Editar: Black Friday 2026" })).toBeTruthy()
    expect(address()).toBe("")
  })

  it.each([
    ["a API falha", () => json({}, 500)],
    ["a resposta vem sem as coleções (salvar apagaria)", () => json({ ...detail(), collections: undefined })],
    ["a resposta vem sem o tema (salvar apagaria)", () => json({ ...detail(), theme: undefined })],
  ])("quando %s, não abre o formulário e permite tentar de novo", async (_, answer) => {
    readAnswers = [answer]
    renderAt("?editar=c1")
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeTruthy()
    expect(screen.queryByLabelText("Nome")).toBeNull()

    click("Tentar novamente")

    expect(await screen.findByLabelText("Nome")).toBeTruthy()
  })
})

describe("alterações não salvas", () => {
  it("sem mudanças, sai direto, e a lista mantém os filtros", async () => {
    renderAt()
    await screen.findByRole("button", { name: "Editar: Black Friday 2026" })
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "DRAFT" } })
    await waitFor(() => expect(calls().at(-1)!.url.searchParams.get("status")).toBe("DRAFT"))
    fireEvent.click(await screen.findByRole("button", { name: "Editar: Black Friday 2026" }))
    await screen.findByLabelText("Nome")

    click("Cancelar")

    await screen.findByRole("button", { name: "Editar: Black Friday 2026" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect((screen.getByLabelText("Situação") as HTMLSelectElement).value).toBe("DRAFT")
  })

  it.each([
    ["o botão Cancelar", () => click("Cancelar")],
    ["a seta do cabeçalho", () => click("Voltar à lista")],
    ["o voltar do navegador", browserBack],
  ])("com mudanças, %s pergunta antes; “Continuar editando” mantém tudo", async (_, leave) => {
    await openFromList()
    type("Nome", "Rascunho em andamento")

    leave()
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("Descartar alterações?")
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar editando" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(field("Nome").value).toBe("Rascunho em andamento")
    expect(address()).toBe("?editar=c1")
    expect(detailReads()).toHaveLength(1) // o formulário não foi recarregado

    leave() // e continua perguntando na próxima vez
    fireEvent.click(await inDialog("Descartar"))
    await screen.findByRole("button", { name: "Editar: Black Friday 2026" })
    expect(address()).toBe("")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("num rascunho recém-criado, voltar com mudanças também pergunta e mantém o formulário", async () => {
    renderAt()
    click("Nova campanha")
    type("Nome", "Natal")
    click("Salvar rascunho")
    await waitFor(() => expect(address()).toBe("?editar=novo"))
    await nothingPending()
    await settled()
    type("Nome", "Natal 2026")

    browserBack()
    fireEvent.click(await inDialog("Continuar editando"))

    await waitFor(() => expect(address()).toBe("?editar=novo"))
    expect(field("Nome").value).toBe("Natal 2026")
    expect(detailReads()).toHaveLength(0)
  })

  it("fechar ou recarregar a aba pede confirmação só quando há mudanças", async () => {
    await openForm()
    const unload = () => !window.dispatchEvent(new Event("beforeunload", { cancelable: true }))
    expect(unload()).toBe(false)

    type("Nome", "Mudou")
    expect(unload()).toBe(true)

    click("Salvar rascunho")
    await waitFor(() => expect(unload()).toBe(false))
  })
})

describe("salvamento ou publicação em andamento", () => {
  /** A próxima escrita só responde quando o teste mandar. */
  function holdNextWrite() {
    let finish!: (res: Response) => void
    writeAnswers.push(() => new Promise<Response>((resolve) => { finish = resolve }))
    return (res: Response) => finish(res)
  }
  const savedDraft = () => json(detail({ name: "Natal", version: 5 }))

  /** Abre a edição, muda o nome e confirma a publicação, com o salvamento ainda sem resposta. */
  async function startPublishing() {
    const finish = holdNextWrite()
    await openFromList()
    type("Nome", "Natal")
    await confirmPublish()
    await waitFor(() => expect(writes()).toHaveLength(1))
    return finish
  }

  it("bloqueia Cancelar e a seta, e o navegador pergunta antes de fechar a aba", async () => {
    const finish = await startPublishing()

    expect(button("Cancelar").disabled).toBe(true)
    expect(button("Voltar à lista").disabled).toBe(true)
    expect(!window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true)

    finish(savedDraft())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Campanha publicada."))
    await waitFor(() => expect(address()).toBe(""))
  })

  it("segura o voltar do navegador, sem oferecer descarte, e termina a publicação", async () => {
    const finish = await startPublishing()

    browserBack()

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Aguarde o salvamento terminar para sair."))
    await waitFor(() => expect(address()).toBe("?editar=c1"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(field("Nome").value).toBe("Natal")
    finish(savedDraft())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Campanha publicada."))
    await waitFor(() => expect(address()).toBe(""))
    expect(written()).toEqual(["PUT /api/admin/campaigns/c1", "POST /api/admin/campaigns/c1/publish"])
  })

  it("segura o voltar também numa campanha nova, e o motivo de uma recusa continua na tela", async () => {
    const finish = holdNextWrite()
    writeAnswers.push(() => json({ code: "publish_requirements", fields: [] }, 422))
    renderAt()
    click("Nova campanha")
    type("Nome", "Natal")
    await confirmPublish()
    await waitFor(() => expect(writes()).toHaveLength(1))

    browserBack()
    await waitFor(() => expect(address()).toBe("?nova="))
    finish(json(detail({ id: "novo", name: "Natal", version: 0 }), 201))

    expect((await screen.findByRole("alert")).textContent).toContain("a campanha não foi publicada")
    await waitFor(() => expect(address()).toBe("?editar=novo"))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  /** Uma saída que o formulário não tem como segurar: outra rota do app (ou a sessão que cai). */
  function renderWithPanel() {
    function Leave() {
      const navigate = useNavigate()
      return <button type="button" onClick={() => navigate(ROUTES.admin)}>ir ao painel</button>
    }
    render(
      <MemoryRouter initialEntries={[`${ROUTES.adminCampaigns}?editar=c1`]}>
        <Routes>
          <Route path={ROUTES.adminCampaigns} element={<Campaigns />} />
          <Route path={ROUTES.admin} element={<div data-testid="admin-panel">painel</div>} />
        </Routes>
        <Leave />
      </MemoryRouter>,
    )
  }

  it("se a tela for fechada por outro caminho, não publica e avisa", async () => {
    const finish = holdNextWrite()
    renderWithPanel()
    await screen.findByLabelText("Nome")
    type("Nome", "Natal")
    await confirmPublish()
    await waitFor(() => expect(writes()).toHaveLength(1))

    click("ir ao painel")
    await screen.findByTestId("admin-panel")
    finish(savedDraft())

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("O rascunho foi salvo, mas a campanha não foi publicada."))
    expect(written()).toEqual(["PUT /api/admin/campaigns/c1"])
    expect(screen.getByTestId("admin-panel")).toBeTruthy()
  })

  it("se a tela for fechada por outro caminho, uma recusa vira aviso em vez de se perder", async () => {
    const finish = holdNextWrite()
    renderWithPanel()
    await screen.findByLabelText("Nome")
    type("Nome", "Natal")
    click("Salvar rascunho")
    await waitFor(() => expect(writes()).toHaveLength(1))

    click("ir ao painel")
    finish(json({ code: "campaign_conflict", message: "O período se sobrepõe ao de outra campanha." }, 409))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("O período se sobrepõe ao de outra campanha."))
  })
})
