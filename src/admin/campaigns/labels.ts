import type { CampaignType } from "@/lib/campaign/types"
import type { CampaignSummary } from "@/admin/campaigns/types"

/** Nomes no painel. Na loja, o selo dos produtos usa textos mais curtos (`src/lib/campaign/collections.ts`). */
export const TYPE_LABELS: Record<CampaignType, string> = {
  BLACK_FRIDAY: "Black Friday",
  CHRISTMAS: "Natal",
  EASTER: "Páscoa",
  VALENTINES_DAY: "Dia dos Namorados",
  MOTHERS_DAY: "Dia das Mães",
  FATHERS_DAY: "Dia dos Pais",
  CONSUMER_DAY: "Dia do Consumidor",
  STORE_ANNIVERSARY: "Aniversário da loja",
  CUSTOM: "Personalizada",
}

/** A situação que a pessoa enxerga: o status gravado, com as publicadas separadas pela fase. */
export const SITUATIONS = ["DRAFT", "SCHEDULED", "ACTIVE", "EXPIRED", "DISABLED", "ARCHIVED"] as const
export type Situation = (typeof SITUATIONS)[number]

export const SITUATION_LABELS: Record<Situation, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  ACTIVE: "No ar",
  EXPIRED: "Encerrada",
  DISABLED: "Desativada",
  ARCHIVED: "Arquivada",
}

export function situationOf({ status, phase }: Pick<CampaignSummary, "status" | "phase">): Situation {
  // a API sempre informa a fase das publicadas (a resposta é conferida em `api.ts`)
  return status === "PUBLISHED" ? (phase ?? "SCHEDULED") : status
}
