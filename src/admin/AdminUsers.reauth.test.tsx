// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AdminUsers } from "./AdminUsers"
import { ReauthPromptHost } from "./ReauthPromptHost"
import { authClient } from "@/lib/auth"

/**
 * Fluxo REAL de reautenticação (sem mock de `sensitiveFetch`): criar um administrador abre o diálogo "Novo
 * administrador", a API pede confirmação (403 reauth_required) e o pedido de código aparece POR CIMA dele.
 * Era aqui que o popup antigo (SweetAlert2) não aceitava digitação: o diálogo de baixo prendia o foco.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

let fetchMock: ReturnType<typeof vi.fn>
let reauthCalls: string[]
let createHeaders: (string | null)[]

function installApi() {
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, "http://localhost").pathname
    const method = init.method ?? "GET"
    if (path === "/auth/login") return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    if (path === "/auth/me") return json({ email: "dono@loja.com", role: "ADMIN" })
    if (path === "/auth/reauth") {
      const { code } = JSON.parse(String(init.body))
      reauthCalls.push(code)
      return code === "123456" ? json({ reauthToken: "proof-1", expiresIn: 300 }) : json({ code: "invalid_code" }, 403)
    }
    if (path === "/api/user" && method === "GET") {
      return json([{ id: "1", email: "dono@loja.com", role: "ADMIN", active: true, mfaEnabled: true }])
    }
    if (path === "/api/user" && method === "POST") {
      const proof = new Headers(init.headers).get("X-Reauth")
      createHeaders.push(proof)
      if (proof !== "proof-1") return json({ code: "reauth_required" }, 403)
      return json({ id: "2", email: "nova@loja.com", temporaryPassword: "Xk7mP2qR9tLw4vNz8Bcd", enrollmentExpiresAt: null }, 201)
    }
    throw new Error(`rota inesperada: ${method} ${path}`)
  })
}

const submitNewAdmin = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /novo administrador/i }))
  const form = await screen.findByRole("dialog")
  fireEvent.change(within(form).getByLabelText("E-mail"), { target: { value: "nova@loja.com" } })
  fireEvent.click(within(form).getByRole("button", { name: "Criar conta" }))
}

beforeEach(async () => {
  localStorage.clear()
  reauthCalls = []
  createHeaders = []
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null,
  }))
  installApi()
  await authClient.login("dono@loja.com", "x")
  await authClient.loadProfile()
  render(
    <MemoryRouter>
      <ReauthPromptHost />
      <AdminUsers />
    </MemoryRouter>,
  )
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("criar administrador com confirmação por código 2FA", () => {
  it("o pedido de código aparece por cima do diálogo aberto, aceita digitação e conclui a criação", async () => {
    await submitNewAdmin()

    // o pedido de código é o diálogo ativo (o de baixo fica inerte, como todo diálogo empilhado do Radix)
    const prompt = await screen.findByRole("dialog", { name: /confirme sua identidade/i })
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    const input = within(prompt).getByLabelText("Código") as HTMLInputElement
    expect(document.activeElement).toBe(input)

    fireEvent.change(input, { target: { value: "123456" } })
    expect(input.value).toBe("123456") // dá para digitar
    fireEvent.click(within(prompt).getByRole("button", { name: "Confirmar" }))

    expect((await screen.findByTestId("temporary-password")).textContent).toBe("Xk7mP2qR9tLw4vNz8Bcd")
    expect(reauthCalls).toEqual(["123456"])
    expect(createHeaders).toEqual([null, "proof-1"]) // tentou sem prova, depois com a prova recém-obtida
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /confirme sua identidade/i })).toBeNull())
  })

  it("código errado: o pedido reaparece com o aviso e aceita um novo código", async () => {
    await submitNewAdmin()
    let prompt = await screen.findByRole("dialog", { name: /confirme sua identidade/i })

    fireEvent.change(within(prompt).getByLabelText("Código"), { target: { value: "000000" } })
    fireEvent.click(within(prompt).getByRole("button", { name: "Confirmar" }))

    expect((await screen.findByRole("alert")).textContent).toContain("Código inválido")
    prompt = await screen.findByRole("dialog", { name: /confirme sua identidade/i })
    fireEvent.change(within(prompt).getByLabelText("Código"), { target: { value: "123456" } })
    fireEvent.click(within(prompt).getByRole("button", { name: "Confirmar" }))

    expect(await screen.findByTestId("temporary-password")).toBeTruthy()
    expect(reauthCalls).toEqual(["000000", "123456"])
  })

  it("cancelar o pedido de código: nada é criado e o formulário mostra o aviso", async () => {
    await submitNewAdmin()
    const prompt = await screen.findByRole("dialog", { name: /confirme sua identidade/i })

    fireEvent.click(within(prompt).getByRole("button", { name: "Cancelar" }))

    expect((await screen.findByRole("alert")).textContent).toContain("Nada foi alterado")
    expect(screen.queryByTestId("temporary-password")).toBeNull()
    expect(reauthCalls).toEqual([])
  })
})
