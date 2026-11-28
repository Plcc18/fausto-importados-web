import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Shadcn-Components/ui/dialog"
import { Label } from "@/Shadcn-Components/ui/label"
import { BUTTON_STYLES, type ButtonStyle } from "@/lib/campaign/types"
import {
  BUTTON_STYLE_LABELS,
  EMPTY_BANNER,
  MAX_BUTTONS,
  type BannerDraft,
  type ButtonDraft,
} from "@/admin/campaigns/content/bannerDraft"
import { newKey } from "@/admin/campaigns/content/contentDraft"
import type { LinkSuggestion } from "@/admin/campaigns/content/fields"
import { ImageSlot } from "@/admin/campaigns/content/ImageSlot"
import { EmptyPart, Section } from "@/admin/campaigns/content/Section"
import { selectClass } from "@/admin/campaigns/content/selectClass"
import { LinkField, TextField } from "@/admin/campaigns/content/TextField"

/** Tamanhos recomendados: as mesmas proporções que a loja reserva para o banner (`lib/campaign/image.ts`). */
const SLOTS = [
  {
    key: "desktop",
    field: "content.hero.imageDesktop",
    label: "Imagem do computador",
    altLabel: "Texto alternativo (computador)",
    width: 1920,
    hint: "Recomendado: 1920 × 640 px (3:1). Obrigatória para publicar.",
    preview: "aspect-3/1",
  },
  {
    key: "mobile",
    field: "content.hero.imageMobile",
    label: "Imagem do celular",
    altLabel: "Texto alternativo (celular)",
    width: 1080,
    hint: "Opcional. Recomendado: 1080 × 1350 px (4:5). Sem ela, o celular usa a do computador.",
    preview: "mx-auto aspect-4/5 max-w-56",
  },
] as const

/** Banner principal da campanha: textos, imagens de computador e celular e botões. */
export function BannerEditor({
  banner,
  errors,
  suggestions,
  onChange,
  onUploadingChange,
}: {
  banner: BannerDraft | null
  errors: Partial<Record<string, string>>
  suggestions: readonly LinkSuggestion[]
  /**
   * Recebe a alteração como função, porque o envio de uma imagem termina depois de outras mudanças.
   * @param changed caminhos alterados, cujos erros deixam de valer
   */
  onChange: (update: (current: BannerDraft | null) => BannerDraft | null, changed: string[]) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const [removing, setRemoving] = useState(false)
  const patch = (change: (current: BannerDraft) => Partial<BannerDraft>, changed: string) =>
    onChange((current) => current && { ...current, ...change(current) }, [changed])
  const patchButton = (key: string, change: Partial<ButtonDraft>, changed: string) =>
    patch((current) => ({ buttons: current.buttons.map((b) => (b.key === key ? { ...b, ...change } : b)) }), changed)

  return (
    <Section
      title="Banner principal"
      description="Substitui o destaque da loja enquanto a campanha estiver no ar. Os textos aparecem sobre a imagem no computador e abaixo dela no celular."
      error={errors["content.hero"]}
    >
      {!banner ? (
        <EmptyPart
          text="Sem banner, a loja mostra o destaque de sempre."
          action="Adicionar banner"
          onAdd={() => onChange(() => EMPTY_BANNER, ["content.hero"])}
        />
      ) : (
        <>
          <TextField
            label="Título do banner"
            value={banner.title}
            error={errors["content.hero.title"]}
            hint="É o título principal da loja. Até 80 caracteres."
            onChange={(title) => patch(() => ({ title }), "content.hero.title")}
          />
          <TextField
            label="Subtítulo do banner"
            value={banner.subtitle}
            error={errors["content.hero.subtitle"]}
            hint="Opcional. Até 160 caracteres."
            onChange={(subtitle) => patch(() => ({ subtitle }), "content.hero.subtitle")}
          />

          <div className="grid items-start gap-6 md:grid-cols-2">
            {SLOTS.map((slot) => (
              <ImageSlot
                key={slot.key}
                label={slot.label}
                altLabel={slot.altLabel}
                hint={slot.hint}
                recommendedWidth={slot.width}
                previewClassName={slot.preview}
                image={banner[slot.key]}
                path={slot.field}
                errors={errors}
                onUploadingChange={onUploadingChange}
                onChange={(update, changed) => patch((current) => ({ [slot.key]: update(current[slot.key]) }), changed)}
              />
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Botões</h3>
            {errors["content.hero.buttons"] && <p className="text-sm text-destructive">{errors["content.hero.buttons"]}</p>}
            {banner.buttons.map((button, index) => {
              const path = `content.hero.buttons[${index}]`
              return (
                <fieldset key={button.key} className="space-y-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-medium">Botão {index + 1}</legend>
                  <div className="grid items-start gap-3 sm:grid-cols-2">
                    <TextField
                      label={`Texto do botão ${index + 1}`}
                      value={button.label}
                      error={errors[`${path}.label`]}
                      hint="Até 30 caracteres."
                      onChange={(label) => patchButton(button.key, { label }, `${path}.label`)}
                    />
                    <LinkField
                      label={`Link do botão ${index + 1}`}
                      value={button.link}
                      error={errors[`${path}.link`]}
                      suggestions={suggestions}
                      onChange={(link) => patchButton(button.key, { link }, `${path}.link`)}
                    />
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`button-style-${button.key}`}>Estilo do botão {index + 1}</Label>
                      <select
                        id={`button-style-${button.key}`}
                        className={`${selectClass} w-44`}
                        value={button.style}
                        onChange={(e) => patchButton(button.key, { style: e.target.value as ButtonStyle }, `${path}.style`)}
                      >
                        {BUTTON_STYLES.map((style) => (
                          <option key={style} value={style}>{BUTTON_STYLE_LABELS[style]}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      // os erros são por posição: tirar um botão invalida os de todos
                      onClick={() =>
                        patch(
                          (current) => ({ buttons: current.buttons.filter((b) => b.key !== button.key) }),
                          "content.hero.buttons",
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remover botão {index + 1}
                    </Button>
                  </div>
                </fieldset>
              )
            })}
            {banner.buttons.length < MAX_BUTTONS ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  patch(
                    (current) => ({
                      buttons: [
                        ...current.buttons,
                        { key: newKey(), label: "", link: "", style: current.buttons.length === 0 ? "PRIMARY" : "SECONDARY" },
                      ],
                    }),
                    "content.hero.buttons",
                  )
                }
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar botão
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">O banner leva até {MAX_BUTTONS} botões.</p>
            )}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => setRemoving(true)}>Remover banner</Button>
        </>
      )}

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover o banner?</DialogTitle>
            <DialogDescription>
              Os textos, as imagens e os botões do banner saem desta campanha. A loja volta ao destaque de sempre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoving(false)}>Cancelar</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { onChange(() => null, ["content.hero"]); setRemoving(false) }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
