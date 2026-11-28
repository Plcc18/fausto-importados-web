import { ArrowDown, ArrowUp, ArrowUpToLine, X } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import type { Product } from "@/lib/types"
import { formatPrice, isAvailable } from "@/admin/campaigns/collections/productFilters"
import { ProductThumb } from "@/admin/campaigns/collections/ProductThumb"

const move = (ids: readonly string[], from: number, to: number) => {
  const next = [...ids]
  const [id] = next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

/** Os produtos de uma coleção, na ordem da loja, com reordenar e tirar. */
export function CollectionProducts({
  ids,
  byId,
  errors,
  path,
  onChange,
}: {
  ids: string[]
  /** Produtos ativos; `null` enquanto o catálogo não chega. */
  byId: ReadonlyMap<string, Product> | null
  errors: Partial<Record<string, string>>
  /** Caminho dos produtos desta coleção nos erros da API (`collections[0].products`). */
  path: string
  onChange: (ids: string[]) => void
}) {
  return (
    <ol className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border">
      {ids.map((id, index) => {
        const product = byId?.get(id)
        // sem o catálogo ainda não dá para saber se o produto existe
        const name = product?.name ?? (byId ? "Produto desativado ou removido" : "Carregando...")
        const error = errors[`${path}[${index}].productId`] ?? errors[`${path}[${index}]`]
        const label = (action: string) => `${action}: ${name} (posição ${index + 1})`
        return (
          <li key={id} data-testid={`collection-product-${id}`} className="flex flex-wrap items-center gap-3 p-2">
            <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{index + 1}</span>
            <ProductThumb src={product?.image} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {product
                  ? `${product.brand} · ${formatPrice(product.price)}${isAvailable(product) ? "" : " · esgotado"}`
                  : byId && "Não aparece na loja."}
              </span>
              {error && <span className="block text-xs text-destructive">{error}</span>}
            </span>
            <span className="flex w-full shrink-0 justify-end gap-1 sm:w-auto">
              <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={label("Levar ao início")} title="Levar ao início" onClick={() => onChange(move(ids, index, 0))}>
                <ArrowUpToLine className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={label("Subir")} title="Subir" onClick={() => onChange(move(ids, index, index - 1))}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" disabled={index === ids.length - 1} aria-label={label("Descer")} title="Descer" onClick={() => onChange(move(ids, index, index + 1))}>
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={label("Tirar da coleção")} title="Tirar da coleção" onClick={() => onChange(ids.filter((other) => other !== id))}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
