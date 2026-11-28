import { useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { CampaignEditor } from "@/admin/campaigns/CampaignEditor"
import { CampaignListView } from "@/admin/campaigns/CampaignListView"
import { useListState } from "@/admin/campaigns/useListState"
import { ROUTES } from "@/routes"

/** Qual tela o endereço pede: `?nova`, `?editar=<id>` ou, sem nenhum dos dois, a lista (`null`). */
type Target = { id: string | null } | null

const targetKey = (params: URLSearchParams) =>
  params.has("nova") ? "nova" : params.get("editar") ? `editar:${params.get("editar")}` : "lista"

const targetFrom = (key: string): Target =>
  key === "lista" ? null : { id: key === "nova" ? null : key.slice("editar:".length) }

/**
 * Área de campanhas sazonais do painel. Só abre para administradores (`RequireAdmin`, em `App.tsx`).
 *
 * A lista e o formulário ficam na mesma rota, separados pela query string: o botão voltar do navegador funciona e,
 * como esta tela continua montada, dá para perguntar antes de descartar alterações não salvas.
 */
export function Campaigns() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const requested = targetKey(params)
  const list = useListState()

  /** A tela aberta. `alias` = endereço que o rascunho novo ganhou ao ser criado: é o mesmo formulário. */
  const [open, setOpen] = useState<{ key: string; alias?: string; serial: number }>({ key: requested, serial: 0 })
  const [dirty, setDirty] = useState(false)
  const elsewhere = requested !== open.key && requested !== open.alias
  // Mudou o endereço sem nada a perder: troca de tela (ajuste durante a renderização)
  if (elsewhere && !dirty) setOpen({ key: requested, serial: open.serial + 1 })

  const fromList = (location.state as { fromList?: boolean } | null)?.fromList === true
  const show = (query: Record<string, string>) => setParams(query, { state: { fromList: true } })

  const close = () => {
    if (fromList) navigate(-1)
    else setParams({}, { replace: true })
  }

  const editorUrl = (): Record<string, string> => {
    const current = targetFrom(open.alias ?? open.key)
    return current?.id ? { editar: current.id } : { nova: "" }
  }

  const target = targetFrom(open.key)
  if (!target) {
    return (
      <CampaignListView
        list={list}
        onBack={() => navigate(ROUTES.admin)}
        onCreate={() => show({ nova: "" })}
        onEdit={(id) => show({ editar: id })}
      />
    )
  }

  return (
    <CampaignEditor
      key={open.serial}
      initialId={target.id}
      leaving={elsewhere && dirty}
      onStay={() => show(editorUrl())}
      onDiscard={() => setDirty(false)}
      onDirtyChange={setDirty}
      onCreated={(id) => {
        setOpen((current) => ({ ...current, alias: `editar:${id}` }))
        setParams({ editar: id }, { replace: true, state: location.state })
      }}
      onClose={close}
    />
  )
}
