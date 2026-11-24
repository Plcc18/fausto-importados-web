// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Dialog, DialogContent, DialogTitle } from "@/Shadcn-Components/ui/dialog"
import { NoticeHost } from "./NoticeHost"
import { currentNotice, dismissNotice, notify } from "@/lib/notice"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  dismissNotice()
})

describe("avisos do site (substituem os popups do SweetAlert2)", () => {
  it("mostra ícone, título e texto; sem tempo, tem botão OK que fecha", async () => {
    render(<NoticeHost />)

    act(() => notify({ icon: "error", title: "Acesso negado", text: "Você não está autorizado!" }))

    const dialog = await screen.findByRole("dialog", { name: "Acesso negado" })
    expect(dialog.textContent).toContain("Você não está autorizado!")
    expect(screen.getByRole("img", { name: "Erro" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "OK" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(currentNotice()).toBeNull()
  })

  it("cada tipo tem o seu ícone", async () => {
    render(<NoticeHost />)
    const labels = { success: "Sucesso", error: "Erro", warning: "Atenção", info: "Informação" } as const

    for (const [icon, label] of Object.entries(labels)) {
      act(() => notify({ icon: icon as keyof typeof labels, title: `aviso ${icon}` }))
      expect(await screen.findByRole("img", { name: label })).toBeTruthy()
    }
  })

  it("com tempo, fecha sozinho e não mostra o botão OK", async () => {
    vi.useFakeTimers()
    render(<NoticeHost />)

    act(() => notify({ icon: "success", title: "Até logo!", text: "Você saiu da sua conta.", timer: 2000 }))

    expect(screen.getByRole("dialog", { name: "Até logo!" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "OK" })).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
    expect(screen.queryByRole("dialog")).not.toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(2) })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("um aviso novo substitui o anterior, e o tempo do antigo NÃO fecha o novo", async () => {
    vi.useFakeTimers()
    render(<NoticeHost />)
    act(() => notify({ icon: "success", title: "Primeiro", timer: 2000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })

    act(() => notify({ icon: "error", title: "Segundo" })) // sem tempo: fica até o OK

    expect(screen.getByRole("dialog", { name: "Segundo" })).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByRole("dialog", { name: "Segundo" })).toBeTruthy() // o timer do "Primeiro" não o fechou
  })

  it("Esc fecha o aviso", async () => {
    render(<NoticeHost />)
    act(() => notify({ icon: "info", title: "Algo aconteceu" }))

    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" })

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("aparece por cima de outro diálogo aberto e o botão OK responde (o problema do popup antigo)", async () => {
    render(
      <>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Formulário aberto</DialogTitle>
          </DialogContent>
        </Dialog>
        <NoticeHost />
      </>,
    )
    expect(await screen.findByRole("dialog", { name: "Formulário aberto" })).toBeTruthy()

    act(() => notify({ icon: "warning", title: "Imagem obrigatória" }))

    const notice = await screen.findByRole("dialog", { name: "Imagem obrigatória" })
    const ok = screen.getByRole("button", { name: "OK" })
    expect(notice.contains(ok)).toBe(true)
    fireEvent.click(ok)
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Imagem obrigatória" })).toBeNull())
    expect(screen.getByRole("dialog", { name: "Formulário aberto" })).toBeTruthy() // o de baixo continua
  })

  it("sem diálogo montado não quebra: avisa no console", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(() => notify({ icon: "info", title: "Ninguém vai ver" })).not.toThrow()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Ninguém vai ver"))
    warn.mockRestore()
  })

  it("duas cópias do módulo (hot-reload do Vite) compartilham o mesmo aviso", async () => {
    render(<NoticeHost />)
    vi.resetModules()
    const otherCopy = await import("@/lib/notice")

    act(() => otherCopy.notify({ icon: "success", title: "Veio de outra cópia" }))

    expect(await screen.findByRole("dialog", { name: "Veio de outra cópia" })).toBeTruthy()
  })
})
