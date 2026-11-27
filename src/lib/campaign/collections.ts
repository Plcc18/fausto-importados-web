/**
 * Coleções da campanha na loja (T24). A campanha traz só os IDs dos produtos (contrato §5.4); aqui eles são
 * cruzados com o catálogo que a loja já carregou, sem nenhuma requisição por produto.
 */
import type { Product } from "@/lib/types"
import type { CampaignType, PublicCampaign } from "./types"

export interface ResolvedCollection {
  title: string
  slug: string
  /** Na ordem da coleção, só os que estão no catálogo carregado. */
  products: Product[]
}

/**
 * Coleções com seus produtos, na ordem da campanha. Produto que não está no catálogo (desativado depois, ou
 * catálogo ainda do cache) fica de fora; coleção sem nenhum produto some (seção vazia não aparece).
 */
export function resolveCollections(campaign: PublicCampaign | null, products: readonly Product[]): ResolvedCollection[] {
  if (!campaign || campaign.collections.length === 0) return []
  const byId = new Map(products.map((product) => [product.id, product]))
  // A API já garante slug único na campanha; aqui é só defesa (vale a primeira)
  const seen = new Set<string>()
  return campaign.collections
    .filter((collection) => {
      if (seen.has(collection.slug)) return false
      seen.add(collection.slug)
      return true
    })
    .map((collection) => ({
      title: collection.title,
      slug: collection.slug,
      products: collection.productIds.flatMap((id) => byId.get(id) ?? []),
    }))
    .filter((collection) => collection.products.length > 0)
}

/** IDs dos produtos das coleções que estão na tela (para o selo). */
export function campaignProductIds(collections: readonly ResolvedCollection[]): ReadonlySet<string> {
  return new Set(collections.flatMap((collection) => collection.products.map((product) => product.id)))
}

const BADGE_LABELS: Record<CampaignType, string> = {
  BLACK_FRIDAY: "Black Friday",
  CHRISTMAS: "Natal",
  EASTER: "Páscoa",
  VALENTINES_DAY: "Dia dos Namorados",
  MOTHERS_DAY: "Dia das Mães",
  FATHERS_DAY: "Dia dos Pais",
  CONSUMER_DAY: "Dia do Consumidor",
  STORE_ANNIVERSARY: "Aniversário",
  CUSTOM: "Especial",
}

/** Texto do selo dos produtos participantes. */
export function campaignBadgeLabel(type: CampaignType): string {
  return BADGE_LABELS[type]
}
