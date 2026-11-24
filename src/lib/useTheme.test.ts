// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useTheme } from "./useTheme"

let systemDark = false
let listeners: Array<() => void> = []

function setSystemDark(value: boolean) {
  systemDark = value
  listeners.forEach((l) => l())
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
  systemDark = false
  listeners = []
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return systemDark },
    addEventListener: (_: string, l: () => void) => { listeners.push(l) },
    removeEventListener: (_: string, l: () => void) => { listeners = listeners.filter((x) => x !== l) },
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("useTheme", () => {
  it("a escolha salva do usuário vence o tema do sistema (claro salvo, sistema escuro)", () => {
    localStorage.setItem("theme", "light")
    systemDark = true
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("a escolha salva do usuário vence o tema do sistema (escuro salvo, sistema claro)", () => {
    localStorage.setItem("theme", "dark")
    systemDark = false
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("sem escolha salva segue o sistema e não grava nada", () => {
    systemDark = true
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("dark")
    expect(localStorage.getItem("theme")).toBeNull()
  })

  it("sem escolha salva acompanha mudanças do sistema; com escolha salva, ignora", () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("light")
    act(() => setSystemDark(true))
    expect(result.current.theme).toBe("dark")

    act(() => result.current.toggle()) // usuário escolhe claro
    expect(localStorage.getItem("theme")).toBe("light")
    act(() => setSystemDark(false))
    act(() => setSystemDark(true))
    expect(result.current.theme).toBe("light") // o sistema não sobrescreve mais a escolha
  })

  it("alternar grava a escolha", () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggle())
    expect(result.current.theme).toBe("dark")
    expect(localStorage.getItem("theme")).toBe("dark")
  })

  it("acompanha a escolha feita em outra aba", () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("light")
    act(() => {
      localStorage.setItem("theme", "dark")
      window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "dark" }))
    })
    expect(result.current.theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })
})
