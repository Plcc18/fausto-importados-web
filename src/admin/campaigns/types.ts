/**
 * Tipos das campanhas como o painel os recebe (`docs/campanhas-contrato.md` §2 e §5). Os da resposta pública, que a
 * loja usa, ficam em `src/lib/campaign/types.ts`.
 */
import type { CampaignType, IsoDateTime } from "@/lib/campaign/types"

/** O que o admin decidiu: é o único estado gravado. */
export const CAMPAIGN_STATUSES = ["DRAFT", "PUBLISHED", "DISABLED", "ARCHIVED"] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

/** Calculada pela API pelas datas, só para publicadas. */
export const CAMPAIGN_PHASES = ["SCHEDULED", "ACTIVE", "EXPIRED"] as const
export type CampaignPhase = (typeof CAMPAIGN_PHASES)[number]

/** Item da listagem (`CampaignSummary`, §5.3). Num rascunho, nome, tipo e datas podem faltar. */
export interface CampaignSummary {
  id: string
  name: string | null
  type: CampaignType | null
  status: CampaignStatus
  phase: CampaignPhase | null
  priority: number
  startsAt: IsoDateTime | null
  endsAt: IsoDateTime | null
  updatedAt: IsoDateTime
  updatedBy: string | null
  collectionCount: number
  /** Enviada de volta em toda escrita. */
  version: number
}

export interface CampaignPage {
  content: CampaignSummary[]
  page: { size: number; number: number; totalElements: number; totalPages: number }
}

/**
 * Corpo de criar e editar (§5.1). A edição substitui o documento inteiro: o que não for enviado é apagado.
 * O `theme` é lido e montado por `theme/themeDraft.ts` e o `content` por `content/contentDraft.ts`. As `collections`
 * ganham editor na T32; até lá o painel as devolve como recebeu.
 */
export interface CampaignInput {
  name: string | null
  description: string | null
  type: CampaignType | null
  priority: number
  startsAt: IsoDateTime | null
  endsAt: IsoDateTime | null
  theme: unknown
  content: unknown
  collections: unknown[]
  /** Não vai na criação. */
  version?: number
}

/** Resposta do painel para uma campanha (`CampaignDetail`, §5.2). */
export interface CampaignDetail extends CampaignInput {
  id: string
  status: CampaignStatus
  phase: CampaignPhase | null
  version: number
}
