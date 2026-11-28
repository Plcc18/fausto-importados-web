import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { toast } from "sonner"
import { Badge } from "@/Shadcn-Components/ui/badge"
import { Button } from "@/Shadcn-Components/ui/button"
import { Card, CardContent } from "@/Shadcn-Components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Shadcn-Components/ui/dialog"
import { Input } from "@/Shadcn-Components/ui/input"
import { Label } from "@/Shadcn-Components/ui/label"
import { Textarea } from "@/Shadcn-Components/ui/textarea"
import { ErrorView } from "@/component/errors/ErrorView"
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/campaign/types"
import { HttpError, type ErrorCode } from "@/lib/httpErrors"
import { useIdempotencyKeys } from "@/lib/idempotency"
import { describeField, isEditable } from "@/admin/campaigns/actions"
import {
  createCampaign,
  errorScreenCode,
  getCampaign,
  publishCampaign,
  readCampaignDetail,
  updateCampaign,
} from "@/admin/campaigns/api"
import { BannerEditor } from "@/admin/campaigns/banner/BannerEditor"
import type { BannerDraft } from "@/admin/campaigns/banner/bannerDraft"
import { CampaignsHeader } from "@/admin/campaigns/CampaignsHeader"
import {
  EMPTY_VALUES,
  buildInput,
  checkValues,
  problem,
  readSaveProblem,
  sameValues,
  valuesFrom,
  type FieldErrors,
  type FieldName,
  type FormValues,
  type SaveProblem,
} from "@/admin/campaigns/form"
import { SITUATION_LABELS, TYPE_LABELS, situationOf } from "@/admin/campaigns/labels"
import { ThemeEditor } from "@/admin/campaigns/theme/ThemeEditor"
import { themeValueAt, type ThemeDraft } from "@/admin/campaigns/theme/themeDraft"
import type { CampaignDetail } from "@/admin/campaigns/types"

const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm scheme-light dark:scheme-dark dark:bg-input/30 dark:[&_option]:bg-popover focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive"

const SAVE_UNCONFIRMED = "Não conseguimos confirmar o salvamento com o servidor. Tente salvar de novo."

/** Rótulo, controle, dica e erro de um campo. */
function Field({
  name,
  label,
  hint,
  error,
  className = "",
  children,
}: {
  name: FieldName
  label: string
  hint?: string
  error?: string
  className?: string
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode
}) {
  const id = `campaign-${name}`
  const note = error ?? hint
  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": note ? `${id}-note` : undefined })}
      {note && (
        <p id={`${id}-note`} className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>{note}</p>
      )}
    </div>
  )
}

/**
 * Formulário de uma campanha (dados, agendamento, tema e banner): criar, editar, salvar rascunho e publicar. O resto
 * do conteúdo e os produtos são preservados e ganham editores próprios (T31 e T32).
 */
