// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Swal from "sweetalert2"
import { AdminUsers } from "./AdminUsers"
import { authClient } from "@/lib/auth"

// A confirmação (Swal) e o pedido de código 2FA (sensitiveFetch) têm testes próprios: aqui o foco é a tela.
vi.mock("sweetalert2", () => ({ default: { fire: vi.fn(async () => ({ isConfirmed: true })) } }))
vi.mock("@/admin/sensitive", async () => {
  const { authClient: client } = await import("@/lib/auth")
  return {
    sensitiveFetch: (url: string, init?: RequestInit) => client.fetch(url, init),
    SENSITIVE_NOT_DONE: "A confirmação de identidade não foi concluída. Nada foi alterado.",
  }
})

interface Account { id: string; email: string; role: "ADMIN" | "USER"; active: boolean; mfaEnabled: boolean }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const account = (email: string, extra: Partial<Account> = {}): Account =>
  ({ id: `id-${email}`, email, role: "ADMIN", active: true, mfaEnabled: true, ...extra })

let fetchMock: ReturnType<typeof vi.fn>
let accounts: Account[]
/** Resposta forçada para a próxima chamada de escrita (simula 403/409 da API). */
let writeResponse: (() => Response) | null

const writes = () =>
  fetchMock.mock.calls
    .map(([url, init]) => ({ url: String(url), init: (init ?? {}) as RequestInit }))
    .filter(({ url, init }) => url.includes("/api/user") && init.method && init.method !== "GET")

function installApi() {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/auth/me") return json({ email: "dono@loja.com", role: "ADMIN" })
    if (path === "/api/user" && (!init.method || init.method === "GET")) return json(accounts)
    if (writeResponse) {
      const forced = writeResponse
      writeResponse = null
      return forced()
    }
    if (path === "/api/user" && init.method === "POST") {
      const { email } = JSON.parse(String(init.body))
      accounts.push(account(email, { mfaEnabled: false }))
      return json({ id: `id-${email}`, email, temporaryPassword: "Xk7mP2qR9tLw4vNz8Bcd", enrollmentExpiresAt: "2026-03-02T12:00:00Z" }, 201)
    }
    if (path.endsWith("/active")) {
      const target = accounts.find((a) => path.includes(a.id))!
      target.active = JSON.parse(String(init.body)).active
      return json(target)
    }
    if (path.endsWith("/reset-credentials")) {
      return json({ id: "x", email: "x", temporaryPassword: "Zz9yX8wV7uTs6rQq5pOn", enrollmentExpiresAt: "2026-03-02T12:00:00Z" })
    }
    if (init.method === "DELETE") {
      accounts = accounts.filter((a) => !path.includes(a.id))
      return json({ message: "ok" })
    }
    throw new Error(`rota inesperada: ${init.method ?? "GET"} ${path}`)
  })
}

const renderPage = async () => {
  render(<MemoryRouter><AdminUsers /></MemoryRouter>)
  await screen.findByTestId("account-dono@loja.com")
}
const row = (email: string) => screen.getByTestId(`account-${email}`)
const rowButton = (email: string, name: RegExp) => within(row(email)).getByRole("button", { name }) as HTMLButtonElement

beforeEach(async () => {
  localStorage.clear()
  writeResponse = null
  accounts = [account("dono@loja.com"), account("ana@loja.com"), account("pendente@loja.com", { mfaEnabled: false })]
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  vi.mocked(Swal.fire).mockClear()
  vi.mocked(Swal.fire).mockResolvedValue({ isConfirmed: true } as never)
  installApi()
  await authClient.login("dono@loja.com", "x") // o perfil define qual linha é "você"
  await authClient.loadProfile()
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("lista de administradores", () => {
  it("mostra cada conta com situação e 2FA, em ordem alfabética, e marca a sua", async () => {
    accounts.push(account("antiga@loja.com", { active: false }))
    await renderPage()

    const emails = screen.getAllByTestId(/^account-/).map((el) => el.getAttribute("data-testid")!.replace("account-", ""))
    expect(emails).toEqual(["ana@loja.com", "antiga@loja.com", "dono@loja.com", "pendente@loja.com"])
    expect(within(row("dono@loja.com")).getByText("(você)")).toBeTruthy()
    expect(within(row("antiga@loja.com")).getByText("Desativado")).toBeTruthy()
    expect(within(row("pendente@loja.com")).getByText("Aguardando cadastro")).toBeTruthy()
    expect(within(row("ana@loja.com")).getByText("Configurado")).toBeTruthy()
  })

  it("não deixa agir sobre a PRÓPRIA conta", async () => {
    await renderPage()

    expect(rowButton("dono@loja.com", /desativar/i).disabled).toBe(true)
    expect(rowButton("dono@loja.com", /redefinir/i).disabled).toBe(true)
    expect(rowButton("dono@loja.com", /excluir/i).disabled).toBe(true)
    expect(rowButton("ana@loja.com", /desativar/i).disabled).toBe(false)
  })

  it("protege o último administrador ativo (desativar/excluir ficam bloqueados)", async () => {
    accounts = [account("dono@loja.com"), account("unica@loja.com", { id: "so-ela" }), account("off@loja.com", { active: false })]
    accounts[0].active = false // só "unica" está ativa
    render(<MemoryRouter><AdminUsers /></MemoryRouter>)
    await screen.findByTestId("account-unica@loja.com")

    expect(rowButton("unica@loja.com", /desativar/i).disabled).toBe(true)
    expect(rowButton("unica@loja.com", /excluir/i).disabled).toBe(true)
    expect(rowButton("off@loja.com", /reativar/i).disabled).toBe(false)
  })

  it("falha ao carregar: aviso com 'Tentar novamente'", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/auth/me")) return json({ email: "dono@loja.com", role: "ADMIN" })
      return json({}, 500)
    })
    render(<MemoryRouter><AdminUsers /></MemoryRouter>)

    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar")
    installApi()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(await screen.findByTestId("account-ana@loja.com")).toBeTruthy()
  })
})

