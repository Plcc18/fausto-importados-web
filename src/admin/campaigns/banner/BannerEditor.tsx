import { useState } from "react"
import { Button } from "@/Shadcn-Components/ui/button"
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
import { ImageUploader } from "@/admin/images/ImageUploader"
import { EMPTY_BANNER, type BannerDraft, type ImageDraft } from "@/admin/campaigns/banner/bannerDraft"

/** Tamanhos recomendados: as mesmas proporções que a loja reserva para o banner (`lib/campaign/image.ts`). */
const SLOTS = [
  {
    key: "desktop",
    field: "content.hero.imageDesktop",
    label: "Imagem do computador",
    altLabel: "Texto alternativo (computador)",
    width: 1920,
    height: 640,
    hint: "Recomendado: 1920 × 640 px (3:1). Obrigatória para publicar.",
    preview: "aspect-3/1",
  },
  {
    key: "mobile",
    field: "content.hero.imageMobile",
    label: "Imagem do celular",
    altLabel: "Texto alternativo (celular)",
    width: 1080,
    height: 1350,
    hint: "Opcional. Recomendado: 1080 × 1350 px (4:5). Sem ela, o celular usa a do computador.",
    preview: "mx-auto aspect-4/5 max-w-56",
  },
] as const

function sizeNote({ width, height }: ImageDraft, recommended: number) {
  if (!width || !height) return null
  const small = width < recommended ? " Menor que o recomendado: pode ficar borrada." : ""
  return `Enviada: ${width} × ${height} px.${small}`
}

/** Banner principal da campanha: título e as imagens de computador e celular. */
export function BannerEditor({
  banner,
  errors,
  onChange,
  onUploadingChange,
}: {
  banner: BannerDraft | null
  errors: Partial<Record<string, string>>
  /**
   * Recebe a alteração como função, porque o envio de uma imagem termina depois de outras mudanças.
   * @param changed caminhos alterados, cujos erros deixam de valer
   */
  onChange: (update: (current: BannerDraft | null) => BannerDraft | null, changed: string[]) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const [removing, setRemoving] = useState(false)
  const patch = (change: (current: BannerDraft) => Partial<BannerDraft>, ...changed: string[]) =>
    onChange((current) => current && { ...current, ...change(current) }, changed)
  const sectionError = errors["content.hero"]

  return (
    <section aria-labelledby="banner-title-heading" className="space-y-4">
      <div>
        <h2 id="banner-title-heading" className="font-semibold">Banner principal</h2>
        <p className="text-xs text-muted-foreground">
          Substitui o destaque da loja enquanto a campanha estiver no ar. O título aparece sobre a imagem no computador
          e abaixo dela no celular.
        </p>
      </div>
      {sectionError && <p className="text-sm text-destructive">{sectionError}</p>}

      {!banner ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border px-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">Sem banner, a loja mostra o destaque de sempre.</p>
          <Button type="button" variant="outline" onClick={() => onChange(() => EMPTY_BANNER, ["content.hero"])}>
            Adicionar banner
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="banner-title">Título do banner</Label>
            <Input
              id="banner-title"
              autoComplete="off"
              aria-invalid={!!errors["content.hero.title"]}
              aria-describedby="banner-title-note"
              value={banner.title}
              onChange={(e) => {
                const title = e.target.value
                patch(() => ({ title }), "content.hero.title")
              }}
            />
            <p id="banner-title-note" className={`text-xs ${errors["content.hero.title"] ? "text-destructive" : "text-muted-foreground"}`}>
              {errors["content.hero.title"] ?? "É o título principal da loja. Até 80 caracteres."}
            </p>
          </div>

          <div className="grid items-start gap-6 md:grid-cols-2">
            {SLOTS.map((slot) => {
              const image = banner[slot.key]
              const note = image && sizeNote(image, slot.width)
              const altError = errors[`${slot.field}.alt`]
              const altId = `banner-${slot.key}-alt`
              return (
                <div key={slot.key} className="min-w-0 space-y-3">
                  <ImageUploader
                    label={slot.label}
                    kind="campaign"
                    value={image?.url ?? ""}
                    previewAlt={image?.alt || `Prévia: ${slot.label.toLowerCase()}`}
                    previewClassName={slot.preview}
                    hint={note ? `${slot.hint} ${note}` : slot.hint}
                    error={errors[slot.field] ?? errors[`${slot.field}.url`]}
                    onUploadingChange={onUploadingChange}
                    onChange={(uploaded) =>
                      patch(
                        (current) => ({
                          // a descrição continua ao trocar a imagem: a pessoa revisa se precisar
                          [slot.key]: uploaded && {
                            url: uploaded.url,
                            alt: current[slot.key]?.alt ?? "",
                            width: uploaded.width,
                            height: uploaded.height,
                          },
                        }),
                        slot.field,
                      )
                    }
                  />
                  {image && (
                    <div className="space-y-2">
                      <Label htmlFor={altId}>{slot.altLabel}</Label>
                      <Input
                        id={altId}
                        autoComplete="off"
                        aria-invalid={!!altError}
                        aria-describedby={`${altId}-note`}
                        value={image.alt}
                        onChange={(e) => {
                          const alt = e.target.value
                          patch(
                            (current) => ({ [slot.key]: current[slot.key] && { ...current[slot.key]!, alt } }),
                            `${slot.field}.alt`,
                          )
                        }}
                      />
                      <p id={`${altId}-note`} className={`text-xs ${altError ? "text-destructive" : "text-muted-foreground"}`}>
                        {altError ?? "Descreve a imagem para quem não a vê. Até 150 caracteres."}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => setRemoving(true)}>Remover banner</Button>
        </>
      )}

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover o banner?</DialogTitle>
            <DialogDescription>
              O título, as imagens e o que mais houver no banner saem desta campanha. A loja volta ao destaque de sempre.
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
    </section>
  )
}
