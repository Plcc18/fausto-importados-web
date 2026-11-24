// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ReauthPromptHost } from "./ReauthPromptHost"
import { askReauthCode } from "./reauthBridge"

afterEach(cleanup)

const open = async (reason?: "invalid" | "locked") => {
  let pending!: Promise<string | null>
  await act(async () => {
    pending = askReauthCode(reason)
  })
  return pending
}

describe("pedido de código 2FA (diálogo do site)", () => {
  it("abre um diálogo com campo focado; digitar e confirmar devolve o código sem espaços", async () => {
    render(<ReauthPromptHost />)

    const answer = open()
    const dialog = await screen.findByRole("dialog")
    const input = within(dialog).getByLabelText("Código") as HTMLInputElement
    expect(document.activeElement).toBe(input) // dá para digitar na hora
    expect(within(dialog).getByText("Confirme sua identidade")).toBeTruthy()
    expect((within(dialog).getByRole("button", { name: "Confirmar" }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: " 123456 " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }))

    expect(await answer).toBe("123456")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("Enter no campo também confirma (formulário)", async () => {
    render(<ReauthPromptHost />)
    const answer = open()
    const input = (await screen.findByLabelText("Código")) as HTMLInputElement

    fireEvent.change(input, { target: { value: "AAAA-BBBB-CCCC-DDDD" } })
    fireEvent.submit(input.closest("form")!)

    expect(await answer).toBe("AAAA-BBBB-CCCC-DDDD")
  })

  it("Cancelar, fechar (Esc) ou clicar fora devolvem null", async () => {
    render(<ReauthPromptHost />)

    const cancelled = open()
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }))
    expect(await cancelled).toBeNull()

    const escaped = open()
    const dialog = await screen.findByRole("dialog")
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(await escaped).toBeNull()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("código inválido: avisa e abre vazio para tentar de novo", async () => {
    render(<ReauthPromptHost />)

    const answer = open("invalid")

    expect((await screen.findByRole("alert")).textContent).toContain("Código inválido")
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe("")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(await answer).toBeNull()
  })

  it("bloqueio por tentativas: só avisa, sem campo de código", async () => {
    render(<ReauthPromptHost />)

    const answer = open("locked")

    expect(await screen.findByText("Muitas tentativas")).toBeTruthy()
    expect(screen.queryByLabelText("Código")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }))
    expect(await answer).toBeNull()
  })

  it("um pedido novo substitui o anterior (o antigo recebe null)", async () => {
    render(<ReauthPromptHost />)

    const first = open()
    await screen.findByRole("dialog")
    const second = open()
    expect(await first).toBeNull()

    fireEvent.change(await screen.findByLabelText("Código"), { target: { value: "654321" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(await second).toBe("654321")
  })

  it("sem diálogo montado não há como perguntar: devolve null na hora (não trava a operação)", async () => {
    expect(await askReauthCode(undefined)).toBeNull()
  })

  it("se a tela some com o pedido aberto, ele é cancelado (ninguém fica esperando para sempre)", async () => {
    const view = render(<ReauthPromptHost />)
    const answer = open()
    await screen.findByRole("dialog")

    view.unmount()

    expect(await answer).toBeNull()
  })
})
