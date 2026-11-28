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
import type { Product } from "@/lib/types"
import { MAX_COLLECTION_PRODUCTS } from "@/admin/campaigns/collections/collectionsDraft"
import {
  FAMILIES,
  GENDERS,
  NO_PICKER_FILTERS,
  SORTS,
  filterProducts,
  formatPrice,
  isAvailable,
  isOnSale,
  type PickerFilters,
} from "@/admin/campaigns/collections/productFilters"
import { ProductThumb } from "@/admin/campaigns/collections/ProductThumb"
import { selectClass } from "@/admin/campaigns/content/selectClass"

/**
 * Escolha de vários produtos para uma coleção. A ordem em que são marcados é a ordem em que entram nela. Montado só
 * enquanto está aberto: cada abertura começa sem filtros nem seleção.
 */
export function ProductPicker({
  title,
  products,
  current,
  onAdd,
  onClose,
}: {
  /** Nome da coleção que vai receber os produtos. */
  title: string
  products: readonly Product[]
  /** O que a coleção já tem. */
  current: readonly string[]
  onAdd: (ids: string[]) => void
  onClose: () => void
}) {
  const [filters, setFilters] = useState(NO_PICKER_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const set = (patch: Partial<PickerFilters>) => setFilters((value) => ({ ...value, ...patch }))

  const already = new Set(current)
  const shown = filterProducts(products, filters)
  const room = MAX_COLLECTION_PRODUCTS - current.length - selected.length
  const selectable = shown.filter((p) => !already.has(p.id) && !selected.includes(p.id))

  const toggle = (id: string, checked: boolean) =>
    setSelected((ids) => (checked ? [...ids, id] : ids.filter((other) => other !== id)))

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      {/* em tela baixa (celular deitado), a janela inteira rola e os botões ficam presos no rodapé */}
      <DialogContent className="flex max-h-[90dvh] flex-col gap-3 overflow-y-auto p-4 sm:max-w-[min(48rem,calc(100%-2rem))] sm:p-6">
        <DialogHeader>
          <DialogTitle>Adicionar produtos</DialogTitle>
          <DialogDescription>
            Para {title.trim() ? `“${title.trim()}”` : "esta coleção"}. Eles entram na ordem em que forem marcados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input
            type="search"
            aria-label="Buscar por nome ou marca"
            placeholder="Buscar por nome ou marca"
            className="col-span-2 sm:col-span-4"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
          <select aria-label="Gênero" className={selectClass} value={filters.gender} onChange={(e) => set({ gender: e.target.value as PickerFilters["gender"] })}>
            <option value="">Todos os gêneros</option>
            {Object.entries(GENDERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Família olfativa" className={selectClass} value={filters.family} onChange={(e) => set({ family: e.target.value })}>
            <option value="">Todas as famílias</option>
            {Object.entries(FAMILIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Ordenar por" className={selectClass} value={filters.sort} onChange={(e) => set({ sort: e.target.value as PickerFilters["sort"] })}>
            {Object.entries(SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={filters.onSale} onChange={(e) => set({ onSale: e.target.checked })} />
              Em promoção
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={filters.available} onChange={(e) => set({ available: e.target.checked })} />
              Disponíveis
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span role="status">{shown.length === 1 ? "1 produto" : `${shown.length} produtos`} na busca</span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectable.length === 0 || room === 0}
              onClick={() => setSelected((ids) => [...ids, ...selectable.slice(0, room).map((p) => p.id)])}
            >
              Marcar todos da busca
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={selected.length === 0} onClick={() => setSelected([])}>
              Desmarcar
            </Button>
          </div>
        </div>
        {room === 0 && (
          <p className="text-xs text-muted-foreground">A coleção leva até {MAX_COLLECTION_PRODUCTS} produtos.</p>
        )}

        <ul className="min-h-48 flex-1 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {shown.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">Nenhum produto com esses filtros.</li>
          )}
          {shown.map((product) => {
            const inCollection = already.has(product.id)
            const checked = inCollection || selected.includes(product.id)
            return (
              <li key={product.id}>
                <label className="flex cursor-pointer items-center gap-3 p-2 has-disabled:cursor-default has-disabled:opacity-60">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-primary"
                    checked={checked}
                    disabled={inCollection || (!checked && room === 0)}
                    onChange={(e) => toggle(product.id, e.target.checked)}
                  />
                  <ProductThumb src={product.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{product.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {product.brand} · {product.size} ml
                      {inCollection && " · já está na coleção"}
                      {!isAvailable(product) && " · esgotado"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    {formatPrice(product.price)}
                    {isOnSale(product) && <span className="block text-xs text-muted-foreground line-through">{formatPrice(product.originalPrice!)}</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <DialogFooter className="sticky -bottom-4 -mb-4 flex-row justify-end bg-background py-3 sm:-bottom-6 sm:-mb-6 sm:py-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={selected.length === 0} onClick={() => onAdd(selected)}>
            {selected.length === 0 ? "Adicionar" : selected.length === 1 ? "Adicionar 1 produto" : `Adicionar ${selected.length} produtos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
