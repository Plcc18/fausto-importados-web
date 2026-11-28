import type { CSSProperties } from "react"
import { previewVariables } from "@/admin/campaigns/theme/storePalette"
import type { PaletteDraft, ThemeMode } from "@/admin/campaigns/theme/themeDraft"

/**
 * Miniatura da loja com a paleta em edição. As variáveis valem só dentro dela, e as classes são as mesmas dos
 * componentes da loja. Nada aqui é clicável, e não há variantes `dark:` (o modo é o da paleta, não o do painel).
 */
export function ThemePreview({ mode, palette }: { mode: ThemeMode; palette: PaletteDraft | null }) {
  return (
    <div
      role="img"
      aria-label={`Prévia da loja no modo ${mode === "dark" ? "escuro" : "claro"}`}
      data-testid="theme-preview"
      style={previewVariables(mode, palette) as CSSProperties}
      className="overflow-hidden rounded-xl border border-border bg-background text-foreground select-none"
    >
      <p className="bg-primary px-3 py-1.5 text-center text-[11px] font-medium text-primary-foreground">Faixa da campanha</p>
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <span className="text-gold-metal font-serif text-lg italic">Fausto</span>
        <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] text-accent-foreground">Menu</span>
      </div>
      <div className="space-y-2 px-3 py-4 text-center">
        <p className="font-serif text-xl">
          Fragrâncias que <span className="text-gold-metal italic">marcam</span>
        </p>
        <p className="text-xs text-muted-foreground">Texto de apoio da campanha</p>
        <div className="flex justify-center gap-2">
          <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground">Ver ofertas</span>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground">Coleção</span>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="mx-auto max-w-44 overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
          <div className="relative h-20 bg-white">
            <span className="absolute top-2 right-2 rounded-full bg-campaign-badge px-2 py-0.5 text-[10px] font-medium text-campaign-badge-foreground">
              Oferta
            </span>
          </div>
          <div className="space-y-1 p-2">
            <p className="text-[10px] tracking-wider text-muted-foreground uppercase">Marca</p>
            <p className="text-xs font-medium">Perfume de exemplo</p>
            <p className="text-sm font-semibold">R$ 249,90</p>
            <span className="block rounded-full bg-primary py-1 text-center text-[11px] font-medium text-primary-foreground">Adicionar</span>
          </div>
        </div>
      </div>
    </div>
  )
}
