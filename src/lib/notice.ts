/**
 * Avisos em diálogo do próprio site (substitui os popups do SweetAlert2): sucesso, erro, atenção e informação.
 * `notify()` pode ser chamado de qualquer lugar (componentes, handlers, funções); o <NoticeHost /> (em App) mostra.
 *
 * O estado vive em `globalThis` pelo mesmo motivo da ponte de reautenticação: com o hot-reload do Vite podem existir
 * duas cópias deste módulo na página, e um aviso emitido numa cópia sem diálogo ligado se perderia em silêncio.
 */

export type NoticeIcon = "success" | "error" | "warning" | "info"

export interface NoticeOptions {
  icon: NoticeIcon
  title: string
  text?: string
  /** Fecha sozinho depois de tantos milissegundos (sem botão). Sem isso, o aviso tem um botão "OK". */
  timer?: number
}

export interface Notice extends NoticeOptions {
  id: number
}

interface NoticeState {
  current: Notice | null
  nextId: number
  listeners: Set<() => void>
}

const GLOBAL_KEY = "__faustoNotices"
const state: NoticeState = ((globalThis as Record<string, unknown>)[GLOBAL_KEY] ??= {
  current: null,
  nextId: 1,
  listeners: new Set<() => void>(),
}) as NoticeState

const emit = () => state.listeners.forEach((listener) => listener())

export const subscribeNotice = (listener: () => void) => {
  state.listeners.add(listener)
  return () => {
    state.listeners.delete(listener)
  }
}

export const currentNotice = (): Notice | null => state.current

/** Mostra um aviso. Um aviso novo substitui o que estiver na tela. */
export function notify(options: NoticeOptions): void {
  if (state.listeners.size === 0) {
    console.warn(`[notice] Nenhum diálogo de aviso montado; mensagem não exibida: ${options.title}`)
    return
  }
  state.current = { ...options, id: state.nextId++ }
  emit()
}

/** Fecha o aviso (só se ainda for o `id` informado: um timer antigo não fecha um aviso novo). */
export function dismissNotice(id?: number): void {
  if (!state.current || (id !== undefined && state.current.id !== id)) return
  state.current = null
  emit()
}
