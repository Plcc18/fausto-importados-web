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

interface BridgeState {
  current: PromptRequest | null
  nextId: number
  listeners: Set<() => void>
}

/**
 * O estado vive em `globalThis`, não em variáveis do módulo. Com o hot-reload do Vite (ou qualquer duplicação de
 * módulo) podem existir DUAS cópias deste arquivo na página: uma ligada ao diálogo e outra usada por quem pede o
 * código. Com estado por módulo, o pedido caía numa cópia sem diálogo e era descartado na hora ("confirmação não
 * concluída" sem nunca perguntar). Com estado compartilhado, as cópias enxergam o mesmo diálogo.
 */
const GLOBAL_KEY = "__faustoReauthBridge"
const state: BridgeState = ((globalThis as Record<string, unknown>)[GLOBAL_KEY] ??= {
  current: null,
  nextId: 1,
  listeners: new Set<() => void>(),
}) as BridgeState

const emit = () => state.listeners.forEach((listener) => listener())

export const subscribe = (listener: () => void) => {
  state.listeners.add(listener)
  return () => {
    state.listeners.delete(listener)
    if (state.listeners.size === 0) settle(null) // o host saiu da tela: ninguém ficará esperando para sempre
  }
}

export function settle(code: string | null) {
  const request = state.current
  state.current = null
  emit()
  request?.resolve(code)
}

/** Pede o código ao usuário. Devolve `null` se ele cancelar (ou se não há onde mostrar o pedido). */
export function askReauthCode(reason: ReauthPromptReason): Promise<string | null> {
  if (state.listeners.size === 0) {
    // Sem diálogo montado não há como perguntar. Avisa no console: sem isso a falha parece "confirmação recusada".
    console.warn("[reauth] Nenhum diálogo de confirmação está montado; a operação sensível foi cancelada. Recarregue a página.")
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    state.current?.resolve(null) // um pedido novo substitui o anterior
    state.current = { id: state.nextId++, reason, resolve }
    emit()
  })
}

export const currentRequest = (): PromptRequest | null => state.current