describe("criar administrador", () => {
  const openDialog = async () => {
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: /novo administrador/i }))
    return screen.findByRole("dialog")
  }

  it("envia só o e-mail, mostra a senha temporária UMA vez e a descarta ao fechar", async () => {
    const dialog = await openDialog()
    fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: " nova@loja.com " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar conta" }))

    expect((await screen.findByTestId("temporary-password")).textContent).toBe("Xk7mP2qR9tLw4vNz8Bcd")
    expect(screen.getByText("Conta criada")).toBeTruthy()
    expect(screen.getByText(/não será mostrada de novo/i)).toBeTruthy()

    const [post] = writes()
    expect(post.init.method).toBe("POST")
    expect(JSON.parse(String(post.init.body))).toEqual({ email: "nova@loja.com" }) // nunca uma senha escolhida
    expect(await screen.findByTestId("account-nova@loja.com")).toBeTruthy()      // a lista foi atualizada

    fireEvent.click(screen.getByRole("button", { name: "Já entreguei a senha" }))
    await waitFor(() => expect(screen.queryByTestId("temporary-password")).toBeNull())
    expect(document.body.textContent).not.toContain("Xk7mP2qR9tLw4vNz8Bcd")
  })

  it("e-mail já cadastrado: explica em português e não mostra senha", async () => {
    const dialog = await openDialog()
    writeResponse = () => json({ message: "Email already registered" }, 409)
    fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: "ana@loja.com" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar conta" }))

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Já existe uma conta com esse e-mail.")
    expect(screen.queryByTestId("temporary-password")).toBeNull()
  })

  it("e-mail inválido: mensagem clara", async () => {
    const dialog = await openDialog()
    writeResponse = () => json({ message: "Email is invalid!" }, 400)
    fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: "isso-nao-e-email@x" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar conta" }))

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Informe um e-mail válido.")
  })

  it("confirmação de identidade não concluída (403): nada é criado e a tela avisa", async () => {
    const dialog = await openDialog()
    writeResponse = () => json({ code: "reauth_required" }, 403)
    fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: "nova@loja.com" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar conta" }))

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Nada foi alterado")
    expect(screen.queryByTestId("account-nova@loja.com")).toBeNull()
  })
})

describe("desativar, redefinir e excluir", () => {
  it("desativar: pede confirmação, chama PATCH {active:false} e atualiza a lista", async () => {
    await renderPage()

    fireEvent.click(rowButton("ana@loja.com", /desativar/i))

    await waitFor(() => expect(within(row("ana@loja.com")).getByText("Desativado")).toBeTruthy())
    expect(vi.mocked(Swal.fire)).toHaveBeenCalledWith(expect.objectContaining({ title: "Desativar conta?", showCancelButton: true }))
    const [patch] = writes()
    expect(patch.url).toContain("/api/user/id-ana@loja.com/active")
    expect(patch.init.method).toBe("PATCH")
    expect(JSON.parse(String(patch.init.body))).toEqual({ active: false })
    expect(screen.getByRole("status").textContent).toBe("Conta desativada.")
  })

  it("se a pessoa cancelar a confirmação, NADA é enviado", async () => {
    vi.mocked(Swal.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    await renderPage()

    fireEvent.click(rowButton("ana@loja.com", /desativar/i))

    await waitFor(() => expect(vi.mocked(Swal.fire)).toHaveBeenCalled())
    expect(writes()).toHaveLength(0)
  })

  it("reativar uma conta desativada", async () => {
    accounts.push(account("off@loja.com", { active: false }))
    await renderPage()

    fireEvent.click(rowButton("off@loja.com", /reativar/i))

    await waitFor(() => expect(within(row("off@loja.com")).getByText("Ativo")).toBeTruthy())
    expect(JSON.parse(String(writes()[0].init.body))).toEqual({ active: true })
  })

  it("redefinir credenciais: mostra a nova senha temporária uma vez", async () => {
    await renderPage()

    fireEvent.click(rowButton("ana@loja.com", /redefinir/i))

    expect((await screen.findByTestId("temporary-password")).textContent).toBe("Zz9yX8wV7uTs6rQq5pOn")
    expect(screen.getByText("Credenciais redefinidas")).toBeTruthy()
    expect(writes()[0].url).toContain("/api/user/id-ana@loja.com/reset-credentials")
    expect(writes()[0].init.method).toBe("POST")
  })

  it("excluir: DELETE e a conta some da lista", async () => {
    await renderPage()

    fireEvent.click(rowButton("pendente@loja.com", /excluir/i))

    await waitFor(() => expect(screen.queryByTestId("account-pendente@loja.com")).toBeNull())
    expect(writes()[0].init.method).toBe("DELETE")
  })

  it("a API recusa (ex.: último administrador): mostra a explicação em português", async () => {
    await renderPage()
    writeResponse = () => json({ message: "Cannot remove the last active administrator" }, 409)

    fireEvent.click(rowButton("ana@loja.com", /excluir/i))

    expect((await screen.findByRole("alert")).textContent).toBe("Não é possível remover nem desativar o último administrador ativo.")
    expect(screen.getByTestId("account-ana@loja.com")).toBeTruthy() // nada mudou
  })

  it("sem rede: aviso de conexão", async () => {
    await renderPage()
    writeResponse = () => { throw new TypeError("Failed to fetch") }

    fireEvent.click(rowButton("ana@loja.com", /desativar/i))

    expect((await screen.findByRole("alert")).textContent).toContain("conectar")
  })
})
