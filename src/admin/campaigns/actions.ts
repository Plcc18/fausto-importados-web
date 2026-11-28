import type { NoticeOptions } from "@/lib/notice"
import { SENSITIVE_NOT_DONE } from "@/admin/sensitive"
import { situationOf, type Situation } from "@/admin/campaigns/labels"
import type { CampaignSummary } from "@/admin/campaigns/types"

export type CampaignAction = "activate" | "disable" | "reactivate" | "duplicate" | "archive" | "delete"

/** O que a API permite em cada situação (contrato §7.3). Duplicar vale para todas. */
const AVAILABLE: Record<Situation, CampaignAction[]> = {
  DRAFT: ["activate", "duplicate", "archive", "delete"],
  SCHEDULED: ["activate", "disable", "duplicate"],
  ACTIVE: ["disable", "duplicate"],
  EXPIRED: ["duplicate", "archive"],
  DISABLED: ["reactivate", "duplicate", "archive"],
  ARCHIVED: ["duplicate"],
}

export const availableActions = (campaign: CampaignSummary) => AVAILABLE[situationOf(campaign)]

/** Encerrada não é editada (duplica-se) e arquivada é definitiva (contrato §7.3). */
export const isEditable = (campaign: Pick<CampaignSummary, "status" | "phase">) =>
  !["EXPIRED", "ARCHIVED"].includes(situationOf(campaign))

interface ActionTexts {
  /** Botão da lista e da confirmação. */
  label: string
  /** "Não foi possível <verbo>". */
  verb: string
  destructive: boolean
  question: string
  explain: (campaign: CampaignSummary) => string
  done: string
}

const subject = ({ name }: CampaignSummary) => (name ? `A campanha “${name}”` : "Esta campanha")

export const ACTIONS: Record<CampaignAction, ActionTexts> = {
  activate: {
    label: "Ativar agora",
    verb: "ativar",
    destructive: false,
    question: "Ativar agora?",
    explain: (c) =>
      `${subject(c)} é publicada e passa a valer agora: um início vazio ou no futuro passa a ser este momento. Se outra campanha no ar tiver prioridade maior, a loja mostra a outra.`,
    done: "Campanha ativada.",
  },
  disable: {
    label: "Desativar",
    verb: "desativar",
    destructive: true,
    question: "Desativar campanha?",
    explain: (c) => {
      // A loja não consulta de tempos em tempos: uma página que ficou aberta só muda quando a pessoa age
      const effect =
        situationOf(c) === "ACTIVE"
          ? "sai do ar. Quem abrir a loja já não a vê; quem está com ela aberta só vê a mudança ao recarregar ou voltar para a aba"
          : "não vai entrar no ar no horário marcado"
      return `${subject(c)} ${effect}. Dá para reativar depois, enquanto o período não acabar.`
    },
    done: "Campanha desativada.",
  },
  reactivate: {
    label: "Reativar",
    verb: "reativar",
    destructive: false,
    question: "Reativar campanha?",
    explain: (c) => `${subject(c)} volta a ficar publicada e aparece na loja durante o período marcado.`,
    done: "Campanha reativada.",
  },
  duplicate: {
    label: "Duplicar",
    verb: "duplicar",
    destructive: false,
    question: "Duplicar campanha?",
    explain: (c) =>
      `Cria um rascunho com o mesmo conteúdo ${c.name ? `de “${c.name}”` : "desta campanha"}, sem as datas.`,
    done: "Cópia criada como rascunho, sem datas.",
  },
  archive: {
    label: "Arquivar",
    verb: "arquivar",
    destructive: true,
    question: "Arquivar campanha?",
    explain: (c) =>
      `${subject(c)} não poderá mais ser editada nem voltar ao ar. Ela continua na lista e pode ser duplicada. Não dá para desfazer.`,
    done: "Campanha arquivada.",
  },
  delete: {
    label: "Excluir",
    verb: "excluir",
    destructive: true,
    question: "Excluir rascunho?",
    explain: (c) =>
      `${c.name ? `O rascunho “${c.name}”` : "Este rascunho"} será apagado definitivamente. Não dá para desfazer.`,
    done: "Rascunho excluído.",
  },
}

export const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  description: "Descrição",
  type: "Tipo",
  priority: "Prioridade",
  startsAt: "Início",
  endsAt: "Fim",
  "theme.dark": "Tema escuro",
  "theme.dark.background": "Cor de fundo",
  "theme.dark.foreground": "Cor do texto",
  "theme.dark.primary": "Cor de destaque",
  "theme.dark.primaryForeground": "Texto sobre o destaque",
  "theme.dark.accent": "Cor secundária",
  "content.hero.imageDesktop": "Imagem do banner",
}

/** Corpo de erro da API (contrato §1). */
export interface ApiProblem {
  code?: string
  message?: string
  fields?: { field?: string; message?: string }[]
}

export const readApiProblem = async (res: Response) =>
  ((await res.json().catch(() => null)) ?? {}) as ApiProblem

/** "Rótulo: mensagem"; sem rótulo conhecido, só a mensagem. */
export const describeField = ({ field = "", message = "" }: { field?: string; message?: string }) =>
  FIELD_LABELS[field] ? `${FIELD_LABELS[field]}: ${message}` : message

/** O aviso para uma ação que a API recusou. As mensagens dela para campanhas já vêm em português. */
export async function explainFailure(res: Response, action: CampaignAction): Promise<NoticeOptions> {
  const body = await readApiProblem(res)
  const title = `Não foi possível ${ACTIONS[action].verb}`
  const warning = (text: string): NoticeOptions => ({ icon: "warning", title, text })

  switch (body.code) {
    case "reauth_required":
      return { icon: "info", title, text: SENSITIVE_NOT_DONE }
    case "version_conflict":
      return warning("A campanha foi alterada por outra operação, e nada foi feito. A lista foi atualizada: confira e tente de novo.")
    case "invalid_transition":
      return warning(`${body.message ?? "A ação não é permitida na situação atual."} A lista foi atualizada.`)
    case "campaign_conflict":
    case "concurrent_operation":
      return warning(body.message ?? "Outra operação ou campanha impede esta ação.")
    case "publish_requirements": {
      const missing = (body.fields ?? []).map(describeField)
      return warning(["Complete a campanha antes.", ...new Set(missing)].join(" "))
    }
  }
  if (res.status === 404) return warning("Essa campanha não existe mais. A lista foi atualizada.")
  if (res.status === 429) return warning("Muitas tentativas. Aguarde alguns minutos.")
  return { icon: "error", title, text: "O servidor não concluiu a operação. Tente novamente em instantes." }
}
