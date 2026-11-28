import { useEffect, useState } from "react"
import { Megaphone, Plus } from "lucide-react"
import { toast } from "sonner"
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
import { Pagination } from "@/component/Pagination"
import { ErrorView } from "@/component/errors/ErrorView"
import type { ErrorCode } from "@/lib/httpErrors"
import { useIdempotencyKeys } from "@/lib/idempotency"
import { notify } from "@/lib/notice"
import { ACTIONS, explainFailure, type CampaignAction } from "@/admin/campaigns/actions"
import { errorScreenCode, listCampaigns, runCampaignAction } from "@/admin/campaigns/api"
import { CampaignFiltersBar } from "@/admin/campaigns/CampaignFiltersBar"
import { CampaignList } from "@/admin/campaigns/CampaignList"
import { CampaignsHeader } from "@/admin/campaigns/CampaignsHeader"
import { PAGE_SIZE, hasFilters, pageQuery } from "@/admin/campaigns/listQuery"
import type { CampaignPage, CampaignSummary } from "@/admin/campaigns/types"
import type { ListState } from "@/admin/campaigns/useListState"

/** Resposta da consulta identificada por `key`. */
type Result = { key: string; data: CampaignPage } | { key: string; error: ErrorCode }

const count = (total: number) => (total === 1 ? "1 campanha" : `${total} campanhas`)

/** A listagem das campanhas, com busca, filtros e ações. */
export function CampaignListView({
  list,
  onBack,
  onCreate,
  onEdit,
}: {
  list: ListState
  onBack: () => void
  onCreate: () => void
  onEdit: (id: string) => void
}) {
  const { filters, setFilters, settled, invalidPeriod, query, page, setPage } = list

  const [attempt, setAttempt] = useState(0)
  const reload = () => setAttempt((n) => n + 1)
  const requestKey = `${query}|${page}|${attempt}`
  const [result, setResult] = useState<Result | null>(null)
  const loading = result?.key !== requestKey

  const [confirming, setConfirming] = useState<{ action: CampaignAction; campaign: CampaignSummary } | null>(null)
  const [acting, setActing] = useState(false)
  const idempotency = useIdempotencyKeys()

  useEffect(() => {
    if (query === null) return
    const controller = new AbortController()
    const key = `${query}|${page}|${attempt}`
    listCampaigns(pageQuery(query, page), controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return
        // A página ficou vazia (o último item dela saiu): volta para a última que existe
        if (data.content.length === 0 && page > 0) {
          setPage(Math.max(0, Math.min(page, data.page.totalPages) - 1))
          return
        }
        setResult({ key, data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: errorScreenCode(error) })
      },
    )
    return () => controller.abort()
  }, [query, page, attempt, setPage])

  const run = async (action: CampaignAction, campaign: CampaignSummary) => {
    setConfirming(null)
    setActing(true)
    try {
      // A chave só muda depois do sucesso: repetir uma duplicação que falhou na rede não cria duas cópias
      const res = await runCampaignAction(action, campaign, () => idempotency.keyFor(campaign.id))
      if (res.ok) {
        if (action === "duplicate") idempotency.reset()
        toast.success(ACTIONS[action].done)
      } else {
        notify(await explainFailure(res, action))
      }
    } catch {
      notify({
        icon: "error",
        title: `Não foi possível ${ACTIONS[action].verb}`,
        text: "Não conseguimos falar com o servidor. Confira na lista se a ação foi feita antes de repetir.",
      })
    } finally {
      setActing(false)
      reload() // a recusa também pode vir de uma lista desatualizada
    }
  }

  const goTo = (target: number) => setPage(target - 1)

  const content = () => {
    if (query === null) {
      return <p className="p-6 text-center text-sm text-muted-foreground">Corrija o período para ver as campanhas.</p>
    }
    // Durante uma atualização a lista anterior continua na tela, esmaecida
    if (result && "data" in result) {
      const { data } = result
      if (data.content.length === 0) {
        if (loading) return <Loading />
        return (
          <div className="p-6 text-center">
            <Megaphone className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-lg font-medium">
              {hasFilters(settled) ? "Nenhuma campanha encontrada com esses filtros." : "Nenhuma campanha cadastrada."}
            </p>
          </div>
        )
      }
      return (
        <div aria-busy={loading} className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <p role="status" className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
            {loading ? "Atualizando..." : count(data.page.totalElements)}
          </p>
          <CampaignList
            campaigns={data.content}
            disabled={acting || loading}
            onEdit={(campaign) => onEdit(campaign.id)}
            onAction={(action, campaign) => setConfirming({ action, campaign })}
          />
          <Pagination
            page={page + 1}
            totalPages={data.page.totalPages}
            totalItems={data.page.totalElements}
            pageSize={PAGE_SIZE}
            onPrev={() => goTo(page)}
            onNext={() => goTo(page + 2)}
            onGoTo={goTo}
          />
        </div>
      )
    }
    if (result && !loading) return <ErrorView code={result.error} layout="embedded" onRetry={reload} />
    return <Loading />
  }

  return (
    <div className="min-h-screen bg-background">
      <CampaignsHeader title="Campanhas" backLabel="Voltar ao painel" onBack={onBack}>
        <Button className="gap-1 px-2 sm:px-4" onClick={onCreate} aria-label="Nova campanha">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Nova campanha</span>
        </Button>
      </CampaignsHeader>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <CampaignFiltersBar filters={filters} periodError={invalidPeriod} onChange={setFilters} />
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">{content()}</CardContent>
        </Card>
      </main>

      <Dialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null) }}>
        <DialogContent className="max-w-sm">
          {confirming && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTIONS[confirming.action].question}</DialogTitle>
                <DialogDescription className="break-words">
                  {ACTIONS[confirming.action].explain(confirming.campaign)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirming(null)}>Cancelar</Button>
                <Button
                  type="button"
                  variant={ACTIONS[confirming.action].destructive ? "destructive" : "default"}
                  onClick={() => void run(confirming.action, confirming.campaign)}
                >
                  {ACTIONS[confirming.action].label}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Loading() {
  return <p className="p-6 text-center text-sm text-muted-foreground" aria-busy="true">Carregando campanhas...</p>
}
