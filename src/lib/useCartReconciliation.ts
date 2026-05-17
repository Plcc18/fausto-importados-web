import { useEffect, useRef } from "react"
import type { CartItem, Product } from "@/lib/types"
import { API_URL } from "@/lib/api"

/**
 * Reconciles the local cart against live backend data.
 *
 * Calls setCart with the reconciled list and setStockChangedIds with the
 * IDs of products whose quantity was clamped due to stock changes — so the
 * UI can show a targeted warning to the user.
 */
export function useCartReconciliation(
  cart: CartItem[],
  setCart: (items: CartItem[]) => void,
  triggerKey: unknown,
  setStockChangedIds?: (ids: string[]) => void
) {
  const isFetching = useRef(false)

  useEffect(() => {
    if (isFetching.current || cart.length === 0) return
    isFetching.current = true

    fetch(`${API_URL}/api/product`)
      .then((r) => r.json())
      .then((data: { content: Product[] }) => {
        const productMap = new Map<string, Product>(
          data.content.map((p) => [p.id, p])
        )

        let changed = false
        const reconciled: CartItem[] = []
        const changedIds: string[] = []

        for (const item of cart) {
          const live = productMap.get(item.product.id)

          if (!live) {
            changed = true
            changedIds.push(item.product.id)
            continue
          }

          const priceChanged = live.price !== item.product.price
          const stockChanged = live.stockQuantity !== item.product.stockQuantity
          const inStockChanged = live.inStock !== item.product.inStock
          const imageChanged = live.image !== item.product.image
          const nameChanged = live.name !== item.product.name

          const anyChange =
            priceChanged || stockChanged || inStockChanged || imageChanged || nameChanged

          const maxQty =
            live.stockQuantity !== undefined && live.stockQuantity !== null
              ? live.stockQuantity
              : item.quantity
          const newQty = Math.min(item.quantity, Math.max(maxQty, 0))

          // Marca como "changed" somente quando a QUANTIDADE foi reduzida por estoque
          if (newQty !== item.quantity) {
            changed = true
            changedIds.push(item.product.id)
          } else if (anyChange) {
            changed = true
          }

          reconciled.push({
            product: anyChange ? { ...item.product, ...live } : item.product,
            quantity: newQty,
          })
        }

        if (changed) {
          localStorage.setItem("perfumaria_cart", JSON.stringify(reconciled))
          setCart(reconciled)
          if (changedIds.length > 0) {
            setStockChangedIds?.(changedIds)
          }
        }
      })
      .catch(() => {
        // Network error — keep cart as-is
      })
      .finally(() => {
        isFetching.current = false
      })
  }, [triggerKey]) // eslint-disable-line react-hooks/exhaustive-deps
}