export function CampaignEditor({
  initialId,
  leaving,
  onStay,
  onDiscard,
  onDirtyChange,
  onBusyChange,
  onCreated,
  onClose,
}: {
  /** `null` = campanha nova. Lido só ao abrir. */
  initialId: string | null
  /** A pessoa tentou sair com alterações não salvas. */
  leaving: boolean
  onStay: () => void
  onDiscard: () => void
  onDirtyChange: (dirty: boolean) => void
  /** Salvando ou publicando: quem chama não troca de tela até terminar. */
  onBusyChange: (busy: boolean) => void
  onCreated: (id: string) => void
  /** Fecha o formulário (com alterações pendentes, quem chama pergunta antes). */
  onClose: () => void
}) {
  const idRef = useRef(initialId)
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [values, setValues] = useState(EMPTY_VALUES)
  /** Como a campanha está no servidor: a diferença para `values` é o que falta salvar. */
  const [saved, setSaved] = useState(EMPTY_VALUES)
  const dirty = !sameValues(values, saved)

  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(initialId ? -1 : 0)
  const loading = loaded !== attempt
  const [loadFailure, setLoadFailure] = useState<ErrorCode | "missing" | null>(null)

  const [busy, setBusyState] = useState<"saving" | "publishing" | null>(null)
  // Avisa na mesma atualização, e não num efeito: ao publicar, a tela é fechada logo depois de terminar
  const setBusy = (next: typeof busy) => {
    setBusyState(next)
    onBusyChange(next !== null)
  }
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<SaveProblem | null>(null)
  const [confirmingPublish, setConfirmingPublish] = useState(false)
  /** Imagens subindo agora. Salvar antes de terminarem gravaria a campanha sem elas. */
  const [uploads, setUploads] = useState(0)
  const trackUpload = useCallback((uploading: boolean) => setUploads((n) => n + (uploading ? 1 : -1)), [])
  const uploading = uploads > 0
  /** O que se perderia ao sair: mudanças não salvas ou uma imagem a caminho. */
  const unsaved = dirty || uploading
  const idempotency = useIdempotencyKeys()
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  /** Uma resposta que chega depois de o formulário ser fechado não pode mudar de tela. */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const apply = useCallback((detail: CampaignDetail, keepValues?: FormValues) => {
    const next = keepValues ?? valuesFrom(detail)
    setCampaign(detail)
    setValues(next)
    setSaved(next)
  }, [])

  useEffect(() => {
    const id = idRef.current
    if (!id) return
    const controller = new AbortController()
    getCampaign(id, controller.signal).then(
      (detail) => {
        if (controller.signal.aborted) return
        apply(detail)
        setLoadFailure(null)
        setLoaded(attempt)
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setLoadFailure(error instanceof HttpError && error.status === 404 ? "missing" : errorScreenCode(error))
        setLoaded(attempt)
      },
    )
    return () => controller.abort()
  }, [attempt, apply])

  useEffect(() => onDirtyChange(unsaved), [unsaved, onDirtyChange])

  // Fechar ou recarregar a aba: o navegador pergunta antes
  const unfinished = unsaved || busy !== null
  useEffect(() => {
    if (!unfinished) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unfinished])

  const set = <K extends FieldName>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const setTheme = (theme: ThemeDraft | null) => {
    // some o erro só das cores que mudaram; os outros continuam apontando o que falta
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([path]) => !path.startsWith("theme") || themeValueAt(theme, path) === themeValueAt(values.theme, path),
        ),
      ),
    )
    setValues((current) => ({ ...current, theme }))
  }

  const setBanner = (update: (current: BannerDraft | null) => BannerDraft | null, changed: string[]) => {
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([path]) => !changed.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)),
        ),
      ),
    )
    setValues((current) => ({ ...current, banner: update(current.banner) }))
  }

  const reload = () => {
    setFailure(null)
    setErrors({})
    setAttempt((n) => n + 1)
  }

  /** Confere o que dá para conferir antes de enviar. */
  const check = () => {
    const found = checkValues(values)
    // Data preenchida pela metade: a caixa devolve vazio, e salvar apagaria a data sem avisar
    for (const [field, ref] of [["startsAt", startRef], ["endsAt", endRef]] as const) {
      if (ref.current?.validity.badInput) found[field] = "Complete a data e o horário."
    }
    setErrors(found)
    // um erro de cor pode estar no modo que não está na tela: vai também para o aviso junto dos botões
    const inTheme = Object.entries(found)
      .filter(([field]) => field.startsWith("theme."))
      .map(([field, message]) => describeField({ field, message }))
    setFailure(inTheme.length > 0 ? problem("Há cores inválidas no tema.", { others: inTheme }) : null)
    return Object.keys(found).length === 0
  }

  /** Mostra o problema no formulário; se ele já foi fechado, num aviso, para não se perder. */
  const report = (found: SaveProblem) => {
    if (!mounted.current) {
      toast.error(found.message)
      return
    }
    setErrors(found.fields)
    setFailure(found)
  }

  const refuse = async (res: Response, prefix = "") => {
    const found = await readSaveProblem(res)
    report({ ...found, message: `${prefix}${found.message}` })
  }

  /** Cria o rascunho ou salva a edição. `null` = a API recusou (o motivo já está na tela). */
  const persist = async () => {
    const body = JSON.stringify(buildInput(values, campaign))
    const res = campaign
      ? await updateCampaign(campaign.id, body)
      : await createCampaign(body, idempotency.keyFor(body))
    if (!res.ok) {
      await refuse(res)
      return null
    }
    const detail = await readCampaignDetail(res)
    apply(detail)
    if (!campaign) {
      idempotency.reset()
      idRef.current = detail.id
      if (mounted.current) onCreated(detail.id)
    }
    return detail
  }

  const save = async () => {
    if (!check()) return
    if (!dirty) {
      toast.info("Nenhuma alteração para salvar.")
      return
    }
    setBusy("saving")
    try {
      if (await persist()) toast.success(campaign ? "Alterações salvas." : "Rascunho salvo.")
    } catch {
      report(problem(SAVE_UNCONFIRMED))
    } finally {
      setBusy(null)
    }
  }

  const askToPublish = () => {
    if (!check()) return
    if (!campaign && !dirty) {
      setFailure(problem("Preencha os dados da campanha antes de publicar."))
      return
    }
    setConfirmingPublish(true)
  }

  const publish = async () => {
    setConfirmingPublish(false)
    setBusy("publishing")
    const savedNow = !campaign || dirty
    let publishing = false
    try {
      const target = savedNow ? await persist() : campaign
      if (!target) return
      // Formulário fechado por outro caminho (outra rota, sessão encerrada): ninguém publica sem acompanhar
      if (!mounted.current) {
        toast.info("O rascunho foi salvo, mas a campanha não foi publicada.")
        return
      }
      publishing = true
      const res = await publishCampaign(target)
      if (!res.ok) {
        await refuse(res, savedNow ? "O rascunho foi salvo, mas a campanha não foi publicada. " : "")
        return
      }
      toast.success("Campanha publicada.")
      if (mounted.current) {
        setBusy(null) // antes de fechar: com o salvamento em andamento, a saída é segurada
        onClose()
      }
    } catch {
      report(problem(publishing
        ? "Não conseguimos falar com o servidor. Confira na lista se a campanha foi publicada."
        : SAVE_UNCONFIRMED))
    } finally {
      setBusy(null)
    }
  }

  const isDraft = !campaign || campaign.status === "DRAFT"
  const locked = busy !== null || uploading || failure?.stale === true

  const content = () => {
    if (loading) {
      return <p className="p-6 text-center text-sm text-muted-foreground" aria-busy="true">Carregando campanha...</p>
    }
    if (loadFailure === "missing") return <Unavailable text="Essa campanha não existe mais." onClose={onClose} />
    if (loadFailure) return <ErrorView code={loadFailure} layout="embedded" onRetry={reload} />
    if (campaign && !isEditable(campaign)) {
      return (
        <Unavailable
          text={`Uma campanha ${SITUATION_LABELS[situationOf(campaign)].toLowerCase()} não pode ser editada. Para repeti-la, duplique na lista.`}
          onClose={onClose}
        />
      )
    }

    return (
      <form
        noValidate
        className="space-y-6"
        onSubmit={(e) => { e.preventDefault(); if (!locked) void save() }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isDraft ? "outline" : "secondary"}>
            {campaign ? SITUATION_LABELS[situationOf(campaign)] : "Rascunho novo"}
          </Badge>
          {dirty && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
        </div>
        {campaign?.status === "PUBLISHED" && (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            Esta campanha está publicada: salvar pede o código do autenticador e muda o que a loja mostra.
          </p>
        )}

        <fieldset disabled={busy !== null} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <Field name="name" label="Nome" hint="Só aparece no painel. De 3 a 80 caracteres." error={errors.name} className="sm:col-span-2">
            {(props) => <Input {...props} value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />}
          </Field>
          <Field name="description" label="Descrição" hint="Anotação interna, até 500 caracteres." error={errors.description} className="sm:col-span-2">
            {(props) => <Textarea {...props} rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />}
          </Field>
          <Field name="type" label="Tipo" error={errors.type}>
            {(props) => (
              <select {...props} className={selectClass} value={values.type} onChange={(e) => set("type", e.target.value as CampaignType | "")}>
                <option value="">Escolha o tipo</option>
                {CAMPAIGN_TYPES.map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            )}
          </Field>
          <Field name="priority" label="Prioridade" hint="De 0 a 100. Se duas valem ao mesmo tempo, a loja mostra a maior." error={errors.priority}>
            {(props) => <Input {...props} type="number" min={0} max={100} step={1} value={values.priority} onChange={(e) => set("priority", e.target.value)} />}
          </Field>
          <DateTimeField name="startsAt" label="Início" hint="Horário de Fortaleza." error={errors.startsAt} ref={startRef} value={values.startsAt} onChange={(value) => set("startsAt", value)} />
          <DateTimeField name="endsAt" label="Fim" hint="Horário de Fortaleza. Neste instante ela já saiu do ar." error={errors.endsAt} ref={endRef} value={values.endsAt} onChange={(value) => set("endsAt", value)} />
        </fieldset>

        <fieldset disabled={busy !== null} className="min-w-0 border-t border-border pt-6">
          <ThemeEditor theme={values.theme} campaignType={values.type} errors={errors} onChange={setTheme} />
        </fieldset>

        <fieldset disabled={busy !== null} className="min-w-0 border-t border-border pt-6">
          <BannerEditor banner={values.banner} errors={errors} onChange={setBanner} onUploadingChange={trackUpload} />
        </fieldset>

        {uploading && <p className="text-right text-xs text-muted-foreground">Aguarde o envio da imagem para salvar.</p>}

        {failure && (
          <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>{failure.message}</p>
            {failure.others.length > 0 && (
              <ul className="list-disc pl-5">
                {failure.others.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
            {failure.stale && (
              <Button type="button" variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-foreground" onClick={reload}>
                Carregar a versão atual (descarta o que você digitou)
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={isDraft ? "outline" : "default"} disabled={locked}>
            {busy === "saving" ? "Salvando..." : isDraft ? "Salvar rascunho" : "Salvar alterações"}
          </Button>
          {isDraft && (
            <Button type="button" disabled={locked} onClick={askToPublish}>
              {busy === "publishing" ? "Publicando..." : "Publicar"}
            </Button>
          )}
        </div>
      </form>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CampaignsHeader
        title={initialId || campaign ? "Editar campanha" : "Nova campanha"}
        backLabel="Voltar à lista"
        onBack={onClose}
        backDisabled={busy !== null}
      />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Card>
          <CardContent>{content()}</CardContent>
        </Card>
      </main>

      <Dialog open={confirmingPublish} onOpenChange={setConfirmingPublish}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Publicar campanha?</DialogTitle>
            <DialogDescription>
              Ela passa a valer no período marcado: se o início já passou, entra no ar agora. Alterações não salvas são salvas antes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmingPublish(false)}>Voltar</Button>
            <Button type="button" onClick={() => void publish()}>Publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaving} onOpenChange={(open) => { if (!open) onStay() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Descartar alterações?</DialogTitle>
            <DialogDescription>O que você mudou nesta campanha ainda não foi salvo.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onStay}>Continuar editando</Button>
            <Button type="button" variant="destructive" onClick={onDiscard}>Descartar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DateTimeField({
  name,
  label,
  hint,
  error,
  value,
  onChange,
  ref,
}: {
  name: "startsAt" | "endsAt"
  label: string
  hint: string
  error?: string
  value: string
  onChange: (value: string) => void
  ref: ComponentProps<"input">["ref"]
}) {
  return (
    <Field name={name} label={label} hint={hint} error={error}>
      {(props) => (
        <Input
          {...props}
          ref={ref}
          type="datetime-local"
          min="2000-01-01T00:00"
          max="2099-12-31T23:59"
          className="scheme-light dark:scheme-dark"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

function Unavailable({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="space-y-4 py-4 text-center">
      <p className="text-sm">{text}</p>
      <Button type="button" variant="outline" onClick={onClose}>Voltar à lista</Button>
    </div>
  )
}
