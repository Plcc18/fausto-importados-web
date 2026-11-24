// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { Login } from "./Login"
import { authClient } from "@/lib/auth"

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,QR") } }))

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers })

const SESSION = { accessToken: "access-1", expiresIn: 900 }
let fetchMock: ReturnType<typeof vi.fn>
let role: "ADMIN" | "USER"

/** Servidor falso do fluxo de login. Cada cenário muda só o que precisa pelo `scenario`. */
const scenario: Record<string, (body: Record<string, string>) => Response> = {}

function installServer() {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    const body = init.body ? JSON.parse(String(init.body)) : {}
    const handler = scenario[path]
    if (handler) return handler(body)
    if (path === "/auth/me") return json({ email: "pessoa@x.com", role })
    throw new Error(`rota inesperada: ${path}`)
  })
}

function Where() {
  const { pathname, search } = useLocation()
  return <div data-testid="where">{pathname + search}</div>
}

const renderLogin = (url = "/entrar") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/entrar" element={<Login />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }))
const submitPassword = (email = "pessoa@x.com") => {
  type("E-mail", email)
  type("Senha", "senha-qualquer")
  click("Entrar")
}

beforeEach(() => {
  localStorage.clear()
  role = "ADMIN"
  for (const key of Object.keys(scenario)) delete scenario[key]
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  installServer()
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("Login — senha", () => {
  it("é uma tela genérica: nada fala em 'admin' ou 'painel'", () => {
    renderLogin()

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/admin|painel/i)
  })

  it("credenciais erradas: mensagem única (não diz se foi o e-mail ou a senha) e a senha é limpa", async () => {
    scenario["/auth/login"] = () => json({ message: "Invalid email or password" }, 401)
    renderLogin()

    submitPassword()

    expect((await screen.findByRole("alert")).textContent).toBe("E-mail ou senha incorretos.")
    expect((screen.getByLabelText("Senha") as HTMLInputElement).value).toBe("")
    expect(authClient.hasSession()).toBe(false)
  })

  it("muitas tentativas: informa quanto esperar", async () => {
    scenario["/auth/login"] = () => json({ message: "Too many attempts" }, 429, { "Retry-After": "300" })
    renderLogin()

    submitPassword()

    expect((await screen.findByRole("alert")).textContent).toContain("5 minutos")
  })

  it("sem rede: aviso de conexão (e não 'senha incorreta')", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    renderLogin()

    submitPassword()

    expect((await screen.findByRole("alert")).textContent).toContain("conectar")
  })
})

describe("Login — destino depois de entrar", () => {
  beforeEach(() => {
    scenario["/auth/login"] = () => json({ status: "AUTHENTICATED", ...SESSION })
  })

  it("cliente vai para a loja; administrador vai para o painel", async () => {
    role = "USER"
    const first = renderLogin()
    submitPassword()
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"))
    first.unmount()
    authClient.dispose()

    role = "ADMIN"
    renderLogin()
    submitPassword()
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin"))
  })

  it("volta para onde a pessoa queria ir (?next=)", async () => {
    renderLogin("/entrar?next=%2Fadmin%2Frelatorio")

    submitPassword()

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/relatorio"))
  })

  it("ignora um ?next= que leva para fora do site (redirecionamento aberto)", async () => {
    role = "USER"
    renderLogin("/entrar?next=https%3A%2F%2Fevil.example")

    submitPassword()

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"))
  })
})

describe("Login — segundo fator (administrador com 2FA)", () => {
  beforeEach(() => {
    scenario["/auth/login"] = () => json({ status: "MFA_REQUIRED", challenge: "ch-1" })
    scenario["/auth/login/mfa"] = (body) =>
      body.code === "123456" || body.code === "AAAA-BBBB-CCCC-DDDD"
        ? json({ status: "AUTHENTICATED", ...SESSION })
        : body.challenge === "ch-old"
          ? json({ message: "Invalid or expired challenge" }, 401)
          : json({ message: "Invalid verification code" }, 401)
  })

  it("a senha leva ao passo do código; o código certo entra e vai ao painel", async () => {
    renderLogin("/entrar?next=%2Fadmin")

    submitPassword()
    expect(await screen.findByRole("heading", { name: "Verificação em duas etapas" })).toBeTruthy()
    expect(authClient.hasSession()).toBe(false) // a senha sozinha não abre a sessão

    type("Código do autenticador", "123456")
    click("Verificar")

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin"))
    expect(authClient.hasSession()).toBe(true)
  })

  it("código errado: mensagem e campo limpo, sem sair do passo", async () => {
    renderLogin()
    submitPassword()
    await screen.findByRole("heading", { name: "Verificação em duas etapas" })

    type("Código do autenticador", "000000")
    click("Verificar")

    expect((await screen.findByRole("alert")).textContent).toContain("Código inválido")
    expect((screen.getByLabelText("Código do autenticador") as HTMLInputElement).value).toBe("")
    expect(authClient.hasSession()).toBe(false)
  })

  it("permite trocar para um código de recuperação", async () => {
    renderLogin()
    submitPassword()
    await screen.findByRole("heading", { name: "Verificação em duas etapas" })

    click("Usar um código de recuperação")
    type("Código de recuperação", "AAAA-BBBB-CCCC-DDDD")
    click("Verificar")

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin"))
  })

  it("desafio expirado: volta para a senha com um aviso", async () => {
    scenario["/auth/login"] = () => json({ status: "MFA_REQUIRED", challenge: "ch-old" })
    renderLogin()
    submitPassword()
    await screen.findByRole("heading", { name: "Verificação em duas etapas" })

    type("Código do autenticador", "000000")
    click("Verificar")

    expect((await screen.findByRole("alert")).textContent).toContain("expirou")
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeTruthy()
  })
})

