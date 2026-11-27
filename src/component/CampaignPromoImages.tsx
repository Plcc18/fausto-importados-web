import { useState, type CSSProperties } from "react"
import { aspectRatio, cloudinarySrcSet, cloudinaryUrl } from "@/lib/campaign/image"
import type { CampaignPromoImage } from "@/lib/campaign/types"
import { CampaignLink } from "./CampaignLink"

const PROMO_WIDTHS = [480, 960, 1440] as const
/** Proporção enquanto a API não souber o tamanho real (o exemplo do contrato é quadrado). */
const DEFAULT_PROMO_RATIO = "1 / 1"
/**
 * Só a primeira carrega já (é a que mais chance tem de estar na primeira tela, logo abaixo do banner); as demais,
 * ao chegar perto. Mais imagens "já" competiriam com o banner pela internet no celular.
 */
const EAGER_COUNT = 1

interface Layout {
  /** Largura máxima do conjunto. */
  container: string
  /** Largura de cada imagem (a linha que sobra fica centralizada, nunca encostada num canto). */
  item: string
  /** Para o navegador escolher o arquivo do tamanho certo (`srcset`), já com o limite da largura máxima. */
  sizes: string
}

/**
 * O formato acompanha a quantidade de imagens que a campanha mandou (não as que carregaram: se uma falhar, as
 * outras não mudam de tamanho nem de lugar). Uma: centralizada e larga. Duas: lado a lado. Três ou mais: até três
 * por linha, com a última linha centralizada.
 */
function layoutFor(count: number): Layout {
  // Os tamanhos descontam a margem da página (`px-4`, 1rem de cada lado) e o espaço entre as imagens
  if (count === 1) return { container: "max-w-3xl", item: "w-full", sizes: "(min-width: 50rem) 48rem, calc(100vw - 2rem)" }
  if (count === 2) {
    return {
      container: "max-w-7xl",
      item: "w-full sm:w-[calc(50%-0.5rem)]",
      sizes: "(min-width: 82rem) 39.5rem, (min-width: 40rem) calc(50vw - 1.5rem), calc(100vw - 2rem)",
    }
  }
  return {
    container: "max-w-7xl",
    item: "w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]",
    sizes: "(min-width: 82rem) 26rem, (min-width: 64rem) calc(33vw - 1.33rem), (min-width: 40rem) calc(50vw - 1.5rem), calc(100vw - 2rem)",
  }
}

/**
 * Imagens de divulgação da campanha (T24): anúncios com a oferta na própria arte, logo abaixo do banner e dos
 * filtros rápidos. Reservam o espaço pela proporção. Uma imagem que falha some; sem nenhuma, a seção não aparece.
 * O espaço de cima é de quem vem antes (filtros rápidos ou hero) e o de baixo, de quem vem depois.
 */
export function CampaignPromoImages({ promoImages }: { promoImages: CampaignPromoImage[] }) {
  // Falhas por posição + URL: duas imagens com a mesma URL são itens diferentes, e uma campanha nova (outras URLs)
  // não herda as falhas da anterior
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const layout = layoutFor(promoImages.length)
  // A posição original acompanha cada imagem: chave, "carregar já" e falhas não mudam quando outra falha
  const visible = promoImages
    .map((promo, position) => ({ promo, position, id: `${promo.image.url}|${position}` }))
    .filter(({ id }) => !failed.has(id))
  if (visible.length === 0) return null

  return (
    <section aria-label="Destaques da campanha" className="px-4" data-testid="campaign-promo-images">
      <div className={`mx-auto flex flex-wrap justify-center gap-4 ${layout.container}`} data-testid="campaign-promo-grid">
        {visible.map(({ promo, position, id }) => {
          const image = (
            <img
              src={cloudinaryUrl(promo.image.url, 960)}
              srcSet={cloudinarySrcSet(promo.image, PROMO_WIDTHS)}
              sizes={layout.sizes}
              alt={promo.image.alt}
              width={promo.image.width ?? undefined}
              height={promo.image.height ?? undefined}
              loading={position < EAGER_COUNT ? "eager" : "lazy"}
              decoding="async"
              onError={() => setFailed((prev) => new Set(prev).add(id))}
              style={{ "--promo-ratio": aspectRatio(promo.image, DEFAULT_PROMO_RATIO) } as CSSProperties}
              className="block h-auto w-full rounded-xl bg-muted object-cover aspect-(--promo-ratio)"
            />
          )
          return (
            <div key={id} className={`overflow-hidden rounded-xl ${layout.item}`} data-testid="campaign-promo-item">
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
