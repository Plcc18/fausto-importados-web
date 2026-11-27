import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import type { Product } from "@/lib/types"
import type { ResolvedCollection } from "@/lib/campaign/collections"
import { Button } from "@/Shadcn-Components/ui/button"

/** Quantos produtos cada seção mostra antes do "Ver todos". */
export const COLLECTION_PREVIEW_SIZE = 4

interface CampaignCollectionsProps {
  /** Já cruzadas com o catálogo e sem as vazias (`resolveCollections`). */
  collections: ResolvedCollection[]
  /** O card de cada produto vem da loja, com o mesmo carrinho e favoritos da vitrine. */
  renderProduct: (product: Product) => ReactNode
  /** "Ver todos": a loja filtra a vitrine pela coleção (`?colecao=`). */
  onShowAll: (slug: string) => void
}

/** Seções das coleções da campanha, entre o banner e a vitrine (T24). Sem coleções, não aparece nada. */
export function CampaignCollections({ collections, renderProduct, onShowAll }: CampaignCollectionsProps) {
  if (collections.length === 0) return null
  return (
    <div className="space-y-16 px-4 py-12 md:py-16" data-testid="campaign-collections">
      {collections.map((collection) => {
        const headingId = `colecao-${collection.slug}`
        return (
          <section key={collection.slug} aria-labelledby={headingId} className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 id={headingId} className="font-serif text-2xl font-medium tracking-tight md:text-3xl">
                {collection.title}
              </h2>
              <Button variant="ghost" className="shrink-0" onClick={() => onShowAll(collection.slug)}>
                Ver todos ({collection.products.length})
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {collection.products.slice(0, COLLECTION_PREVIEW_SIZE).map((product) => (
                <div key={product.id}>{renderProduct(product)}</div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
