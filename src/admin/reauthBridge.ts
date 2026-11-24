import type { ReauthPromptReason } from "@/lib/auth"

/**
 * "Ponte" do pedido de código 2FA: `sensitiveFetch` (que não é um componente) chama `askReauthCode()`, e o
 * <ReauthPromptHost /> (diálogo do próprio site, em ReauthPromptHost.tsx) mostra o pedido.
 *
 * Por que não SweetAlert2: ele fica fora do sistema de diálogos do site. Aberto por cima de outro diálogo (ex.: "Novo
 * administrador"), o diálogo do Radix prende o foco e bloqueia cliques fora dele, e o campo do SweetAlert2 não recebia
 * teclado. Diálogos do Radix se empilham corretamente: o de cima fica ativo.
 */

export interface PromptRequest {
  id: number
  reason: ReauthPromptReason
  resolve: (code: string | null) => void
}

let current: PromptRequest | null = null
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) settle(null) // o host saiu da tela: ninguém ficará esperando para sempre
  }
}

export function settle(code: string | null) {
  const request = current
  current = null
  emit()
  request?.resolve(code)
}

/** Pede o código ao usuário. Devolve `null` se ele cancelar (ou se não há onde mostrar o pedido). */
export function askReauthCode(reason: ReauthPromptReason): Promise<string | null> {
  if (listeners.size === 0) return Promise.resolve(null) // sem host montado: não há como perguntar
  return new Promise((resolve) => {
    current?.resolve(null) // um pedido novo substitui o anterior
    current = { id: nextId++, reason, resolve }
    emit()
  })
}


export const currentRequest = (): PromptRequest | null => current
