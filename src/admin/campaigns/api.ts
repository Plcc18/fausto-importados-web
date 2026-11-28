import { API_URL } from "@/lib/api"
import { authFetch } from "@/lib/auth"
import { HttpError } from "@/lib/httpErrors"
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency"
import { sensitiveFetch } from "@/admin/sensitive"
import type { CampaignAction } from "@/admin/campaigns/actions"
import { CAMPAIGN_PHASES, CAMPAIGN_STATUSES, type CampaignPage, type CampaignSummary } from "@/admin/campaigns/types"

/**
 * Chamadas administrativas de campanhas (`docs/campanhas-contrato.md` §7.2). Só o painel importa este módulo:
 * ele não pode entrar no bundle público (`src/build.test.ts`).
 */
export const ADMIN_CAMPAIGNS_URL = `${API_URL}/api/admin/campaigns`

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
  const withVersion: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  }

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
