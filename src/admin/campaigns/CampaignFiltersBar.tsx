import type { ReactNode } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/campaign/types"
import { SITUATIONS, SITUATION_LABELS, TYPE_LABELS, type Situation } from "@/admin/campaigns/labels"
import { NO_FILTERS, hasFilters, type ListFilters } from "@/admin/campaigns/listQuery"

// `color-scheme` faz o navegador desenhar o calendário e as opções nas cores do tema
const control =
  "h-9 w-full min-w-0 rounded-full border border-border bg-background px-3 text-sm transition-colors scheme-light dark:scheme-dark hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive"

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

/** Busca e filtros da listagem. */
export function CampaignFiltersBar({
  filters,
  periodError,
  onChange,
}: {
  filters: ListFilters
  periodError: string | null
  onChange: (filters: ListFilters) => void
}) {
  const set = (patch: Partial<ListFilters>) => onChange({ ...filters, ...patch })

  return (
    <div role="search" className="space-y-2">
      <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <Field label="Buscar" className="col-span-2 lg:col-span-1">
          <span className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              className={`${control} pl-9`}
              placeholder="Nome da campanha"
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
            />
          </span>
        </Field>
        <Field label="Situação">
          <select className={control} value={filters.situation} onChange={(e) => set({ situation: e.target.value as Situation | "" })}>
            <option value="">Todas</option>
            {SITUATIONS.map((situation) => (
              <option key={situation} value={situation}>{SITUATION_LABELS[situation]}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select className={control} value={filters.type} onChange={(e) => set({ type: e.target.value as CampaignType | "" })}>
            <option value="">Todos</option>
            {CAMPAIGN_TYPES.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
        </Field>
        <Field label="Período: de">
          <input
            type="date" className={control} min="2000-01-01" max="2099-12-31" aria-invalid={periodError !== null}
            value={filters.from} onChange={(e) => set({ from: e.target.value })}
          />
        </Field>
        <Field label="Período: até">
          <input
            type="date" className={control} min="2000-01-01" max="2099-12-31" aria-invalid={periodError !== null}
            value={filters.to} onChange={(e) => set({ to: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {periodError ? (
          <p role="alert" className="text-xs text-destructive">{periodError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            O período mostra as campanhas que passam por essas datas; rascunhos sem datas ficam de fora.
          </p>
        )}
        {hasFilters(filters) && (
          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => onChange(NO_FILTERS)}>
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