describe("Login — primeiro acesso (cadastro do autenticador)", () => {
  const CODES = Array.from({ length: 10 }, (_, i) => `ABCD-EFGH-JKLM-NP0${i}`)

  beforeEach(() => {
    scenario["/auth/login"] = () => json({ status: "MFA_SETUP_REQUIRED", challenge: "ch-setup", passwordChangeRequired: true })
    scenario["/auth/mfa/setup"] = () => json({ secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/Fausto:x?secret=JBSWY3DPEHPK3PXP" })
    scenario["/auth/mfa/setup/confirm"] = (body) =>
      body.code !== "123456"
        ? json({ message: "Invalid verification code" }, 401)
        : body.newPassword && body.newPassword.length < 12
          ? json({ message: "Password must have at least 12 characters" }, 400)
          : json({ status: "AUTHENTICATED", ...SESSION, recoveryCodes: CODES })
  })

  it("mostra o QR code (desenhado no navegador) e a chave manual formatada", async () => {
    renderLogin()
    submitPassword()

    expect(await screen.findByRole("heading", { name: "Proteja sua conta" })).toBeTruthy()
    const qr = (await screen.findByAltText("QR code para o aplicativo autenticador")) as HTMLImageElement
    expect(qr.src).toBe("data:image/png;base64,QR")
    expect(screen.getByTestId("manual-key").textContent).toBe("JBSW Y3DP EHPK 3PXP")
    // nenhuma chamada a serviço externo: só a API
    expect(fetchMock.mock.calls.every(([u]) => !String(u).startsWith("http") || String(u).includes("localhost"))).toBe(true)
  })

  it("conta com senha temporária: exige senha nova forte e confirmada antes de chamar a API", async () => {
    renderLogin()
    submitPassword()
    await screen.findByAltText("QR code para o aplicativo autenticador")

    type("Código do autenticador", "123456")
    type("Nova senha", "curta")
    type("Repita a nova senha", "curta")
    click("Confirmar e entrar")
    expect((await screen.findByRole("alert")).textContent).toContain("pelo menos 12 caracteres")

    type("Nova senha", "uma-senha-bem-longa")
    type("Repita a nova senha", "outra-diferente-aqui")
    click("Confirmar e entrar")
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("As senhas não conferem."))
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/setup/confirm"))).toBe(false)
  })

  it("conclui: mostra os 10 códigos de recuperação e só segue depois de a pessoa confirmar que os guardou", async () => {
    renderLogin("/entrar?next=%2Fadmin")
    submitPassword()
    await screen.findByAltText("QR code para o aplicativo autenticador")

    type("Código do autenticador", "123456")
    type("Nova senha", "uma-senha-bem-longa")
    type("Repita a nova senha", "uma-senha-bem-longa")
    click("Confirmar e entrar")

    expect(await screen.findByRole("heading", { name: "Guarde seus códigos de recuperação" })).toBeTruthy()
    expect(screen.getByTestId("recovery-codes").querySelectorAll("li")).toHaveLength(10)
    expect(authClient.hasSession()).toBe(true) // a sessão já abriu, mas a tela espera a confirmação

    const proceed = screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement
    expect(proceed.disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox", { name: /guardei meus códigos/i }))
    expect(proceed.disabled).toBe(false)
    fireEvent.click(proceed)

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin"))
  })

  it("código do cadastro errado: mensagem e nenhuma sessão", async () => {
    renderLogin()
    submitPassword()
    await screen.findByAltText("QR code para o aplicativo autenticador")

    type("Código do autenticador", "000000")
    type("Nova senha", "uma-senha-bem-longa")
    type("Repita a nova senha", "uma-senha-bem-longa")
    click("Confirmar e entrar")

    expect((await screen.findByRole("alert")).textContent).toContain("Código inválido")
    expect(authClient.hasSession()).toBe(false)
  })

  it("se o QR code falhar a chave manual continua disponível", async () => {
    const qrcode = await import("qrcode")
    vi.mocked(qrcode.default.toDataURL as unknown as () => Promise<string>).mockRejectedValueOnce(new Error("sem canvas"))
    renderLogin()

    submitPassword()

    expect(await screen.findByTestId("manual-key")).toBeTruthy()
    expect(screen.queryByAltText("QR code para o aplicativo autenticador")).toBeNull()
  })
})
