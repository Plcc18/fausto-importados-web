import type { CampaignType } from "@/lib/campaign/types"
import { startOfDay, startOfNextDay } from "@/admin/campaigns/dates"
import type { Situation } from "@/admin/campaigns/labels"

export const PAGE_SIZE = 20

/** Filtros da tela. Texto vazio = sem filtro. `from` e `to` são dias (`AAAA-MM-DD`), os dois incluídos. */
export interface ListFilters {
  q: string
  situation: Situation | ""
  type: CampaignType | ""
  from: string
  to: string
}

export const NO_FILTERS: ListFilters = { q: "", situation: "", type: "", from: "", to: "" }

export const hasFilters = (filters: ListFilters) => Object.values(filters).some((value) => value.trim() !== "")

/** A API só aceita datas entre os anos 2000 e 2100. */
const isSupportedDay = (day: string) => /^20\d{2}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day))

/** Por que o período escolhido não pode ser consultado, ou `null` se puder. */
export function periodError({ from, to }: ListFilters): string | null {
  if ((from && !isSupportedDay(from)) || (to && !isSupportedDay(to))) return "Use datas entre os anos 2000 e 2099."
  if (from && to && to < from) return "A data final precisa ser igual ou posterior à inicial."
  return null
}

/** Parâmetros da API (contrato §7.2), sem a paginação. Chamar só com um período válido. */
export function listQuery({ q, situation, type, from, to }: ListFilters): string {
  const params = new URLSearchParams()
  // na API, rascunho, desativada e arquivada são `status`; as três situações de uma publicada são `phase`
  if (situation === "DRAFT" || situation === "DISABLED" || situation === "ARCHIVED") params.set("status", situation)
  else if (situation) params.set("phase", situation)
  if (type) params.set("type", type)
  if (from) params.set("from", startOfDay(from))
  if (to) params.set("to", startOfNextDay(to))
  if (q.trim()) params.set("q", q.trim())
  return params.toString()
}

/** @param page a partir de 0 */
export function pageQuery(filters: string, page: number): string {
  const params = new URLSearchParams(filters)
  params.set("page", String(page))
  params.set("size", String(PAGE_SIZE))
  return params.toString()
}
