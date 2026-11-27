import { useState, type CSSProperties } from "react"
import { aspectRatio, cloudinarySrcSet, cloudinaryUrl } from "@/lib/campaign/image"
import type { CampaignPromoImage } from "@/lib/campaign/types"
import { CampaignLink } from "./CampaignLink"

const PROMO_WIDTHS = [480, 960, 1440] as const
/** Proporção enquanto a API não souber o tamanho real (o exemplo do contrato é quadrado). */
const DEFAULT_PROMO_RATIO = "1 / 1"

/**
 * Imagens de divulgação da campanha (T24), em grade. Carregam só quando chegam perto da tela (`lazy`) e reservam
 * o espaço pela proporção. Uma imagem que falha some; sem nenhuma, a seção não aparece.
 */
export function CampaignPromoImages({ promoImages }: { promoImages: CampaignPromoImage[] }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const visible = promoImages.filter((promo) => !failed.has(promo.image.url))
  if (visible.length === 0) return null

  return (
    <section aria-label="Destaques da campanha" className="px-4 py-12 md:py-16" data-testid="campaign-promo-images">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((promo, index) => {
          const image = (
            <img
              src={cloudinaryUrl(promo.image.url, 960)}
              srcSet={cloudinarySrcSet(promo.image, PROMO_WIDTHS)}
              sizes="(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw"
              alt={promo.image.alt}
              width={promo.image.width ?? undefined}
              height={promo.image.height ?? undefined}
              loading="lazy"
              decoding="async"
              onError={() => setFailed((prev) => new Set(prev).add(promo.image.url))}
              style={{ "--promo-ratio": aspectRatio(promo.image, DEFAULT_PROMO_RATIO) } as CSSProperties}
              className="block h-auto w-full rounded-xl bg-muted object-cover aspect-(--promo-ratio)"
            />
          )
          return (
            <div key={`${promo.image.url}|${index}`} className="overflow-hidden rounded-xl">
              {promo.link ? (
                <CampaignLink link={promo.link} className="block transition-opacity hover:opacity-90">
                  {image}
                </CampaignLink>
              ) : (
                image
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
