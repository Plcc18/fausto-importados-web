import type { CSSProperties } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { CampaignPromoImages } from "@/component/CampaignPromoImages"
import { MAX_PROMO_IMAGES, newKey, type PromoDraft } from "@/admin/campaigns/content/contentDraft"
import type { ImageDraft, LinkSuggestion } from "@/admin/campaigns/content/fields"
import { ImageSlot } from "@/admin/campaigns/content/ImageSlot"
import { EmptyPart, Section } from "@/admin/campaigns/content/Section"
import { LinkField } from "@/admin/campaigns/content/TextField"
import { previewVariables } from "@/admin/campaigns/theme/storePalette"
import type { PaletteDraft } from "@/admin/campaigns/theme/themeDraft"

const LIST = "content.promoImages"

/** O banner (em miniatura) seguido das imagens, desenhadas pelo mesmo componente da loja. */
function StorePreview({
  promoImages,
  banner,
  palette,
}: {
  promoImages: PromoDraft[]
  banner: ImageDraft | null
  palette: PaletteDraft | null
}) {
  // sem links: a prévia não leva a lugar nenhum
  const images = promoImages.flatMap(({ image }) => (image ? [{ image, link: null }] : []))
  if (images.length === 0) return null
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs text-muted-foreground">Como fica abaixo do banner</figcaption>
      <div
        data-testid="promo-preview"
        style={previewVariables("dark", palette) as CSSProperties}
        className="space-y-4 overflow-hidden rounded-xl border border-border bg-background pb-4 text-foreground"
      >
        {banner ? (
          <img src={banner.url} alt="" className="aspect-3/1 w-full object-cover" />
        ) : (
          <div className="flex aspect-5/1 items-center justify-center bg-muted text-xs text-muted-foreground">Banner</div>
        )}
        <CampaignPromoImages promoImages={images} />
      </div>
    </figure>
  )
}

/** Imagens de divulgação, na ordem em que a loja as mostra. */
export function PromoImagesEditor({
  promoImages,
  banner,
  palette,
  errors,
  suggestions,
  onChange,
  onUploadingChange,
}: {
  promoImages: PromoDraft[]
  /** Imagem de computador do banner, para a prévia. */
  banner: ImageDraft | null
  palette: PaletteDraft | null
  errors: Partial<Record<string, string>>
  suggestions: readonly LinkSuggestion[]
  onChange: (update: (current: PromoDraft[]) => PromoDraft[], changed: string[]) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const patch = (key: string, change: (item: PromoDraft) => Partial<PromoDraft>, changed: string) =>
    onChange((current) => current.map((item) => (item.key === key ? { ...item, ...change(item) } : item)), [changed])

  // os erros são por posição: mudar a lista invalida os de todas as imagens
  const move = (index: number, step: -1 | 1) =>
    onChange((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + step, 0, item)
      return next
    }, [LIST])

  const add = () => onChange((current) => [...current, { key: newKey(), image: null, link: "" }], [LIST])

  return (
    <Section
      title="Imagens de divulgação"
      description={`Aparecem logo abaixo do banner, na ordem desta lista (até ${MAX_PROMO_IMAGES}). Use artes com a oferta escrita na própria imagem, como “Frete grátis acima de R$ 299” ou “Kits a partir de R$ 199”: uma foto sem texto ali parece solta.`}
      error={errors[LIST]}
    >
      {promoImages.length === 0 ? (
        <EmptyPart text="Sem imagens, nada aparece nesse lugar." action="Adicionar imagem" onAdd={add} />
      ) : (
        <>
          <ol className="space-y-3">
            {promoImages.map((item, index) => {
              const number = index + 1
              const path = `${LIST}[${index}]`
              return (
                <li key={item.key} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="grid items-start gap-4 md:grid-cols-2">
                    <ImageSlot
                      label={`Imagem de divulgação ${number}`}
                      altLabel={`Texto alternativo da imagem ${number}`}
                      hint="Use a mesma proporção em todas (por exemplo, 1080 × 1080 px)."
                      recommendedWidth={960}
                      previewClassName="mx-auto aspect-square max-w-56"
                      image={item.image}
                      path={`${path}.image`}
                      errors={errors}
                      onUploadingChange={onUploadingChange}
                      onChange={(update, changed) => patch(item.key, (current) => ({ image: update(current.image) }), changed)}
                    />
                    <div className="space-y-3">
                      <LinkField
                        label={`Link da imagem ${number}`}
                        optional
                        value={item.link}
                        error={errors[`${path}.link`]}
                        suggestions={suggestions}
                        onChange={(link) => patch(item.key, () => ({ link }), `${path}.link`)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir imagem ${number}`}>
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> Subir
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={number === promoImages.length} onClick={() => move(index, 1)} aria-label={`Descer imagem ${number}`}>
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> Descer
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onChange((current) => current.filter((other) => other.key !== item.key), [LIST])}
                          aria-label={`Tirar imagem ${number} da lista`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Tirar da lista
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {promoImages.length < MAX_PROMO_IMAGES && (
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar imagem
            </Button>
          )}
          <StorePreview promoImages={promoImages} banner={banner} palette={palette} />
        </>
      )}
    </Section>
  )
}
