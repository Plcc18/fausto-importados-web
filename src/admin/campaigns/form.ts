/** O que o formulário da campanha mostra, e a ida e volta disso para a API. */
import type { CampaignType } from "@/lib/campaign/types"
import { SENSITIVE_NOT_DONE } from "@/admin/sensitive"
import { describeField, readApiProblem } from "@/admin/campaigns/actions"
import {
  checkCollections,
  collectionsFrom,
  collectionsInput,
  type CollectionDraft,
} from "@/admin/campaigns/collections/collectionsDraft"
import { checkContent, contentInput, contentValuesFrom, type ContentValues } from "@/admin/campaigns/content/contentDraft"
import { fromInputValue, toInputValue } from "@/admin/campaigns/dates"
import { checkTheme, themeDraftFrom, themeInput, type ThemeDraft } from "@/admin/campaigns/theme/themeDraft"
import type { CampaignDetail, CampaignInput } from "@/admin/campaigns/types"

/** Os campos como estão na tela. Vazio = sem valor. Datas no horário da loja. */
export interface FormValues extends ContentValues {
  name: string
  description: string
  type: CampaignType | ""
  priority: string
  startsAt: string
  endsAt: string
  theme: ThemeDraft | null
  collections: CollectionDraft[]
}

/** Os campos de dados (tema, conteúdo e coleções têm editores próprios). */
export type FieldName = Exclude<keyof FormValues, "theme" | "collections" | keyof ContentValues>
/** Mensagens pelo caminho que a API usa: `name`, `theme.dark.primary`... */
export type FieldErrors = Partial<Record<string, string>>

export const EMPTY_VALUES: FormValues = {
  name: "", description: "", type: "", priority: "0", startsAt: "", endsAt: "", theme: null,
  topBar: null, banner: null, promoImages: [], decorations: [], collections: [],
}

export const valuesFrom = (campaign: CampaignDetail): FormValues => ({
  name: campaign.name ?? "",
  description: campaign.description ?? "",
  type: campaign.type ?? "",
  priority: String(campaign.priority),
  startsAt: toInputValue(campaign.startsAt),
  endsAt: toInputValue(campaign.endsAt),
  theme: themeDraftFrom(campaign.theme),
  ...contentValuesFrom(campaign.content),
  collections: collectionsFrom(campaign.collections),
})

// tema, conteúdo e coleções são objetos, sempre montados com os campos na mesma ordem
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

export const sameValues = (a: FormValues, b: FormValues) =>
  (Object.keys(a) as (keyof FormValues)[]).every((field) => same(a[field], b[field]))

const DATE_TIME = /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

/** Só o que impediria montar o corpo corretamente. As regras de cada campo são da API, que responde campo a campo. */
export function checkValues(values: FormValues): FieldErrors {
  const { priority, startsAt, endsAt, theme } = values
  const errors: FieldErrors = {
    ...checkTheme(theme),
    ...checkContent(values),
    ...checkCollections(values.collections),
  }
  const number = Number(priority)
  // Vazio também é recusado: a caixa numérica devolve vazio para textos como "50e", e salvar 0 mudaria a
  // prioridade sem avisar
  if (!priority.trim() || !Number.isInteger(number) || number < 0 || number > 100) {
    errors.priority = "Use um número inteiro de 0 a 100."
  }
  for (const [field, value] of [["startsAt", startsAt], ["endsAt", endsAt]] as const) {
    if (value && !DATE_TIME.test(value)) errors[field] = "Use uma data entre os anos 2000 e 2099."
  }
  return errors
}

/**
 * Corpo de criar ou editar. Como a edição substitui o documento inteiro, o que a pessoa não mexeu (coleções, tema,
 * cada parte do conteúdo e datas) volta exatamente como veio; a caixa de data, por exemplo, não guarda os segundos.
 */
export function buildInput(values: FormValues, campaign: CampaignDetail | null): CampaignInput {
  const instant = (value: string, original: string | null | undefined) => {
    if (original && value === toInputValue(original)) return original
    return value ? fromInputValue(value) : null
  }
  return {
    name: values.name.trim() || null,
    description: values.description.trim() || null,
    type: values.type || null,
    priority: Number(values.priority),
    startsAt: instant(values.startsAt, campaign?.startsAt),
    endsAt: instant(values.endsAt, campaign?.endsAt),
    theme:
      campaign && same(values.theme, themeDraftFrom(campaign.theme)) ? (campaign.theme ?? null) : themeInput(values.theme),
    content: contentInput(campaign?.content, values),
    collections:
      campaign && same(values.collections, collectionsFrom(campaign.collections))
        ? campaign.collections
        : collectionsInput(values.collections),
    ...(campaign && { version: campaign.version }),
  }
}

export interface SaveProblem {
  message: string
  /** Erros mostrados junto do campo. */
  fields: FieldErrors
  /** Os campos com problema, listados no aviso junto dos botões. */
  others: string[]
  /** A campanha mudou no servidor: só resta carregar a versão atual. Nunca sobrescrever. */
  stale: boolean
}

export const problem = (message: string, extra: Partial<SaveProblem> = {}): SaveProblem => ({
  message,
  fields: {},
  others: [],
  stale: false,
  ...extra,
})

/** Por que a API recusou salvar ou publicar. */
export async function readSaveProblem(res: Response): Promise<SaveProblem> {
  const body = await readApiProblem(res)

  switch (body.code) {
    case "reauth_required":
      return problem(SENSITIVE_NOT_DONE)
    case "version_conflict":
      return problem("A campanha foi alterada por outra operação, e nada foi salvo por cima.", { stale: true })
    case "invalid_transition":
      return problem(body.message ?? "A ação não é permitida na situação atual.", { stale: true })
    case "campaign_conflict":
    case "concurrent_operation":
      return problem(body.message ?? "Outra operação ou campanha impede esta ação.")
    case "validation_failed":
    case "publish_requirements": {
      const fields: FieldErrors = {}
      const others = new Set<string>()
      for (const item of body.fields ?? []) {
        const field = item.field ?? ""
        // o erro aparece junto do campo; o aviso junto dos botões lista todos
        if (/^(theme|content|collections)(\.|\[|$)/.test(field) || Object.hasOwn(EMPTY_VALUES, field)) {
          fields[field] ??= item.message
        }
        others.add(describeField(item))
      }
      const message = body.code === "publish_requirements" ? "Faltam dados para publicar." : "Há campos inválidos."
      return problem(message, { fields, others: [...others] })
    }
  }
  if (res.status === 404) return problem("Essa campanha não existe mais.")
  if (res.status === 429) return problem("Muitas tentativas. Aguarde alguns minutos.")
  return problem("O servidor não concluiu a operação. Tente novamente em instantes.")
}
