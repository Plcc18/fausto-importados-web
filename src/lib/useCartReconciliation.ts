import { useEffect, useRef } from "react"
import type { CartItem, Product } from "@/lib/types"
import { API_URL } from "@/lib/api"

/**
 * Reconciles the local cart against live backend data.
 *
 * On mount (and whenever the cart is opened), fetches /api/product and:
 * - Updates price, name, image, inStock, stockQuantity from the backend.
 * - Clamps quantity to stockQuantity if the backend has less.
 * - Removes items whose product no longer exists in the backend.
 *
 * Calls setCart with the reconciled list only when something actually changed.
 */
export function useCartReconciliation(
  cart: CartItem[],
  setCart: (items: CartItem[]) => void,
  triggerKey: unknown // pass `isCartOpen` so it re-runs when user opens cart
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

        for (const item of cart) {
          const live = productMap.get(item.product.id)

          // Product removed from backend → drop from cart
          if (!live) {
            changed = true
            continue
          }

          // Detect any field change
          const priceChanged = live.price !== item.product.price
          const stockChanged = live.stockQuantity !== item.product.stockQuantity
          const inStockChanged = live.inStock !== item.product.inStock
          const imageChanged = live.image !== item.product.image
          const nameChanged = live.name !== item.product.name

          const anyChange =
            priceChanged ||
            stockChanged ||
            inStockChanged ||
            imageChanged ||
            nameChanged

          // Clamp quantity to available stock
          const maxQty =
            live.stockQuantity !== undefined && live.stockQuantity !== null
              ? live.stockQuantity
              : item.quantity
          const newQty = Math.min(item.quantity, Math.max(maxQty, 0))
          if (newQty !== item.quantity) changed = true

          if (anyChange) changed = true

          // If out of stock, still keep in cart (show as unavailable) — do not silently remove
          reconciled.push({
            product: anyChange ? { ...item.product, ...live } : item.product,
            quantity: newQty,
          })
        }

        if (changed) {
          // Persist to localStorage
          localStorage.setItem("perfumaria_cart", JSON.stringify(reconciled))
          setCart(reconciled)
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