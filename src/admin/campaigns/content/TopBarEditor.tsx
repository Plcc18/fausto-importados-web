import type { CSSProperties } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { TOP_BAR_COMFORT, TOP_BAR_MAX, type TopBarDraft } from "@/admin/campaigns/content/contentDraft"
import type { LinkSuggestion } from "@/admin/campaigns/content/fields"
import { EmptyPart, Section } from "@/admin/campaigns/content/Section"
import { LinkField, TextField } from "@/admin/campaigns/content/TextField"
import { previewVariables } from "@/admin/campaigns/theme/storePalette"
import type { PaletteDraft } from "@/admin/campaigns/theme/themeDraft"

/** Caracteres como a API conta: um emoji vale um. */
const length = (text: string) => [...text.trim()].length

/**
 * A faixa como aparece no celular: as mesmas classes de `StoreTopBar` para telas estreitas, numa largura de telefone
 * e com as cores do modo escuro da campanha.
 */
function MobilePreview({ topBar, palette }: { topBar: TopBarDraft; palette: PaletteDraft | null }) {
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs text-muted-foreground">Prévia no celular</figcaption>
      <div
        data-testid="top-bar-preview"
        style={previewVariables("dark", palette) as CSSProperties}
        className="w-full max-w-90 overflow-hidden rounded-lg border border-border bg-primary text-primary-foreground"
      >
        <div className="line-clamp-2 px-4 py-2 text-center text-xs font-medium tracking-wide text-balance break-words">
          <span className={topBar.link.trim() ? "underline underline-offset-4" : ""}>
            {topBar.text.trim() || "Texto da faixa"}
          </span>
        </div>
      </div>
    </figure>
  )
}

/** Faixa superior da loja. */
export function TopBarEditor({
  topBar,
  palette,
  errors,
  suggestions,
  onChange,
}: {
  topBar: TopBarDraft | null
  /** Paleta escura em edição, para a prévia. */
  palette: PaletteDraft | null
  errors: Partial<Record<string, string>>
  suggestions: readonly LinkSuggestion[]
  onChange: (update: (current: TopBarDraft | null) => TopBarDraft | null, changed: string[]) => void
}) {
  const patch = (change: Partial<TopBarDraft>, field: string) =>
    onChange((current) => current && { ...current, ...change }, [field])
  const size = topBar ? length(topBar.text) : 0

  return (
    <Section
      title="Faixa superior"
      description="Texto curto no topo da loja, na cor de destaque, também no celular."
      error={errors["content.topBar"]}
    >
      {!topBar ? (
        <EmptyPart
          text="Sem faixa, a loja mostra a de sempre, só no computador."
          action="Adicionar faixa"
          onAdd={() => onChange(() => ({ text: "", link: "" }), ["content.topBar"])}
        />
      ) : (
        <>
          <TextField
            label="Texto da faixa"
            value={topBar.text}
            error={errors["content.topBar.text"]}
            hint={`${size} de ${TOP_BAR_MAX} caracteres.`}
            onChange={(text) => patch({ text }, "content.topBar.text")}
          />
          {size > TOP_BAR_COMFORT && (
            <p role="status" className="flex items-start gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              No celular a faixa mostra no máximo 2 linhas (cerca de {TOP_BAR_COMFORT} caracteres): o final pode ficar
              cortado.
            </p>
          )}
          <LinkField
            label="Link da faixa"
            optional
            value={topBar.link}
            error={errors["content.topBar.link"]}
            suggestions={suggestions}
            onChange={(link) => patch({ link }, "content.topBar.link")}
          />
          <MobilePreview topBar={topBar} palette={palette} />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(() => null, ["content.topBar"])}>
            Remover faixa
          </Button>
        </>
      )}
    </Section>
  )
}
