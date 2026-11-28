import { API_URL } from "@/lib/api"
import { authFetch } from "@/lib/auth"
import { HttpError } from "@/lib/httpErrors"

/**
 * Chamadas administrativas de campanhas (`docs/campanhas-contrato.md` §7.2). Só o painel importa este módulo:
 * ele não pode entrar no bundle público (`src/build.test.ts`).
 */
export const ADMIN_CAMPAIGNS_URL = `${API_URL}/api/admin/campaigns`

/** Quantas campanhas existem. Pede um item só: o total vem na paginação. */
export async function countCampaigns(): Promise<number> {
  const res = await authFetch(`${ADMIN_CAMPAIGNS_URL}?size=1`)
  if (!res.ok) throw new HttpError(res.status)
  const body = (await res.json()) as { page?: { totalElements?: unknown } } | null
  const total = body?.page?.totalElements
  if (typeof total !== "number") throw new Error("Resposta inesperada da lista de campanhas")
  return total
}
