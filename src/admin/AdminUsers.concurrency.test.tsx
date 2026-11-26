// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AdminUsers } from "./AdminUsers"
import { authClient } from "@/lib/auth"

vi.mock("@/admin/sensitive", async () => {
  const { authClient: client } = await import("@/lib/auth")
  return {
    sensitiveFetch: (url: string, init?: RequestInit) => client.fetch(url, init),
    SENSITIVE_NOT_DONE: "A confirmação de identidade não foi concluída. Nada foi alterado.",
  }
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const account = (email: string) =>
  ({ id: `id-${email}`, email, role: "ADMIN", active: true, mfaEnabled: true, version: 4 })

let fetchMock: ReturnType<typeof vi.fn>
let answerWrite: () => Promise<Response> | Response

const requests = (method: string) =>
  fetchMock.mock.calls
    .map(([url, init]) => ({ url: String(url), init: (init ?? {}) as RequestInit }))
    .filter(({ url, init }) => url.includes("/api/user") && (init.method ?? "GET") === method)
const keyOf = (request: { init: RequestInit }) => new Headers(request.init.headers).get("Idempotency-Key")

const renderPage = async () => {
  render(<MemoryRouter><AdminUsers /></MemoryRouter>)
  await screen.findByTestId("account-ana@loja.com")
}

beforeEach(async () => {
  localStorage.clear()
  answerWrite = () => json({ message: "ok" })
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/auth/me") return json({ email: "dono@loja.com", role: "ADMIN" })
    if (path === "/api/user" && (!init.method || init.method === "GET")) {
      return json([account("dono@loja.com"), account("ana@loja.com")])
    }
    return answerWrite()
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  await authClient.login("dono@loja.com", "x")
  await authClient.loadProfile()
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("contas sob concorrência", () => {
  it("desativar envia a versão; no conflito avisa e recarrega a lista", async () => {
    answerWrite = () => json({ code: "version_conflict", message: "alterado" }, 409)
    await renderPage()
    const listed = requests("GET").length

    fireEvent.click(within(screen.getByTestId("account-ana@loja.com")).getByRole("button", { name: /desativar/i }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desativar" }))

    expect((await screen.findByText(/alterada por outra operação/i))).toBeTruthy()
    expect(JSON.parse(String(requests("PATCH")[0].init.body))).toEqual({ active: false, version: 4 })
    await waitFor(() => expect(requests("GET").length).toBeGreaterThan(listed))
  })

  it("criar: tentar de novo sem resposta repete a chave, e a repetição não mostra senha", async () => {
    answerWrite = () => Promise.reject(new TypeError("sem rede"))
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: /novo administrador/i }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: "nova@loja.com" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar conta" }))
    await within(dialog).findByRole("alert")

    // a primeira tentativa tinha dado certo: a API repete a resposta, sem a senha
    answerWrite = () => json({ id: "n", email: "nova@loja.com", temporaryPassword: null, enrollmentExpiresAt: null }, 201)
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar conta" }))

    expect(await screen.findByText(/senha temporária só aparece uma vez/i)).toBeTruthy()
    expect(screen.queryByTestId("temporary-password")).toBeNull()
    expect(requests("POST")).toHaveLength(2)
    expect(keyOf(requests("POST")[1])).toBe(keyOf(requests("POST")[0]))
  })

  it("redefinir credenciais usa uma chave nova a cada vez", async () => {
    answerWrite = () => json({ id: "x", email: "ana@loja.com", temporaryPassword: "Zz9yX8wV7uTs6rQq5pOn", enrollmentExpiresAt: null })
    await renderPage()
    const reset = async () => {
      fireEvent.click(within(screen.getByTestId("account-ana@loja.com")).getByRole("button", { name: /redefinir/i }))
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Redefinir" }))
      await screen.findByTestId("temporary-password")
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    }

    await reset()
    await reset()

    expect(keyOf(requests("POST")[0])).toBeTruthy()
    expect(keyOf(requests("POST")[1])).not.toBe(keyOf(requests("POST")[0]))
  })
})
