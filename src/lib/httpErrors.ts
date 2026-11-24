/**
 * Classificação de falhas de comunicação com a API.
 *
 * Separa o que realmente aconteceu (resposta HTTP 4xx/5xx, timeout, falha de
 * conexão) do que é mostrado ao consumidor. Nada daqui expõe detalhes técnicos
 * na interface: as telas só recebem um `ErrorCode`.
 */

/** Códigos que possuem uma tela personalizada. */
export type ErrorCode = "403" | "404" | "500" | "502" | "503" | "504" | "connection"

export class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.name = "HttpError"
    this.status = status
  }
}

/** A tentativa excedeu o tempo limite (servidor não respondeu a tempo). */
export class RequestTimeoutError extends Error {
  constructor() {
    super("Request timeout")
    this.name = "RequestTimeoutError"
  }
}

/** Status HTTP → tela. Qualquer 5xx sem tela própria cai em 500. */
export function errorCodeFromStatus(status: number): ErrorCode {
  if (status === 403) return "403"
  if (status === 404) return "404"
  if (status === 502) return "502"
  if (status === 503 || status === 429) return "503"
  if (status === 504 || status === 408) return "504"
  if (status >= 500) return "500"
  // Outros 4xx não são "culpa" do servidor nem têm tela: tratados como falha de comunicação.
  return "connection"
}

/**
 * Erro lançado durante uma chamada à API → tela de erro exibida ao usuário.
 * - resposta HTTP 5xx            → 500 / 502 / 503 / 504
 * - timeout real                 → 504
 * - falha de conexão / resposta inválida / demais 4xx → "connection"
 *
 * Usado para telas de falha "operacional" (catálogo, área restrita); por isso
 * 403/404 de uma chamada de API não viram as telas de página: são tratados como
 * falha de comunicação. Quem precisa de 403 usa `errorCodeFromStatus`.
 */
export function errorCodeFromError(error: unknown): Exclude<ErrorCode, "403" | "404"> {
  if (error instanceof RequestTimeoutError) return "504"
  if (error instanceof HttpError) {
    const code = errorCodeFromStatus(error.status)
    return code === "403" || code === "404" ? "connection" : code
  }
  return "connection"
}
