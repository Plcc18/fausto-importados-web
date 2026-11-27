/**
 * Cliente da campanha ativa: uma única tentativa de `GET /api/campaigns/active`, já validada.
 * Retentativas, cache local, timeout e a decisão de quando consultar de novo ficam no carregamento (T17).
 */
import { API_URL } from "@/lib/api"
import { HttpError } from "@/lib/httpErrors"
import { parseActiveCampaignResponse } from "./parse"
import type { ActiveCampaignResponse } from "./types"

export const ACTIVE_CAMPAIGN_PATH = "/api/campaigns/active"

/** A resposta chegou, mas não está no formato do contrato (ex.: página HTML do Render acordando). */
export class InvalidCampaignResponseError extends Error {
  constructor() {
    super("Resposta da campanha fora do formato esperado")
    this.name = "InvalidCampaignResponseError"
  }
}

/**
 * Busca a campanha ativa.
 *
 * - Sucesso → resposta validada. `campaign` vem `null` quando não há campanha ativa **ou** quando a campanha
 *   veio malformada: nos dois casos a loja usa o tema padrão.
 * - Falha de rede ou HTTP → `HttpError` / erro do `fetch`; corpo sem o formato do contrato →
 *   `InvalidCampaignResponseError`. Quem chama decide se tenta de novo; o catálogo nunca depende disto.
 */
export async function fetchActiveCampaign(signal?: AbortSignal): Promise<ActiveCampaignResponse> {
  const response = await fetch(`${API_URL}${ACTIVE_CAMPAIGN_PATH}`, {
    signal,
    // Sempre revalida com a API (ETag → 304 barato), em vez de usar a cópia guardada sem perguntar (contrato §7.1)
    cache: "no-cache",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new HttpError(response.status)

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new InvalidCampaignResponseError()
  }

  const parsed = parseActiveCampaignResponse(body)
  if (!parsed) throw new InvalidCampaignResponseError()
  return { ...parsed, serverTime: serverTimeFromHeader(response) ?? parsed.serverTime }
}

/**
 * Hora do servidor pelo cabeçalho `Date`. Depois de um `304` o navegador entrega o corpo antigo, com o
 * `serverTime` antigo; o `Date` é sempre o da resposta atual (contrato §7.1).
 */
function serverTimeFromHeader(response: Response): string | null {
  const header = response.headers.get("Date")
  if (!header) return null
  const time = Date.parse(header)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}
