import { API_URL } from "@/lib/api"
import { authFetch } from "@/lib/auth"
import { HttpError, errorCodeFromError, type ErrorCode } from "@/lib/httpErrors"
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency"
import { sensitiveFetch } from "@/admin/sensitive"
import type { CampaignAction } from "@/admin/campaigns/actions"
import {
  CAMPAIGN_PHASES,
  CAMPAIGN_STATUSES,
  type CampaignDetail,
  type CampaignPage,
  type CampaignSummary,
} from "@/admin/campaigns/types"

/**
 * Chamadas administrativas de campanhas (`docs/campanhas-contrato.md` §7.2). Só o painel importa este módulo:
 * ele não pode entrar no bundle público (`src/build.test.ts`).
 */
export const ADMIN_CAMPAIGNS_URL = `${API_URL}/api/admin/campaigns`

const JSON_HEADERS = { "Content-Type": "application/json" }

/** Falha ao carregar → tela de erro. 403 tem a própria tela. */
export const errorScreenCode = (error: unknown): ErrorCode =>
  error instanceof HttpError && error.status === 403 ? "403" : errorCodeFromError(error)

/** O mínimo para a tela e as ações funcionarem: quem é, em que situação está e a versão. */
function isSummary(value: unknown): value is CampaignSummary {
  const item = value as Partial<CampaignSummary> | null
  return (
    typeof item?.id === "string" &&
    typeof item.version === "number" &&
    CAMPAIGN_STATUSES.includes(item.status as never) &&
    (item.status !== "PUBLISHED" || CAMPAIGN_PHASES.includes(item.phase as never))
  )
}

/**
 * Confere a campanha completa. Como a edição substitui o documento inteiro, uma resposta sem tema, conteúdo ou
 * coleções é recusada: salvá-la de volta apagaria o que faltou.
 */
export async function readCampaignDetail(res: Response): Promise<CampaignDetail> {
  const body: unknown = await res.json()
  const detail = body as Partial<CampaignDetail> | null
  const complete = !!detail && "theme" in detail && "content" in detail && Array.isArray(detail.collections)
  if (!complete || !isSummary(body)) throw new Error("Resposta inesperada da campanha")
  return detail as CampaignDetail
}

export async function getCampaign(id: string, signal?: AbortSignal): Promise<CampaignDetail> {
  const res = await authFetch(`${ADMIN_CAMPAIGNS_URL}/${encodeURIComponent(id)}`, { signal })
  if (!res.ok) throw new HttpError(res.status)
  return readCampaignDetail(res)
}

/** Cria um rascunho. A mesma `idempotencyKey` não cria duas vezes. */
export const createCampaign = (body: string, idempotencyKey: string) =>
  authFetch(ADMIN_CAMPAIGNS_URL, {
    method: "POST",
    headers: { ...JSON_HEADERS, [IDEMPOTENCY_HEADER]: idempotencyKey },
    body,
  })

/** Substitui a campanha. A API pede o código 2FA quando ela está publicada. */
export const updateCampaign = (id: string, body: string) =>
  sensitiveFetch(`${ADMIN_CAMPAIGNS_URL}/${id}`, { method: "PUT", headers: JSON_HEADERS, body })

/** Rascunho → publicada (pede 2FA). */
export const publishCampaign = ({ id, version }: Pick<CampaignDetail, "id" | "version">) =>
  sensitiveFetch(`${ADMIN_CAMPAIGNS_URL}/${id}/publish`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ version }),
  })

/** @param query filtros e paginação (ver `listQuery.ts`) */
export async function listCampaigns(query: string, signal?: AbortSignal): Promise<CampaignPage> {
  const res = await authFetch(`${ADMIN_CAMPAIGNS_URL}?${query}`, { signal })
  if (!res.ok) throw new HttpError(res.status)
  const body = (await res.json()) as Partial<CampaignPage> | null
  const { content, page } = body ?? {}
  if (!Array.isArray(content) || !content.every(isSummary) || typeof page?.totalElements !== "number") {
    throw new Error("Resposta inesperada da lista de campanhas")
  }
  return { content, page }
}

/**
 * Executa uma ação sobre a campanha. As que colocam no ar ou tiram de forma definitiva pedem o código 2FA
 * (`sensitiveFetch`); desativar é o "botão de emergência" e duplicar só cria um rascunho (decisão T02).
 *
 * @param idempotencyKey pedida só ao duplicar, que cria algo (contrato §1)
 */
export function runCampaignAction(
  action: CampaignAction,
  { id, version }: Pick<CampaignSummary, "id" | "version">,
  idempotencyKey: () => string,
): Promise<Response> {
  const url = `${ADMIN_CAMPAIGNS_URL}/${id}`
  const withVersion: RequestInit = { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ version }) }

  switch (action) {
    case "activate":
      return sensitiveFetch(`${url}/activate-now`, withVersion)
    case "reactivate":
      return sensitiveFetch(`${url}/reactivate`, withVersion)
    case "archive":
      return sensitiveFetch(`${url}/archive`, withVersion)
    case "delete":
      return sensitiveFetch(`${url}?version=${version}`, { method: "DELETE" })
    case "disable":
      return authFetch(`${url}/disable`, withVersion)
    case "duplicate":
      return authFetch(`${url}/duplicate`, { method: "POST", headers: { [IDEMPOTENCY_HEADER]: idempotencyKey() } })
  }
}
